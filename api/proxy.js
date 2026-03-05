const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const MAILCHIMP_KEY  = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SRV  = process.env.MAILCHIMP_SERVER;
const MAILCHIMP_LIST = process.env.MAILCHIMP_LIST_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  // ── GENERUJ ─────────────────────────────────────────
  if (action === 'generate') {
    const { program, audience, tone, season, extra } = req.body;

    const system = `Jesteś ekspertem email marketingu dla Angloville – lidera turystyki edukacyjnej w Polsce i Europie od 2011 roku.
ANGLOVILLE oferuje: Angielskie Wioski (immersja 1:1/2:1 z native speakerami z UK/USA/Irlandii/Australii), obozy językowe dla dzieci i młodzieży w Polsce i za granicą (Malta, Anglia, Londyn, USA, Japonia), wymianę uczniowską do USA (rok w High School), Amerykańskie Liceum Online, Business English dla firm, Angloville Family.
WARTOŚCI: pełna immersja – 0 książek – 0 klasy. Efekt 6 dni = 1 miesiąc w UK. Ocena 4.8★/1900+ opinii. Od 2011, 7000+ uczestników rocznie, 2000+ native speakerów.
GŁOS: ciepły, energiczny, motywujący. Aktywny język. Konkretne korzyści i emocje.`;

    const user = `Stwórz kampanię emailową.
Program: ${program}
Odbiorca: ${audience}
Ton: ${tone}
Sezon: ${season}
${extra ? `Dodatkowe: ${extra}` : ''}

Odpowiedz TYLKO czystym JSON (zero markdown, zero komentarzy):
{
  "subject": "temat – max 55 znaków",
  "subject_emoji": "temat z emoji – max 60 znaków",
  "preheader": "preheader – max 85 znaków",
  "headline": "nagłówek H1 – emocjonalny, max 10 słów",
  "intro": "hook – max 2 zdania",
  "body_p1": "akapit 1 – główna korzyść programu, 3-4 zdania",
  "body_p2": "akapit 2 – storytelling lub przełamanie obiekcji, 3-4 zdania",
  "body_p3": "akapit 3 – CTA rozgrzewające i pilność, 2-3 zdania",
  "cta": "tekst przycisku – max 5 słów",
  "ps": "PS – jedno angażujące zdanie",
  "ab1": "alternatywny temat A – max 55 znaków",
  "ab2": "alternatywny temat B – max 55 znaków",
  "send_time": "najlepszy dzień + godzina + 1-zdaniowe uzasadnienie"
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: 'Claude API error', details: data });

      const text  = (data.content || []).map(b => b.text || '').join('');
      const clean = text.replace(/```json|```/g, '').trim();

      let campaign;
      try { campaign = JSON.parse(clean); }
      catch { return res.status(500).json({ error: 'JSON parse error', raw: clean.substring(0, 500) }); }

      return res.status(200).json({ ok: true, campaign });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── MAILCHIMP DRAFT ──────────────────────────────────
  if (action === 'mailchimp_draft') {
    const { campaign, cta_url, image_url, program_name } = req.body;
    if (!campaign?.subject) return res.status(400).json({ error: 'Brak danych kampanii' });

    const html = buildEmailHTML(campaign, cta_url || 'https://angloville.pl', image_url || null);

    try {
      const mcRes = await fetch(`https://${MAILCHIMP_SRV}.api.mailchimp.com/3.0/campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`anystring:${MAILCHIMP_KEY}`).toString('base64'),
        },
        body: JSON.stringify({
          type: 'regular',
          recipients: { list_id: MAILCHIMP_LIST },
          settings: {
            subject_line: campaign.subject,
            preview_text: campaign.preheader || '',
            title: `${program_name} – ${new Date().toLocaleDateString('pl-PL')}`,
            from_name: 'Angloville',
            reply_to: 'biuro@angloville.pl',
          },
        }),
      });
      const mcData = await mcRes.json();
      if (!mcRes.ok) return res.status(502).json({ error: 'Mailchimp error', details: mcData });

      const campaignId = mcData.id;
      await fetch(`https://${MAILCHIMP_SRV}.api.mailchimp.com/3.0/campaigns/${campaignId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`anystring:${MAILCHIMP_KEY}`).toString('base64'),
        },
        body: JSON.stringify({ html }),
      });

      return res.status(200).json({
        ok: true,
        campaign_id: campaignId,
        draft_url: `https://us1.admin.mailchimp.com/campaigns/edit?id=${campaignId}`,
      });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Nieznana akcja' });
}

// ── EMAIL HTML BUILDER ───────────────────────────────
function buildEmailHTML(c, ctaUrl, imgUrl) {
  const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const imageBlock = imgUrl ? `
  <tr><td style="padding:0;line-height:0;">
    <img src="${imgUrl}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;object-fit:cover;">
  </td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${e(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- HEADER -->
    <tr><td style="background-color:#232323;padding:32px 40px 28px;text-align:center;">
      <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:4px;color:#FCD23A;text-transform:uppercase;margin-bottom:14px;">ANGLOVILLE</div>
      <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;margin:0;">${e(c.headline)}</h1>
    </td></tr>

    <!-- HERO IMAGE (if any) -->
    ${imageBlock}

    <!-- BODY -->
    <tr><td style="background-color:#ffffff;padding:36px 40px 28px;">
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444444;line-height:1.75;margin:0 0 20px 0;">${e(c.intro)}</p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444444;line-height:1.75;margin:0 0 20px 0;">${e(c.body_p1)}</p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444444;line-height:1.75;margin:0 0 20px 0;">${e(c.body_p2)}</p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444444;line-height:1.75;margin:0 0 32px 0;">${e(c.body_p3)}</p>

      <!-- CTA BUTTON -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px;">
        <tr>
          <td style="background-color:#FCD23A;border-radius:8px;padding:0;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#232323;text-decoration:none;padding:15px 36px;letter-spacing:0.3px;">${e(c.cta)}</a>
          </td>
        </tr>
      </table>

      ${c.ps ? `<p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#666666;line-height:1.7;border-top:1px solid #f0f0f0;padding-top:20px;margin:0;"><strong>PS:</strong> ${e(c.ps)}</p>` : ''}
    </td></tr>

    <!-- DIVIDER -->
    <tr><td style="background-color:#FCD23A;height:4px;padding:0;line-height:0;">&nbsp;</td></tr>

    <!-- FOOTER -->
    <tr><td style="background-color:#232323;padding:24px 40px;text-align:center;">
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.5);margin:0 0 8px 0;line-height:1.6;">
        Angloville Sp. z o.o. | <a href="https://angloville.pl" style="color:#FCD23A;text-decoration:none;font-weight:600;">angloville.pl</a>
      </p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.3);margin:0;">
        <a href="*|UNSUB|*" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Wypisz się z listy mailingowej</a>
      </p>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}
