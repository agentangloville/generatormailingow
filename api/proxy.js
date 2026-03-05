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

    const { campaign, cta_url, images, program_name, footer_html } = body;
    const dc = (mcKey.split('-')[1] || 'us1');
    const imgs = images || [];

    const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif";
    const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const footerContent = footer_html || `<a href="*|UPDATE_PROFILE|*" style="color:#AAA;text-decoration:underline;">Update preferences</a> &nbsp;|&nbsp; <a href="*|UNSUB|*" style="color:#AAA;text-decoration:underline;">Unsubscribe</a>`;

    const bullets = txt => txt.split(/\n/).map(l=>l.trim()).filter(Boolean)
      .map(l=>`<p style="margin:0 0 10px;font-family:${FONT};font-size:16px;line-height:160%;color:#1a1a1a;"><strong>${e(l)}</strong></p>`).join('');

    const logoBar = `<tr><td style="background:#F4F4F4;padding:18px 32px;" align="center">
  <img src="https://mcusercontent.com/817823f284cb8a245fdb9d298/images/1551754b-a92b-4c6a-bb5a-156a3b75d2f4.png" alt="Angloville" height="36" style="display:inline-block;height:36px;width:auto;border:0;max-width:200px;">
</td></tr>`;

    const headline = `<tr><td style="padding:36px 32px 4px;">
  <h1 style="margin:0;font-family:${FONT};font-size:36px;font-weight:900;line-height:115%;color:#111111;letter-spacing:-0.5px;">${e(campaign.headline)}</h1>
</td></tr>`;

    const heroImg = imgs[0] ? `<tr><td style="padding:28px 32px 0;"><img src="${imgs[0].thumb||imgs[0].url}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:12px;max-height:320px;object-fit:cover;border:0;"></td></tr>` : '';

    const intro = `<tr><td style="padding:24px 32px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333;">
  <p style="margin:0 0 18px;font-size:17px;color:#111;">Hi <strong>*|FNAME|*</strong>,</p>
  <p style="margin:0;">${e(campaign.intro)}</p>
</td></tr>`;

    const cta1 = `<tr><td style="padding:28px 32px 0;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr><td align="center" bgcolor="#FCD23A" style="border-radius:50px;padding:18px 32px;font-family:${FONT};font-size:17px;font-weight:bold;">
      <a href="${cta_url}" target="_blank" style="color:#111111;text-decoration:none;font-weight:bold;font-family:${FONT};display:block;">${e(campaign.cta)}</a>
    </td></tr>
  </table>
</td></tr>`;

    const p1 = `<tr><td style="padding:20px 32px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333333;">
  <p style="margin:0;">${e(campaign.body_p1)}</p>
</td></tr>`;

    const img2 = imgs[1] ? `<tr><td style="padding:24px 32px 0;"><img src="${imgs[1].thumb||imgs[1].url}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:12px;max-height:260px;object-fit:cover;border:0;"></td></tr>` : '';

    const p2 = `<tr><td style="padding:20px 32px 0;font-family:${FONT};">${bullets(campaign.body_p2)}</td></tr>`;

    const img3 = imgs[2] ? `<tr><td style="padding:24px 32px 0;"><img src="${imgs[2].thumb||imgs[2].url}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:12px;max-height:260px;object-fit:cover;border:0;"></td></tr>` : '';

    const p3 = `<tr><td style="padding:18px 32px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333333;">
  <p style="margin:0;">${e(campaign.body_p3)}</p>
</td></tr>`;

    const ps = campaign.ps ? `<tr><td style="padding:12px 32px 0;font-family:${FONT};font-size:14px;color:#888;font-style:italic;"><p style="margin:0;">${e(campaign.ps)}</p></td></tr>` : '';

    const cta2 = `<tr><td style="padding:14px 32px 0;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr><td align="center" bgcolor="#3A9AD9" style="border-radius:50px;padding:16px 32px;font-family:${FONT};font-size:16px;font-weight:bold;">
      <a href="${cta_url}" target="_blank" style="color:#FFFFFF;text-decoration:none;font-weight:bold;font-family:${FONT};display:block;">${e(campaign.cta2||campaign.cta)}</a>
    </td></tr>
  </table>
</td></tr>`;

    const img4 = imgs[3] ? `<tr><td style="padding:24px 32px 0;"><img src="${imgs[3].thumb||imgs[3].url}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:12px;max-height:260px;object-fit:cover;border:0;"></td></tr>` : '';

    const signoff = `<tr><td style="padding:24px 32px 36px;font-family:${FONT};font-size:15px;color:#888;"><p style="margin:0;">_______________<br>The Angloville Team</p></td></tr>`;

    const rows = [logoBar,headline,heroImg,intro,cta1,p1,img2,p2,img3,p3,ps,cta2,img4,signoff].filter(Boolean).join('\n');

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#EBEBEB;margin:0;padding:0;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="620"
  style="max-width:620px;background:#FFFFFF;border-collapse:collapse;margin:0 auto;">
  ${rows}
  <tr><td style="padding:16px 32px 24px;font-family:${FONT};font-size:12px;color:#AAAAAA;line-height:160%;border-top:1px solid #EEEEEE;">${footerContent}</td></tr>
