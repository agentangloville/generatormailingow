module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY not set' });

  const body = req.body;

  // ── GENERATE ──────────────────────────────────────────
  if (body.action === 'generate') {
    const { market, lang, brand, programmes, extra, imageCount } = body;

    const progList = (programmes || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
    const imgNote  = imageCount > 0
      ? `The email will include ${imageCount} image(s) placed automatically between sections.`
      : 'No images in this email.';

    const langNote = lang === 'pl'
      ? 'Write EVERYTHING in Polish. Do NOT use English at all.'
      : lang === 'it'
      ? 'Write EVERYTHING in Italian. Do NOT use English at all.'
      : 'Write in British English (programme, colour, travelling, organised).';

    const prompt = `You are an expert email marketing copywriter for Angloville.

BRAND CONTEXT:
${brand}

PROGRAMMES TO COVER:
${progList}

ADDITIONAL INSTRUCTIONS:
${extra || 'None'}

IMAGE CONTEXT:
${imgNote}

LANGUAGE RULE:
${langNote}

Return ONLY a valid JSON object. No markdown, no backticks, no explanation.

{
  "subject": "subject line no emoji max 55 chars",
  "subject_emoji": "subject line with 1-2 emojis max 65 chars",
  "preheader": "preheader max 90 chars",
  "headline": "strong headline max 80 chars",
  "intro": "2-3 sentence warm opening paragraph",
  "body_p1": "2-3 sentences what participants do on the programme",
  "body_p2": "2-3 sentences benefits gained experience friendships",
  "body_p3": "2-3 sentences urgency limited availability call to action",
  "cta": "primary CTA button text max 40 chars",
  "cta2": "secondary CTA button text max 40 chars",
  "ps": "short PS with urgency or bonus",
  "ab1": "A/B subject variant A",
  "ab2": "A/B subject variant B",
  "send_time": "best send day time with short reason"
}`;

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error?.message || 'Anthropic API error');

      let raw = (aiData.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const campaign = JSON.parse(raw);
      return res.status(200).json({ ok: true, campaign });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── MAILCHIMP DRAFT ───────────────────────────────────
  if (body.action === 'mailchimp_draft') {
    const mcKey  = process.env.MAILCHIMP_API_KEY;
    const mcList = process.env.MAILCHIMP_LIST_ID;

    if (!mcKey || !mcList) {
      return res.status(200).json({
        ok: true,
        draft_url: 'https://mailchimp.com',
        message: 'Mailchimp not configured',
      });
    }

    const { campaign, cta_url, images, program_name } = body;
    const dc = (mcKey.split('-')[1] || 'us1');
    const imgs = images || [];

    const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const imgBlock = img => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse;">
  <tr><td style="padding:0 9px 9px;">
    <img src="${img.thumb||img.url}" alt="" width="100%"
      style="display:block;width:100%;height:auto;border-radius:14px;max-height:300px;object-fit:cover;border:0;">
  </td></tr>
</table>`;

    const divider = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse;table-layout:fixed!important;"><tr><td style="padding:18px;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #EAEAEA;border-collapse:collapse;"><tr><td></td></tr></table></td></tr></table>`;

    const txtBlock = html => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse;">
  <tr><td style="padding:0 18px 9px;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;line-height:150%;color:#202020;">
    ${html}
  </td></tr>
</table>`;

    const btnBlock = (label, href, bg, col) => `
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse;">
  <tr><td style="padding:0 18px 18px;" align="center">
    <table border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate!important;border-radius:6px;background-color:${bg};">
      <tr><td align="center" style="font-family:Arial,sans-serif;font-size:16px;padding:15px 28px;">
        <a href="${href}" target="_blank" style="font-weight:bold;text-decoration:none;color:${col};display:block;">${e(label)}</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

    let emailBody = '';
    if (imgs[0]) emailBody += imgBlock(imgs[0]);
    emailBody += txtBlock(`
      <p style="margin:10px 0;font-size:15px;">Hi *|FNAME|*,</p>
      <p style="margin:10px 0;font-size:21px;font-weight:bold;line-height:130%;">${e(campaign.headline)}</p>
      <p style="margin:10px 0;">${e(campaign.intro)}</p>`);
    emailBody += btnBlock(campaign.cta, cta_url, '#FFD249', '#222222');
    emailBody += divider;
    emailBody += txtBlock(`<p style="margin:10px 0;">${e(campaign.body_p1)}</p>`);
    if (imgs[1]) { emailBody += imgBlock(imgs[1]); emailBody += divider; }
    emailBody += txtBlock(`<p style="margin:10px 0;">${e(campaign.body_p2)}</p>`);
    if (imgs[2]) { emailBody += imgBlock(imgs[2]); emailBody += divider; }
    emailBody += txtBlock(`<p style="margin:10px 0;">${e(campaign.body_p3)}</p>`);
    if (campaign.ps) emailBody += txtBlock(`<p style="margin:10px 0;color:#555;font-style:italic;">${e(campaign.ps)}</p>`);
    emailBody += divider;
    emailBody += btnBlock(campaign.cta2 || campaign.cta, cta_url, '#4CAAD8', '#FFFFFF');
    if (imgs[3]) { emailBody += divider; emailBody += imgBlock(imgs[3]); }
    emailBody += txtBlock(`<p style="margin:10px 0;">_______________<br>The Angloville Team</p>`);

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="background:#f0f0f0;margin:0;padding:0;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;margin:0 auto;">
  <tr><td style="padding:9px;">${emailBody}</td></tr>
  <tr><td style="padding:9px 18px 18px;font-family:Arial,sans-serif;font-size:12px;color:#666;line-height:150%;border-top:1px solid #EAEAEA;">
    <a href="*|UPDATE_PROFILE|*" style="color:#666;text-decoration:underline;">Update preferences</a> &nbsp;|&nbsp;
    <a href="*|UNSUB|*" style="color:#666;text-decoration:underline;">Unsubscribe</a>
  </td></tr>
</table>
</body></html>`;

    try {
      const auth = 'Basic ' + Buffer.from('anystring:' + mcKey).toString('base64');
      const createRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/campaigns`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'regular',
          settings: {
            subject_line: campaign.subject_emoji || campaign.subject,
            preview_text: campaign.preheader || '',
            title: `[DRAFT] ${program_name || 'Campaign'} – ${new Date().toLocaleDateString('en-GB')}`,
            from_name: 'Angloville',
            reply_to: 'hello@angloville.com',
            to_name: '*|FNAME|*',
          },
          recipients: { list_id: mcList },
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.detail || JSON.stringify(createData));
      const campaignId = createData.id;

      await fetch(`https://${dc}.api.mailchimp.com/3.0/campaigns/${campaignId}/content`, {
        method: 'PUT',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml }),
      });

      return res.status(200).json({
        ok: true,
        draft_url: `https://${dc}.admin.mailchimp.com/campaigns/edit?id=${campaignId}`,
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
