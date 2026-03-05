const Anthropic = require('@anthropic-ai/sdk');
const MAILCHIMP_API_KEY  = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_LIST_ID  = process.env.MAILCHIMP_LIST_ID;
const MAILCHIMP_SERVER   = process.env.MAILCHIMP_SERVER || 'us20';

const client = new Anthropic();

// ═══════════════════════════════════════════════════
//  GENERATE SYSTEM PROMPT
// ═══════════════════════════════════════════════════
function buildSystemPrompt(market, lang, brand, programmes, extra, imageCount) {
  const isMulti = programmes.length > 1;
  const progList = programmes.map((p, i) => `  ${i + 1}. ${p}`).join('\n');

  const langInstructions = {
    'en-gb': 'Write entirely in British English. Use British spellings: programme, colour, travelling, organised, centre, realise. NEVER use American spellings.',
    'pl':    'Pisz wyłącznie po polsku. Żadnych angielskich wtrąceń. Naturalne, żywe zdania.',
    'it':    'Scrivi esclusivamente in italiano. Nessuna parola in inglese eccetto i nomi propri dei programmi.',
  };

  const multiNote = isMulti
    ? `\nIMPORTANT: This campaign covers MULTIPLE programmes: write content that naturally covers all of them, using them as complementary options or a combined offer. Weave them together naturally.\n`
    : '';

  const imgNote = imageCount > 0
    ? `\nNote: The email will contain ${imageCount} image(s) placed between content sections. Write body sections as standalone paragraphs that work visually separated by images.\n`
    : '';

  const extraNote = extra ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${extra}\n` : '';

  return `You are an expert email marketing copywriter for Angloville.
${brand}
${multiNote}${imgNote}${extraNote}
PROGRAMMES TO WRITE ABOUT:
${progList}

${langInstructions[lang] || langInstructions['en-gb']}

Write a complete, engaging email campaign. Return ONLY a valid JSON object — no markdown, no explanation, no backticks.

JSON structure (all fields required):
{
  "subject": "short punchy subject line (no emoji)",
  "subject_emoji": "same subject line with 1-2 relevant emojis",
  "preheader": "preview text, 1 sentence, continues the subject",
  "headline": "bold headline shown large at top of email",
  "intro": "warm opening paragraph, 2-3 sentences, personal and engaging",
  "body_p1": "first body section — what the experience is like, vivid and real, 3-4 sentences",
  "body_p2": "second body section — key benefits / what they gain, can use bullet points with line breaks",
  "body_p3": "third body section — urgency / call to action context, 2-3 sentences",
  "cta": "primary CTA button text (short, action-oriented, e.g. 'Secure Your Spot ✅')",
  "cta2": "secondary CTA button text (slightly different angle)",
  "ps": "short PS line that adds one final persuasion point",
  "ab1": "A/B subject line variant A",
  "ab2": "A/B subject line variant B",
  "send_time": "recommended send day and time (e.g. 'Send: Tuesday 10:00 AM — high open rate for this audience')"
}`;
}

// ═══════════════════════════════════════════════════
//  BUILD MAILCHIMP EMAIL HTML
// ═══════════════════════════════════════════════════
function buildMailchimpHTML(campaign, ctaUrl, images) {
  const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const nl2br = s => e(s).replace(/\n/g, '<br>');

  const imgBlock = img => `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse;">
      <tbody><tr><td style="padding:9px 9px 0;">
        <img src="${img.thumb || img.url}" alt="" width="100%"
          style="display:block;width:100%;height:auto;border-radius:16px;max-height:320px;object-fit:cover;border:0;">
      </td></tr></tbody>
    </table>`;

  const divider = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%"
      style="min-width:100%;border-collapse:collapse;table-layout:fixed!important;">
      <tbody><tr><td style="padding:18px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%"
          style="min-width:100%;border-top:2px solid #EAEAEA;border-collapse:collapse;">
          <tbody><tr><td></td></tr></tbody></table>
      </td></tr></tbody>
    </table>`;

  const txtBlock = (html) => `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse;">
      <tbody><tr><td class="mcnTextContent"
        style="padding-top:0;padding-right:18px;padding-bottom:9px;padding-left:18px;
          mso-line-height-rule:exactly;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;
          word-break:break-word;color:#202020;font-family:Helvetica;font-size:16px;line-height:150%;text-align:left;">
        ${html}
      </td></tr></tbody>
    </table>`;

  const ctaBtn = (label, href, bg, col) => `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="mcnButtonBlock"
      style="min-width:100%;border-collapse:collapse;">
      <tbody class="mcnButtonBlockOuter"><tr>
        <td style="padding-top:0;padding-right:18px;padding-bottom:18px;padding-left:18px;" valign="top" align="center">
          <table border="0" cellpadding="0" cellspacing="0" class="mcnButtonContentContainer"
            style="border-collapse:separate!important;border-radius:4px;background-color:${bg};">
            <tbody><tr>
              <td align="center" valign="middle" class="mcnButtonContent"
                style="font-family:Arial;font-size:16px;padding:18px;">
                <a class="mcnButton" href="${href}" target="_blank"
                  style="font-weight:bold;letter-spacing:normal;line-height:100%;text-align:center;text-decoration:none;color:${col};display:block;">
                  ${e(label)}
                </a>
              </td>
            </tr></tbody>
          </table>
        </td>
      </tr></tbody>
    </table>`;

  let body = '';
  if (images && images[0]) body += imgBlock(images[0]);

  body += txtBlock(`
    <p style="margin:10px 0;font-size:15px;font-family:Arial,sans-serif;">
      Hi <strong>*|FNAME|*</strong>,
    </p>
    <p style="margin:10px 0;font-size:22px;font-weight:bold;line-height:130%;font-family:Arial,sans-serif;">
      ${e(campaign.headline)}
    </p>
    <p style="margin:10px 0;font-family:Arial,sans-serif;font-size:15px;">${nl2br(campaign.intro)}</p>
  `);

  body += ctaBtn(campaign.cta, ctaUrl, '#FFD249', '#222222');
  body += divider;
  body += txtBlock(`<p style="margin:10px 0;font-family:Arial,sans-serif;font-size:15px;">${nl2br(campaign.body_p1)}</p>`);
  if (images && images[1]) { body += imgBlock(images[1]); body += divider; }
  body += txtBlock(`<p style="margin:10px 0;font-family:Arial,sans-serif;font-size:15px;">${nl2br(campaign.body_p2)}</p>`);
  if (images && images[2]) { body += imgBlock(images[2]); body += divider; }
  body += txtBlock(`<p style="margin:10px 0;font-family:Arial,sans-serif;font-size:15px;">${nl2br(campaign.body_p3)}</p>`);
  if (campaign.ps) body += txtBlock(`<p style="margin:10px 0;color:#555;font-style:italic;font-family:Arial,sans-serif;font-size:15px;">${nl2br(campaign.ps)}</p>`);
  body += divider;
  body += ctaBtn(campaign.cta2 || campaign.cta, ctaUrl, '#4CAAD8', '#FFFFFF');
  if (images && images[3]) { body += divider; body += imgBlock(images[3]); }
  body += txtBlock(`<p style="margin:10px 0;font-family:Arial,sans-serif;font-size:15px;">_______________<br>The Angloville Team</p>`);

  return `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(campaign.subject)}</title>
  <style type="text/css">
    p{margin:10px 0;padding:0}
    table{border-collapse:collapse}
    img{border:0;height:auto;outline:none;text-decoration:none}
    body,#bodyTable,#bodyCell{height:100%;margin:0;padding:0;width:100%}
    #bodyCell{padding:10px}
    .templateContainer{max-width:600px!important}
    body,#bodyTable{background-color:#ffffff}
    @media only screen and (max-width:480px){
      body{width:100%!important;min-width:100%!important}
    }
  </style>
</head>
<body style="background:#ffffff;height:100%;margin:0;padding:0;width:100%">
  <center>
    <table align="center" border="0" cellpadding="0" cellspacing="0" height="100%" width="100%" id="bodyTable"
      style="background:#ffffff;border-collapse:collapse;height:100%;margin:0;padding:0;width:100%">
      <tr>
        <td align="left" valign="top" id="bodyCell" style="height:100%;margin:0;padding:10px;width:100%">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" class="templateContainer"
            style="border-collapse:collapse;max-width:600px!important">
            <tr><td valign="top" id="templateBody" style="border-top:0;border-bottom:0">
              ${body}
            </td></tr>
            <tr><td valign="top" id="templateFooter" style="border-top:0;border-bottom:0">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width:100%;border-collapse:collapse">
                <tbody><tr><td valign="top" style="padding-top:9px">
                  <table align="left" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tbody><tr><td valign="top" class="mcnTextContent"
                      style="padding-top:0;padding-right:18px;padding-bottom:9px;padding-left:18px;
                        color:#202020;font-family:Helvetica;font-size:12px;line-height:150%;text-align:left;">
                      <span style="font-size:12px">
                        Want to change how you receive these emails?<br>
                        You can <a href="*|UPDATE_PROFILE|*" style="color:#202020;text-decoration:underline;">update your preferences</a>
                        or <a href="*|UNSUB|*" style="color:#202020;text-decoration:underline;">unsubscribe from this list</a>.<br><br>
                        Your personal data controller is Angloville International Ltd.
                        <a href="https://angloville.com/privacy-policy/" target="_blank"
                          style="color:#202020;text-decoration:underline;">Privacy Policy.</a>
                      </span>
                    </td></tr></tbody>
                  </table>
                </td></tr></tbody>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { action } = body;

    // ── GENERATE ──────────────────────────────────
    if (action === 'generate') {
      const { market, lang, brand, programmes, extra, imageCount } = body;
      if (!programmes || !programmes.length) {
        return res.status(400).json({ ok: false, error: 'No programmes specified' });
      }

      const systemPrompt = buildSystemPrompt(market, lang, brand, programmes, extra, imageCount || 0);

      const progNames = programmes.map(p => p.split('–')[0].trim()).join(' + ');
      const userMsg   = `Generate a complete email campaign for: ${progNames}`;

      const message = await client.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 2000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userMsg }],
      });

      const raw = message.content[0].text.trim();
      let campaign;
      try {
        const clean = raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'').trim();
        campaign = JSON.parse(clean);
      } catch {
        return res.status(500).json({ ok: false, error: 'Failed to parse AI response. Raw: ' + raw.slice(0, 200) });
      }

      return res.status(200).json({ ok: true, campaign });
    }

    // ── MAILCHIMP DRAFT ───────────────────────────
    if (action === 'mailchimp_draft') {
      const { campaign, cta_url, images, program_name } = body;

      if (!MAILCHIMP_API_KEY || !MAILCHIMP_LIST_ID) {
        return res.status(200).json({ ok: true, draft_url: 'https://mailchimp.com', message: 'Mailchimp not configured — add MAILCHIMP_API_KEY and MAILCHIMP_LIST_ID env vars' });
      }

      const htmlContent = buildMailchimpHTML(campaign, cta_url || 'https://angloville.com/apply/', images || []);
      const subjectLine = campaign.subject_emoji || campaign.subject;

      const mcRes = await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'apikey ' + MAILCHIMP_API_KEY,
        },
        body: JSON.stringify({
          type: 'regular',
          settings: {
            subject_line:  subjectLine,
            preview_text:  campaign.preheader || '',
            title:         (program_name || 'Campaign') + ' — ' + new Date().toISOString().slice(0,10),
            from_name:     'Angloville',
            reply_to:      'hello@angloville.com',
            to_name:       '*|FNAME|*',
          },
          recipients: { list_id: MAILCHIMP_LIST_ID },
        }),
      });

      const mcData = await mcRes.json();
      if (!mcRes.ok) throw new Error(mcData.detail || JSON.stringify(mcData));
      const campaignId = mcData.id;

      await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/campaigns/${campaignId}/content`, {
        method:  'PUT',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'apikey ' + MAILCHIMP_API_KEY,
        },
        body: JSON.stringify({ html: htmlContent }),
      });

      const draftUrl = `https://${MAILCHIMP_SERVER}.admin.mailchimp.com/campaigns/edit?id=${campaignId}`;
      return res.status(200).json({ ok: true, draft_url: draftUrl, campaign_id: campaignId });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
