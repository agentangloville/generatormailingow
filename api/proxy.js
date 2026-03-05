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
    const imgNote  = imageCount > 0 ? `The email will include ${imageCount} image(s).` : 'No images.';
    const langNote = lang === 'pl' ? 'Write EVERYTHING in Polish. Do NOT use English.'
      : lang === 'it' ? 'Write EVERYTHING in Italian. Do NOT use English.'
      : 'Write in British English (programme, colour, travelling, organised).';

    const prompt = `You are an expert email marketing copywriter for Angloville.

BRAND CONTEXT:
${brand}

PROGRAMMES TO COVER:
${progList}

ADDITIONAL INSTRUCTIONS:
${extra || 'None'}

${imgNote}

LANGUAGE RULE: ${langNote}

IMPORTANT for body_p2: Write 2-4 short punchy lines each starting with a relevant emoji, separated by newlines.
Example:
🏡 Free accommodation and meals included
✈️ No experience required
🎓 Gain internationally recognised experience

Return ONLY valid JSON, no markdown, no backticks.

{
  "subject": "subject line no emoji max 55 chars",
  "subject_emoji": "subject with 1-2 emojis max 65 chars",
  "preheader": "preheader max 90 chars",
  "headline": "strong punchy headline max 70 chars",
  "intro": "2-3 sentence warm opening paragraph",
  "body_p1": "2-3 sentences what participants do",
  "body_p2": "2-4 emoji bullet lines separated by newlines",
  "body_p3": "2-3 sentences urgency and call to action",
  "cta": "primary CTA button max 35 chars",
  "cta2": "secondary CTA button max 35 chars",
  "ps": "short PS with urgency or bonus",
  "ab1": "A/B subject variant A",
  "ab2": "A/B subject variant B",
  "send_time": "best send day and time with short reason"
}`;

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
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

  // ── MAILCHIMP LIST IMAGES ─────────────────────────────
  if (body.action === 'mailchimp_images') {
    const mcKey = process.env.MAILCHIMP_API_KEY;
    if (!mcKey) return res.status(500).json({ ok: false, error: 'MAILCHIMP_API_KEY not set' });
    const dc = mcKey.split('-')[1] || 'us1';
    const auth = 'Basic ' + Buffer.from('anystring:' + mcKey).toString('base64');
    const { offset = 0, count = 200, folder_id } = body;
    let url = `https://${dc}.api.mailchimp.com/3.0/file-manager/files?count=${count}&offset=${offset}&sort_field=created_at&sort_dir=DESC&type=image`;
    if (folder_id) url += `&folder_id=${folder_id}`;
    try {
      const r = await fetch(url, { headers: { 'Authorization': auth } });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || JSON.stringify(d));
      const files = (d.files || []).map(f => ({
        id:   f.id,
        url:  f.full_size_url || f.url,
        thumb: f.thumbnail_url || f.full_size_url || f.url,
        label: f.name,
        folder_id: f.folder_id,
        size: f.size,
      }));
      // Also get folders
      const fr = await fetch(`https://${dc}.api.mailchimp.com/3.0/file-manager/folders?count=50`, { headers: { 'Authorization': auth } });
      const fd = await fr.json();
      const folders = (fd.folders || []).map(f => ({ id: f.id, name: f.name }));
      return res.status(200).json({ ok: true, files, folders, total: d.total_items });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── MAILCHIMP UPLOAD ──────────────────────────────────
  if (body.action === 'mailchimp_upload') {
    const mcKey = process.env.MAILCHIMP_API_KEY;
    if (!mcKey) return res.status(500).json({ ok: false, error: 'MAILCHIMP_API_KEY not set' });

    const { filename, data } = body; // data = pure base64 string
    if (!filename || !data) return res.status(400).json({ ok: false, error: 'Missing filename or data' });

    const dc = mcKey.split('-')[1] || 'us1';
    const auth = 'Basic ' + Buffer.from('anystring:' + mcKey).toString('base64');

    try {
      const uploadRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/file-manager/files`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: filename, file_data: data }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.detail || JSON.stringify(uploadData));
      const url = uploadData.full_size_url || uploadData.url;
      return res.status(200).json({ ok: true, url });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── MAILCHIMP DRAFT ───────────────────────────────────
  if (body.action === 'mailchimp_draft') {
    const mcKey  = process.env.MAILCHIMP_API_KEY;
    const mcList = process.env.MAILCHIMP_LIST_ID;
    if (!mcKey || !mcList) return res.status(200).json({ ok: true, draft_url: 'https://mailchimp.com', message: 'Mailchimp not configured' });

    const { campaign, cta_url, images, program_name, footer_html } = body;
    const dc   = mcKey.split('-')[1] || 'us1';
    const imgs = images || [];
    const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif";
    const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const footerContent = footer_html || `<a href="*|UPDATE_PROFILE|*" style="color:#AAA;text-decoration:underline;">Update preferences</a> &nbsp;|&nbsp; <a href="*|UNSUB|*" style="color:#AAA;text-decoration:underline;">Unsubscribe</a>`;

    const bullets = txt => txt.split(/\n/).map(l=>l.trim()).filter(Boolean)
      .map(l=>`<p style="margin:0 0 10px;font-family:${FONT};font-size:16px;line-height:160%;color:#1a1a1a;"><strong>${e(l)}</strong></p>`).join('');

    const img = (src,pad,h) => `<tr><td style="padding:${pad||'24px 32px 0'};"><img src="${src}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:12px;max-height:${h||260}px;object-fit:cover;border:0;"></td></tr>`;

    const logoBar     = `<tr><td style="background:#F4F4F4;padding:18px 32px;" align="center"><img src="https://mcusercontent.com/817823f284cb8a245fdb9d298/images/1551754b-a92b-4c6a-bb5a-156a3b75d2f4.png" alt="Angloville" height="36" style="display:inline-block;height:36px;width:auto;border:0;max-width:200px;"></td></tr>`;
    const headlineRow = `<tr><td style="padding:36px 32px 4px;"><h1 style="margin:0;font-family:${FONT};font-size:36px;font-weight:900;line-height:115%;color:#111111;letter-spacing:-0.5px;">${e(campaign.headline)}</h1></td></tr>`;
    const heroImg     = imgs[0] ? img(imgs[0].thumb||imgs[0].url,'28px 32px 0',320) : '';
    const introRow    = `<tr><td style="padding:24px 32px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333;"><p style="margin:0 0 18px;font-size:17px;color:#111;">Hi <strong>*|FNAME|*</strong>,</p><p style="margin:0;">${e(campaign.intro)}</p></td></tr>`;
    const cta1Row     = `<tr><td style="padding:28px 32px 0;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr><td align="center" bgcolor="#FCD23A" style="border-radius:50px;padding:18px 32px;font-family:${FONT};font-size:17px;font-weight:bold;"><a href="${cta_url}" target="_blank" style="color:#111111;text-decoration:none;font-weight:bold;font-family:${FONT};display:block;">${e(campaign.cta)}</a></td></tr></table></td></tr>`;
    const p1Row       = `<tr><td style="padding:20px 32px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333333;"><p style="margin:0;">${e(campaign.body_p1)}</p></td></tr>`;
    const img2Row     = imgs[1] ? img(imgs[1].thumb||imgs[1].url) : '';
    const p2Row       = `<tr><td style="padding:20px 32px 0;font-family:${FONT};">${bullets(campaign.body_p2)}</td></tr>`;
    const img3Row     = imgs[2] ? img(imgs[2].thumb||imgs[2].url) : '';
    const p3Row       = `<tr><td style="padding:18px 32px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333333;"><p style="margin:0;">${e(campaign.body_p3)}</p></td></tr>`;
    const psRow       = campaign.ps ? `<tr><td style="padding:12px 32px 0;font-family:${FONT};font-size:14px;color:#888;font-style:italic;"><p style="margin:0;">${e(campaign.ps)}</p></td></tr>` : '';
    const cta2Row     = `<tr><td style="padding:14px 32px 0;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;"><tr><td align="center" bgcolor="#3A9AD9" style="border-radius:50px;padding:16px 32px;font-family:${FONT};font-size:16px;font-weight:bold;"><a href="${cta_url}" target="_blank" style="color:#FFFFFF;text-decoration:none;font-weight:bold;font-family:${FONT};display:block;">${e(campaign.cta2||campaign.cta)}</a></td></tr></table></td></tr>`;
    const img4Row     = imgs[3] ? img(imgs[3].thumb||imgs[3].url) : '';
    const signoffRow  = `<tr><td style="padding:24px 32px 36px;font-family:${FONT};font-size:15px;color:#888;"><p style="margin:0;">_______________<br>The Angloville Team</p></td></tr>`;

    const rows = [logoBar,headlineRow,heroImg,introRow,cta1Row,p1Row,img2Row,p2Row,img3Row,p3Row,psRow,cta2Row,img4Row,signoffRow].filter(Boolean).join('\n');

    const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#EBEBEB;margin:0;padding:0;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="620" style="max-width:620px;background:#FFFFFF;border-collapse:collapse;margin:0 auto;">
  ${rows}
  <tr><td style="padding:16px 32px 24px;font-family:${FONT};font-size:12px;color:#AAAAAA;line-height:160%;border-top:1px solid #EEEEEE;">${footerContent}</td></tr>
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