</table>
</body></html>`;

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

    const { campaign, cta_url, images, program_name, footer_html } = body;
    const dc = (mcKey.split('-')[1] || 'us1');
    const imgs = images || [];

    const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif";
    const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const footerContent = footer_html || `<a href="*|UPDATE_PROFILE|*" style="color:#999;text-decoration:underline;">Update preferences</a> &nbsp;|&nbsp; <a href="*|UNSUB|*" style="color:#999;text-decoration:underline;">Unsubscribe</a>`;

    const imgBlock = img => `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 24px 24px;">
    <img src="${img.thumb||img.url}" alt="" width="100%"
      style="display:block;width:100%;height:auto;border-radius:16px;max-height:320px;object-fit:cover;border:0;">
  </td></tr>
</table>`;

    const div = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 24px 24px;"><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-top:1px solid #E8E8E8;border-collapse:collapse;"><tr><td></td></tr></table></td></tr>
</table>`;

    const txt = (html, pad) => `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:${pad||'0 24px 20px'};font-family:${FONT};font-size:16px;line-height:170%;color:#202020;">${html}</td></tr>
</table>`;

    const btn = (lbl, href, bg, col) => `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 24px 28px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate!important;">
      <tr><td align="center" bgcolor="${bg}" style="border-radius:50px;font-family:${FONT};font-size:16px;font-weight:bold;padding:16px 32px;">
        <a href="${href}" target="_blank" style="font-weight:bold;text-decoration:none;color:${col};display:block;font-family:${FONT};">${e(lbl)}</a>
      </td></tr>
    </table>
  </td></tr>
</table>`;

    const highlight = html => `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 24px 20px;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#F8F9FA;border-left:4px solid #FCD23A;border-collapse:collapse;border-radius:0 8px 8px 0;">
      <tr><td style="padding:16px 20px;font-family:${FONT};font-size:15px;line-height:170%;color:#202020;">${html}</td></tr>
    </table>
  </td></tr>
</table>`;

    const logoBlock = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#FFFFFF;">
  <tr><td style="padding:28px 24px 20px;" align="center">
    <img src="https://mcusercontent.com/817823f284cb8a245fdb9d298/images/1551754b-a92b-4c6a-bb5a-156a3b75d2f4.png"
      alt="Angloville" width="160" style="display:inline-block;height:auto;border:0;max-width:160px;">
  </td></tr>
</table>`;

    const headlineBlock = `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:0 24px 20px;">
    <h1 style="margin:0;font-family:${FONT};font-size:32px;font-weight:900;line-height:120%;color:#111111;letter-spacing:-0.5px;">${e(campaign.headline)}</h1>
  </td></tr>
</table>`;

    let emailBody = logoBlock + headlineBlock;
    if (imgs[0]) emailBody += imgBlock(imgs[0]);
    emailBody += txt(`<p style="margin:0 0 14px;font-size:16px;color:#555;">Hi <strong>*|FNAME|*</strong>,</p><p style="margin:0;">${e(campaign.intro)}</p>`);
    emailBody += btn(campaign.cta, cta_url, '#FCD23A', '#111111');
    emailBody += div;
    emailBody += txt(`<p style="margin:0;">${e(campaign.body_p1)}</p>`);
    if (imgs[1]) emailBody += imgBlock(imgs[1]);
    emailBody += highlight(campaign.body_p2.split(/\n|(?<=\.)\s+(?=[A-Z🎉✈️🎓💛✅🚀👉])/).filter(l=>l.trim()).map(l=>`<div style="margin-bottom:6px;">${e(l.trim())}</div>`).join(''));
    if (imgs[2]) emailBody += imgBlock(imgs[2]);
    emailBody += txt(`<p style="margin:0;">${e(campaign.body_p3)}</p>`);
    if (campaign.ps) emailBody += txt(`<p style="margin:0;font-size:14px;color:#777;font-style:italic;">${e(campaign.ps)}</p>`, '0 24px 16px');
    emailBody += div;
    emailBody += btn(campaign.cta2 || campaign.cta, cta_url, '#3A9AD9', '#FFFFFF');
    if (imgs[3]) emailBody += imgBlock(imgs[3]);
    emailBody += txt(`<p style="margin:0;font-size:15px;color:#555;">_______________<br>The Angloville Team</p>`, '0 24px 28px');

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#F0F1F4;margin:0;padding:16px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="600"
  style="max-width:600px;background:#FFFFFF;border-collapse:collapse;margin:0 auto;border-radius:12px;overflow:hidden;">
  <tr><td>${emailBody}</td></tr>
  <tr><td style="padding:16px 24px 24px;font-family:${FONT};font-size:12px;color:#999;line-height:160%;border-top:1px solid #EEEEEE;">${footerContent}</td></tr>
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
