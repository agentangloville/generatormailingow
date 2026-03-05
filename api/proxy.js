const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const MAILCHIMP_KEY  = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SRV  = process.env.MAILCHIMP_SERVER;
const MAILCHIMP_LIST = process.env.MAILCHIMP_LIST_ID;

const MARKET_CONTEXT = {
  pl: {
    brand: `Angloville.pl – lider turystyki edukacyjnej w Polsce i Europie od 2011 roku.
OFERTA: Angielska Wioska dla dorosłych (immersja 1:1 z native speakerami z UK/USA/Irlandii/AU), obozy językowe dla dzieci i młodzieży w Polsce i za granicą (Malta, Anglia, Londyn, Eurotrip, Baltic Trip, Italy Trip, USA, Japonia), wymiana licealna do USA i Kanady, Liceum Online, Business English dla firm, Angloville Family.
WARTOŚCI: pełna immersja – 0 książek – 0 klasy. 6 dni = 1 miesiąc w UK. 4.8★/1900+ opinii. Od 2011, 7000+ uczestników rocznie.
GŁOS: ciepły, energiczny, motywujący. Aktywny język polski. Konkretne korzyści i emocje.
INSTRUKCJA JĘZYKOWA: Odpowiedz TYLKO po polsku.`,
    jsonNote: 'Treść WYŁĄCZNIE w języku polskim.'
  },
  com: {
    brand: `Angloville.com – international cultural exchange programmes since 2011.
OFFER: Sponsored Junior immersion programmes in Poland, Italy, Malta, UK (Roehampton & Kent), Eurotrip, UK Trip; Sponsored Adult programmes in Poland; Sponsored cultural exchange roles – ESL Mentor, Activity Leader, Programme Coordinator (fully sponsored places, no teaching experience required); TEFL paid job placements in Thailand, South Korea, Japan, Vietnam; Travel tours to USA East Coast, USA West Coast, Japan.
VALUES: Fully sponsored cultural exchange – native English speakers join learners across Europe. 2000+ native speakers placed annually. No fees – participants receive free accommodation, meals and a unique travel experience.
VOICE: adventurous, community-driven, inspiring. NEVER use the word "volunteer" or "volunteering" – always say "sponsored place", "sponsored programme", "cultural exchange role". Speak directly to the native English speaker. Focus on travel, cultural impact, career development, friendship and the unique experience.
LANGUAGE: Respond ONLY in British English (use British spelling: programme, colour, travelling, organised, etc.).`,
    jsonNote: 'ALL content MUST be in British English only. NEVER use the word volunteer/volunteering – use "sponsored place" or "cultural exchange" instead.'
  },
  it: {
    brand: `Angloville.it – leader nei programmi di immersione linguistica in Italia e in Europa dal 2011.
OFFERTA BAMBINI (7-11 anni): Villaggio Inglese in Italia – 60h con madrelingua in 7 giorni.
OFFERTA RAGAZZI (12-17 anni): Villaggio Inglese in Italia – 70h di full immersion con madrelingua in 7 giorni.
OFFERTA ALL'ESTERO: Vacanza Studio in college a Londra (13-19), Malta in residence (12-17), Junior Plus Baltic Trip (13-19), Junior Plus Eurotrip Parigi/Berlino/Bruxelles/Amsterdam (13-19).
JUNIOR ADVENTURE: New York (Times Square, Central Park, Statua della Libertà), Miami (Florida, spiagge), Giappone (Tokyo, Kyoto, Osaka) – tutti 13-19 anni con madrelingua.
ADULTI: Full immersion in inglese in Italia con madrelingua.
ANNO ALL'ESTERO: Anno scolastico completo in un liceo americano (12-18 anni).
VALORI: Full immersion in inglese – 0 libri – 0 lezioni frontali. 70-100h con tutor madrelingua provenienti da tutto il mondo anglofono. Metodo naturale e divertente. Il programma più personalizzato d'Europa.
TONO: caldo, coinvolgente, motivante. Italiano corretto e naturale. Benefici concreti ed emozioni. Parla direttamente ai genitori oppure ai ragazzi a seconda del pubblico.
LINGUA: Rispondere SOLO in italiano corretto.`,
    jsonNote: 'Tutti i contenuti DEVONO essere in italiano. Per bambini (7-11): tono rivolto ai genitori. Per ragazzi (12-17): tono più diretto e coinvolgente.'
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.body;

  // ── GENERUJ ─────────────────────────────────
  if (action === 'generate') {
    const { market='pl', program, audience, tone, season, extra } = req.body;
    const ctx = MARKET_CONTEXT[market] || MARKET_CONTEXT.pl;

    const system = ctx.brand;

    const user = `Create an email campaign.
Program: ${program}
Audience: ${audience}
Tone: ${tone}
Season: ${season}
${extra ? `Additional info: ${extra}` : ''}

${ctx.jsonNote}
Respond with ONLY clean JSON (no markdown, no comments, no explanation):
{
  "subject": "subject line – max 55 chars",
  "subject_emoji": "subject with emoji – max 60 chars",
  "preheader": "preheader text – max 85 chars",
  "headline": "H1 headline – emotional, max 10 words",
  "intro": "hook – max 2 sentences",
  "body_p1": "paragraph 1 – main benefit, 3-4 sentences",
  "body_p2": "paragraph 2 – storytelling or objection handling, 3-4 sentences",
  "body_p3": "paragraph 3 – CTA warm-up and urgency, 2-3 sentences",
  "cta": "CTA button text – max 5 words",
  "ps": "PS – one engaging sentence",
  "ab1": "A/B subject variant A – max 55 chars",
  "ab2": "A/B subject variant B – max 55 chars",
  "send_time": "best day + time + 1-sentence rationale"
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:4096, system, messages:[{role:'user',content:user}] }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error:'Claude API error', details:data });

      const text  = (data.content||[]).map(b=>b.text||'').join('');
      const clean = text.replace(/```json|```/g,'').trim();

      let campaign;
      try { campaign = JSON.parse(clean); }
      catch { return res.status(500).json({ error:'JSON parse error', raw:clean.substring(0,500) }); }

      return res.status(200).json({ ok:true, campaign });
    } catch(err) { return res.status(500).json({ error:err.message }); }
  }

  // ── MAILCHIMP DRAFT ──────────────────────────
  if (action === 'mailchimp_draft') {
    const { campaign, cta_url, image_url, program_name } = req.body;
    if (!campaign?.subject) return res.status(400).json({ error:'Brak danych kampanii' });

    const html = buildEmailHTML(campaign, cta_url||'https://angloville.pl', image_url||null, program_name||'Angloville');

    try {
      const mcRes = await fetch(`https://${MAILCHIMP_SRV}.api.mailchimp.com/3.0/campaigns`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Basic '+Buffer.from(`anystring:${MAILCHIMP_KEY}`).toString('base64') },
        body: JSON.stringify({
          type:'regular', recipients:{list_id:MAILCHIMP_LIST},
          settings:{ subject_line:campaign.subject, preview_text:campaign.preheader||'', title:`${program_name} – ${new Date().toLocaleDateString('pl-PL')}`, from_name:'Angloville', reply_to:'biuro@angloville.pl' }
        }),
      });
      const mcData = await mcRes.json();
      if (!mcRes.ok) return res.status(502).json({ error:'Mailchimp error', details:mcData });

      await fetch(`https://${MAILCHIMP_SRV}.api.mailchimp.com/3.0/campaigns/${mcData.id}/content`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Basic '+Buffer.from(`anystring:${MAILCHIMP_KEY}`).toString('base64') },
        body: JSON.stringify({ html }),
      });

      return res.status(200).json({ ok:true, campaign_id:mcData.id, draft_url:`https://us1.admin.mailchimp.com/campaigns/edit?id=${mcData.id}` });
    } catch(err) { return res.status(500).json({ error:err.message }); }
  }

  return res.status(400).json({ error:'Nieznana akcja' });
}

