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
        body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error?.message || 'Anthropic API error');
      let raw = (aiData.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      // Find JSON object in response in case there's extra text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI nie zwróciło poprawnego JSON. Spróbuj ponownie.');
      const campaign = JSON.parse(jsonMatch[0]);
      return res.status(200).json({ ok: true, campaign });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── WORDPRESS MEDIA LIBRARY ───────────────────────────
  if (body.action === 'wordpress_images') {
    const { site, page = 1, per_page = 50, search = '' } = body;
    const allowed = ['angloville.pl', 'angloville.com', 'angloville.it'];
    if (!allowed.includes(site)) return res.status(400).json({ ok: false, error: 'Invalid site' });

    try {
      let url = `https://${site}/wp-json/wp/v2/media?media_type=image&per_page=${per_page}&page=${page}&orderby=date&order=desc`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      
      const contentType = r.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await r.text();
        throw new Error(`REST API niedostępne na ${site} (status ${r.status}). Może być wyłączone przez plugin lub wymaga autoryzacji.`);
      }
      
      const items = await r.json();
      if (!r.ok) throw new Error(items?.message || `Błąd ${r.status}`);
      
      const total      = parseInt(r.headers.get('X-WP-Total') || '0');
      const totalPages = parseInt(r.headers.get('X-WP-TotalPages') || '1');

      const files = items.map(item => ({
        id:     item.id,
        url:    item.source_url,
        thumb:  item.media_details?.sizes?.medium?.source_url
             || item.media_details?.sizes?.thumbnail?.source_url
             || item.source_url,
        label:  item.title?.rendered || item.slug || '',
        date:   item.date,
      }));

      return res.status(200).json({ ok: true, files, total, totalPages, page });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── CLOUDINARY LIST IMAGES ────────────────────────────
  if (body.action === 'cloudinary_images') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret)
      return res.status(500).json({ ok: false, error: 'Cloudinary nie skonfigurowane — dodaj CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET do Vercel' });

    const { folder = '', next_cursor = '', max_results = 50 } = body;
    const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

    const safeJson = async (response) => {
      const text = await response.text();
      try { return JSON.parse(text); }
      catch { throw new Error(`Cloudinary zwróciło błąd (${response.status}): ${text.slice(0, 200)}`); }
    };

    try {
      let url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=${max_results}&tags=true`;
      if (folder)      url += `&prefix=${encodeURIComponent(folder)}&type=upload`;
      if (next_cursor) url += `&next_cursor=${encodeURIComponent(next_cursor)}`;

      const r    = await fetch(url, { headers: { Authorization: auth } });
      const data = await safeJson(r);
      if (!r.ok) throw new Error(data.error?.message || `Cloudinary error ${r.status}`);

      // Also fetch folders
      const fr    = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/folders`, { headers: { Authorization: auth } });
      const fdata = await safeJson(fr);
      const folders = (fdata.folders || []).map(f => ({ name: f.name, path: f.path }));

      const files = (data.resources || []).map(item => ({
        id:    item.public_id,
        url:   item.secure_url.replace('/upload/', '/upload/w_1240,c_fill,g_auto:faces,q_100,f_auto/'),
        thumb: item.secure_url.replace('/upload/', '/upload/w_600,h_400,c_fill,g_auto:faces,q_90,f_auto/'),
        label: item.public_id.split('/').pop(),
        folder: item.public_id.includes('/') ? item.public_id.split('/').slice(0,-1).join('/') : '',
        bytes: item.bytes,
      }));

      return res.status(200).json({ ok: true, files, folders, next_cursor: data.next_cursor || null });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ── CLOUDINARY UPLOAD ─────────────────────────────────
  if (body.action === 'cloudinary_upload') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey    = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret)
      return res.status(500).json({ ok: false, error: 'Cloudinary nie skonfigurowane' });

    const { data: fileData, filename, folder = 'angloville-emails' } = body;
    if (!fileData) return res.status(400).json({ ok: false, error: 'Brak danych pliku' });

    const crypto    = require('crypto');
    const timestamp = Math.floor(Date.now() / 1000);

    // Signature params must be sorted alphabetically, no api_key/file/resource_type
    const sigObj = { folder, timestamp };
    const sigStr = Object.keys(sigObj).sort()
      .map(k => `${k}=${sigObj[k]}`).join('&');
    const signature = crypto.createHash('sha1').update(sigStr + apiSecret).digest('hex');

    try {
      const formData = new URLSearchParams();
      formData.append('file', `data:image/jpeg;base64,${fileData}`);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('folder', folder);
      formData.append('signature', signature);

      const r    = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'Upload failed');

      const url   = data.secure_url;
      const thumb = url.replace('/upload/', '/upload/w_300,h_200,c_fill/');
      return res.status(200).json({ ok: true, url, thumb });
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

    const bullets = txt => {
      // If already HTML from RTE editor, use directly
      if (/<[a-z][\s\S]*>/i.test(txt)) return txt;
      // Plain text — convert newlines to paragraphs, no bold
      return txt.split(/\n/).map(l=>l.trim()).filter(Boolean)
        .map(l=>`<p style="margin:0 0 10px;font-family:${FONT};font-size:16px;line-height:160%;color:#1a1a1a;">${l}</p>`).join('');
    };

    const safeHtml = txt => {
      // If already HTML from RTE editor, use directly
      if (/<[a-z][\s\S]*>/i.test(txt)) return txt;
      // Plain text — escape and wrap
      return e(txt);
    };

    const img = (src, pad, maxH) => `
<tr><td style="padding:${pad||'20px 20px 0'};line-height:0;">
  <img src="${src}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:10px;max-height:${maxH||280}px;object-fit:cover;border:0;">
</td></tr>`;

    const logoBar = `
<tr><td style="background:#F4F4F4;padding:16px 20px;" align="center">
  <img src="https://mcusercontent.com/817823f284cb8a245fdb9d298/images/1551754b-a92b-4c6a-bb5a-156a3b75d2f4.png"
    alt="Angloville" height="32" style="display:inline-block;height:32px;width:auto;border:0;max-width:180px;">
</td></tr>`;

    const headlineRow = `
<tr><td style="padding:28px 20px 6px;">
  <h1 style="margin:0;font-family:${FONT};font-size:28px;font-weight:900;line-height:115%;color:#111111;letter-spacing:-0.3px;">${e(campaign.headline)}</h1>
</td></tr>`;

    const heroImg = imgs[0] ? `
<tr><td style="padding:20px 20px 0;line-height:0;">
  <img src="${imgs[0].thumb||imgs[0].url}" alt="" width="100%"
    style="display:block;width:100%;height:auto;border-radius:10px;object-fit:cover;border:0;">
</td></tr>` : '';

    const greetingLine = campaign.showGreeting !== false
      ? `<p style="margin:0 0 14px;font-size:17px;color:#111;font-family:${FONT};">Hi <strong>*|FNAME|*</strong>,</p>` : '';
    const introRow = `
<tr><td style="padding:20px 20px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333;">
  ${greetingLine}<p style="margin:0;">${e(campaign.intro)}</p>
</td></tr>`;

    const cta1Row = `
<tr><td style="padding:24px 20px 0;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr><td align="center" bgcolor="#FCD23A" style="border-radius:50px;padding:18px 24px;">
      <a href="${cta_url}" target="_blank"
        style="color:#111111;text-decoration:none;font-weight:800;font-family:${FONT};font-size:17px;display:block;white-space:nowrap;">${e(campaign.cta)}</a>
    </td></tr>
  </table>
</td></tr>`;

    const p1Row = `
<tr><td style="padding:20px 20px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333333;">
  ${safeHtml(campaign.body_p1)}
</td></tr>`;

    const img2Row = imgs[1] ? img(imgs[1].thumb||imgs[1].url) : '';

    const p2Row = `
<tr><td style="padding:20px 20px 0;font-family:${FONT};font-size:16px;line-height:160%;color:#1a1a1a;">
  ${bullets(campaign.body_p2)}
</td></tr>`;

    const img3Row = imgs[2] ? img(imgs[2].thumb||imgs[2].url) : '';

    const p3Row = `
<tr><td style="padding:16px 20px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333333;">
  ${safeHtml(campaign.body_p3)}
</td></tr>`;

    const psRow = campaign.ps ? `
<tr><td style="padding:12px 20px 0;font-family:${FONT};font-size:14px;color:#888;font-style:italic;">
  <p style="margin:0;">${e(campaign.ps)}</p>
</td></tr>` : '';

    const cta2Row = `
<tr><td style="padding:14px 20px 24px;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
    <tr><td align="center" bgcolor="#3A9AD9" style="border-radius:50px;padding:16px 24px;">
      <a href="${cta_url}" target="_blank"
        style="color:#FFFFFF;text-decoration:none;font-weight:800;font-family:${FONT};font-size:16px;display:block;white-space:nowrap;">${e(campaign.cta2||campaign.cta)}</a>
    </td></tr>
  </table>
</td></tr>`;

    const img4Row = imgs[3] ? img(imgs[3].thumb||imgs[3].url) : '';

    const rows = [logoBar,headlineRow,heroImg,introRow,cta1Row,p1Row,img2Row,p2Row,img3Row,p3Row,psRow,cta2Row,img4Row].filter(Boolean).join('\n');

    const fullHtml = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<title></title>
<style>
  body { margin:0; padding:0; background:#EBEBEB; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  @media only screen and (max-width:620px) {
    .email-wrapper { width:100% !important; }
    .email-body td { padding-left:16px !important; padding-right:16px !important; }
    h1 { font-size:24px !important; }
    .cta-td { padding:16px 16px 0 !important; }
    .cta-btn { font-size:15px !important; padding:16px 20px !important; }
    .footer-td { padding-left:16px !important; padding-right:16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#EBEBEB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EBEBEB;">
<tr><td align="center" style="padding:0;">
<table role="presentation" class="email-wrapper" cellpadding="0" cellspacing="0" border="0"
  width="620" style="max-width:620px;width:100%;background:#FFFFFF;">
  ${rows}
  <tr><td class="footer-td" style="padding:16px 20px 24px;font-family:${FONT};font-size:12px;color:#AAAAAA;line-height:160%;border-top:1px solid #EEEEEE;">${footerContent}</td></tr>
</table>
</td></tr></table>
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
