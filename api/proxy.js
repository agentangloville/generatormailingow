// api/proxy.js — Angloville Mailing Generator Backend
// Klucze API ustawia się w Vercel Dashboard → Settings → Environment Variables

const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const MAILCHIMP_KEY  = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SRV  = process.env.MAILCHIMP_SERVER;   // np. us4
const MAILCHIMP_LIST = process.env.MAILCHIMP_LIST_ID;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  // ── GENERUJ KAMPANIĘ (Claude) ──────────────────────────
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
  "headline": "nagłówek H1 – emocjonalny",
  "intro": "hook – max 2 zdania",
  "body_p1": "akapit 1 – główna korzyść programu",
  "body_p2": "akapit 2 – storytelling lub przełamanie obiekcji",
  "body_p3": "akapit 3 – CTA rozgrzewające i pilność",
  "cta": "tekst przycisku – max 5 słów",
  "ps": "PS – jedno angażujące zdanie",
  "ab1": "alternatywny temat A",
  "ab2": "alternatywny temat B",
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
      try {
        campaign = JSON.parse(clean);
      } catch {
        return res.status(500).json({ error: 'JSON parse error', raw: clean.substring(0, 500) });
      }

      return res.status(200).json({ ok: true, campaign });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── UTWÓRZ DRAFT W MAILCHIMP ───────────────────────────
  if (action === 'mailchimp_draft') {
    const { campaign, program_name } = req.body;
    if (!campaign?.subject) return res.status(400).json({ error: 'Brak danych kampanii' });

    const html = buildEmailHTML(campaign);

    try {
      // Utwórz kampanię
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

      // Dodaj treść HTML
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

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Nieznana akcja' });
}

// ── HTML BUILDER ───────────────────────────────────────
function buildEmailHTML(c) {
  const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 0;">
<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#232323;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
    <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#FCD23A;text-transform:uppercase;margin-bottom:10px;">ANGLOVILLE</div>
    <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;line-height:1.25;">${e(c.headline)}</h1>
  </td></tr>
  <tr><td style="background:#ffffff;padding:36px 40px;">
    <p style="font-size:16px;color:#444;line-height:1.75;margin:0 0 20px;">${e(c.intro)}</p>
    <p style="font-size:16px;color:#444;line-height:1.75;margin:0 0 20px;">${e(c.body_p1)}</p>
    <p style="font-size:16px;color:#444;line-height:1.75;margin:0 0 20px;">${e(c.body_p2)}</p>
    <p style="font-size:16px;color:#444;line-height:1.75;margin:0 0 32px;">${e(c.body_p3)}</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
      <tr><td style="background:#FCD23A;border-radius:8px;padding:14px 32px;text-align:center;">
        <a href="https://angloville.pl" style="font-size:15px;font-weight:700;color:#232323;text-decoration:none;">${e(c.cta)}</a>
      </td></tr>
    </table>
    ${c.ps ? `<p style="font-size:14px;color:#666;line-height:1.7;border-top:1px solid #f0f0f0;padding-top:20px;margin:0;"><strong>PS:</strong> ${e(c.ps)}</p>` : ''}
  </td></tr>
  <tr><td style="background:#232323;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
    <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;line-height:1.6;">
      © Angloville | <a href="https://angloville.pl" style="color:#FCD23A;text-decoration:none;">angloville.pl</a><br>
      <a href="*|UNSUB|*" style="color:rgba(255,255,255,0.4);font-size:11px;">Wypisz się z listy</a>
    </p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}