function buildEmailHTML(c, ctaUrl, imgUrl, brandName) {
  const e = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const imgBlock = imgUrl ? `
  <tr><td style="padding:0;line-height:0;">
    <img src="${imgUrl}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;max-height:300px;object-fit:cover;">
  </td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F5F5;">
<tr><td align="center" style="padding:28px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);">
    <tr><td style="background:#232323;padding:30px 40px 26px;text-align:center;">
      <div style="font-family:Arial,sans-serif;font-size:9px;font-weight:700;letter-spacing:4px;color:#FCD23A;text-transform:uppercase;margin-bottom:12px;">ANGLOVILLE</div>
      <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:27px;font-weight:800;color:#fff;line-height:1.2;margin:0;">${e(c.headline)}</h1>
    </td></tr>
    ${imgBlock}
    <tr><td style="background:#fff;padding:34px 40px 26px;">
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444;line-height:1.75;margin:0 0 18px;">${e(c.intro)}</p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444;line-height:1.75;margin:0 0 18px;">${e(c.body_p1)}</p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444;line-height:1.75;margin:0 0 18px;">${e(c.body_p2)}</p>
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;color:#444;line-height:1.75;margin:0 0 30px;">${e(c.body_p3)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 30px;">
        <tr><td style="background:#FCD23A;border-radius:8px;">
          <a href="${ctaUrl}" target="_blank" style="display:inline-block;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#232323;text-decoration:none;padding:14px 34px;">${e(c.cta)}</a>
        </td></tr>
      </table>
      ${c.ps ? `<p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#666;line-height:1.7;border-top:1px solid #f0f0f0;padding-top:18px;margin:0;"><strong>PS:</strong> ${e(c.ps)}</p>` : ''}
    </td></tr>
    <tr><td style="background:#FCD23A;height:4px;padding:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="background:#232323;padding:22px 40px;text-align:center;">
      <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,.45);margin:0 0 6px;line-height:1.6;">
        © Angloville | <a href="${ctaUrl.split('?')[0].replace(/\/[^/]*$/, '')}" style="color:#FCD23A;text-decoration:none;font-weight:600;">angloville.pl</a>
      </p>
      <a href="*|UNSUB|*" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;color:rgba(255,255,255,.3);text-decoration:underline;">Wypisz się z listy mailingowej</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
