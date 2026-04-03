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
    const { market, lang, brand, programmes, extra, imageCount, emailType } = body;
    const progList = (programmes || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
    const imgNote  = imageCount > 0 ? `The email will include ${imageCount} image(s).` : 'No images.';
    const langNote = lang === 'pl' ? 'Write EVERYTHING in Polish. Do NOT use English.'
      : lang === 'it' ? 'Write EVERYTHING in Italian. Do NOT use English.'
      : 'Write in British English (programme, colour, travelling, organised).';

    let prompt;

    if (emailType === 'plaintext') {
      prompt = `You are an elite sales copywriter writing a personal 1-to-1 email on behalf of Angloville. You write like a top-performing salesperson who NEVER gives up — every email must make the reader feel that Angloville is the missing piece in their life. Not pushy. Not salesy. But deeply persuasive through genuine value, storytelling, and emotional connection.

BRAND CONTEXT:
${brand}

PROGRAMMES TO COVER:
${progList}

ADDITIONAL INSTRUCTIONS:
${extra || 'None'}

LANGUAGE RULE: ${langNote}

═══ COPYWRITING RULES (follow these strictly) ═══

SUBJECT LINE MASTERY:
- Max 50 characters — must be fully visible on mobile
- Write like a real person, NOT a brand. No "Newsletter #12" or "Angloville update"
- Use ONE of these proven high-open-rate formulas:
  • Curiosity gap: hint at something without revealing it ("I have an idea for your summer")
  • Question that demands an answer ("What if you could speak English in 7 days?")
  • Personal & direct: sounds like it came from a friend ("Quick thought about your plans")
  • Pattern interrupt: unexpected, breaks inbox monotony ("This isn't a typical email")
- NEVER use spam triggers: "free", "act now", "guaranteed", "!!!". No ALL CAPS words.
- Preheader must COMPLEMENT subject, not repeat it — together they tell a mini-story

PERSUASION FRAMEWORK (apply throughout the email):
1. OPEN WITH EMPATHY — show you understand the reader's world. Don't start with Angloville. Start with THEM.
2. PAINT THE TRANSFORMATION — help them SEE and FEEL what life looks like AFTER. Use sensory language.
3. SOCIAL PROOF — weave in proof naturally: "7000+ people have done this", "participants say…"
4. MAKE IT FEEL SCARCE AND REAL — limited spots, specific dates, real constraints. Never fake urgency.
5. SOFT CTA — not "BUY NOW" but an invitation: "I'd love to tell you more", "worth a look?"

TONE:
- This is a PERSONAL email — like a real human writing from their inbox
- No marketing buzzwords. No images. No buttons. No HTML formatting
- Conversational, warm, like emailing someone you genuinely want to help
- Short paragraphs (1-3 sentences each). Easy to scan on mobile
- The reader should finish thinking "this sounds amazing, I need to check this out"

CRITICAL: Make the reader feel that Angloville is something extraordinary that they would regret not exploring. Not through pressure — through genuine excitement and painted possibilities.

Return ONLY valid JSON, no markdown, no backticks.

{
  "subject": "curiosity-driven subject max 50 chars, sounds personal not branded",
  "subject_emoji": "same subject with 1 emoji max 55 chars",
  "greeting": "warm personal greeting",
  "body": "4-6 short paragraphs. Open with empathy about THEM. Paint the transformation. Weave in social proof. Mention programme naturally. End with soft invitation. Separate with newlines.",
  "cta": "soft CTA text for the link — an invitation, not a command",
  "closing": "warm human sign-off with first name,\\ne.g. Pozdrawiam,\\nKasia z Angloville",
  "ab1": "A/B subject variant A — different formula than main",
  "ab2": "A/B subject variant B — yet another angle",
  "send_time": "best send day/time with reason based on email marketing data"
}`;
    } else {
      prompt = `You are an elite email marketing copywriter and conversion specialist for Angloville. You write like the best salespeople in the world — you NEVER let the reader leave without feeling that Angloville is exactly what they need. Not through pressure — through irresistible value, storytelling, FOMO, and emotional connection.

Your emails consistently achieve 35%+ open rates and 8%+ click rates because you follow proven best practices from top brands.

BRAND CONTEXT:
${brand}

PROGRAMMES TO COVER:
${progList}

ADDITIONAL INSTRUCTIONS:
${extra || 'None'}

${imgNote}

LANGUAGE RULE: ${langNote}

═══ SUBJECT LINE MASTERY (this is the MOST critical element) ═══
- Max 50 characters — must be fully visible on mobile
- Use ONE of these proven high-open-rate formulas:
  • Curiosity gap: "Co się stanie, gdy..." / "You won't believe what happened in Italy"
  • FOMO/scarcity: "Ostatnie 5 miejsc" / "This won't be available again"
  • Question: "Mówisz po angielsku?" / "Ready for the summer of your life?"
  • Number + benefit: "7 dni do płynnego angielskiego" / "3 reasons to apply today"
  • Pattern interrupt: something unexpected that breaks inbox monotony
- NEVER use spam triggers: "free", "act now", "guaranteed", "!!!". No ALL CAPS words.
- Preheader must COMPLEMENT subject (not repeat it) — together they're a 1-2 punch
- A/B variants should test DIFFERENT psychological angles (curiosity vs FOMO vs question)

═══ EMAIL BODY — PERSUASION ARCHITECTURE ═══

HEADLINE: Powerful, benefit-driven. Max 70 chars. Should make the reader STOP scrolling. Use one of: transformation promise, provocative question, or bold claim with proof.

INTRO (2-3 sentences): 
- Start with the READER, not with Angloville. Show you understand their world.
- Use the "before" state — the frustration, the dream, the gap in their life
- Then hint at the solution (Angloville) without hard-selling

BODY_P1 (what they'll experience):
- Paint the TRANSFORMATION with sensory language — what does a day look like?
- Make them FEEL it: the conversations, the laughter, the food, the friendships
- This is not a feature list — it's a movie trailer of their future experience

BODY_P2 (emoji bullet points):
- 2-4 short punchy lines, each starting with a relevant emoji
- Each line = one concrete benefit that removes an objection or amplifies desire
- Use social proof where possible: "7000+ uczestników" / "4.8★ rating"
- Example format:
  🏡 70h rozmów 1:1 z native speakerami w 6 dni
  ✈️ Zakwaterowanie i wyżywienie w cenie
  🎓 Bez podręczników, bez klasy — 100% immersja

BODY_P3 (urgency + call to action):
- Create GENUINE urgency — real deadlines, limited spots, seasonal timing
- Use loss aversion: "don't miss" > "sign up". Frame what they LOSE by not acting
- End with a clear reason to click NOW, not "someday"

CTA BUTTONS:
- Primary: action-oriented, benefit-focused. NOT "Learn more" — instead "Zarezerwuj miejsce" / "See available dates"
- Secondary: lower commitment alternative. "Sprawdź program" / "Show me more"

PS LINE:
- Use as a "second chance" hook — many readers skip to PS first
- Add one more reason to act: bonus info, social proof stat, or deadline reminder

═══ CRITICAL MINDSET ═══
The reader's inbox has 50 other emails. Yours must be the one they CANNOT ignore.
Make them feel that Angloville is not just another programme — it's THE experience they've been waiting for.
Write as if the reader is your friend and you're genuinely excited to share something life-changing with them.
Never be generic. Never be boring. Every sentence must earn the right to the next sentence.

DATES TABLE: If the additional instructions mention ANY dates, terms, sessions, or time periods, you MUST generate a "dates_table" array. Each entry: "programme" (name), "dates" (date range), optionally "note" (e.g. "ostatnie 3 miejsca!", "early bird -15%"). If no dates mentioned, set to [].

OTHER OPTIONS SECTION: If additional instructions mention "inne opcje", "other options", "see also", "cross-sell", or similar — generate "other_options" array with 2-3 OTHER Angloville programmes (NOT the one being promoted). Each entry needs: "name" (programme name), "tagline" (catchy 5-8 word benefit), "product_url" (product page URL), "signup_url" (signup/apply page URL). Use real Angloville programme names and URLs based on market. If not requested, set to [].

AVAILABLE PROGRAMMES BY MARKET (use these for other_options):
- COM (English): Italy Junior (product: angloville.com/italy-junior/, signup: angloville.com/apply/), Poland Junior (angloville.com/poland-junior/), Malta Junior (angloville.com/malta-junior/), Poland Adult (angloville.com/poland-adult/), ESL Mentor (angloville.com/esl-mentor/)
- PL (Polish): Włochy Junior (product: angloville.pl/wlochy-junior/, signup: angloville.pl/zapisz-sie/), Polska Junior (angloville.pl/polska-junior/), Malta Junior (angloville.pl/malta-junior/), Anglia Roehampton (angloville.pl/anglia/), Obozy dla Dorosłych (angloville.pl/dla-doroslych/)
- IT (Italian): Italia Junior (product: angloville.it/italia-junior/, signup: angloville.it/iscriviti/), Polonia Junior (angloville.it/polonia-junior/), Malta Junior (angloville.it/malta-junior/), Londra (angloville.it/londra/)

Return ONLY valid JSON, no markdown, no backticks.

{
  "subject": "curiosity/FOMO subject max 50 chars, irresistible to open",
  "subject_emoji": "same with 1-2 emojis max 55 chars",
  "preheader": "complements subject, max 90 chars — together they're a 1-2 punch",
  "headline": "powerful benefit-driven headline max 70 chars",
  "intro": "2-3 sentences — start with THEM, not Angloville. Empathy + hint of solution",
  "body_p1": "2-3 sentences painting the transformation — sensory, emotional, cinematic",
  "body_p2": "2-4 emoji bullet lines — concrete benefits + social proof, separated by newlines",
  "body_p3": "2-3 sentences — genuine urgency, loss aversion, reason to act NOW",
  "cta": "primary CTA max 35 chars — action + benefit, not generic",
  "cta2": "secondary CTA max 35 chars — lower commitment alternative",
  "ps": "PS with one more hook — bonus, social proof stat, or deadline",
  "ab1": "A/B variant A — DIFFERENT psychological angle than main subject",
  "ab2": "A/B variant B — yet another angle (question vs FOMO vs curiosity)",
  "send_time": "best send day/time with data-backed reason",
  "dates_table": [{"programme":"Programme Name","dates":"21 Jun – 28 Jun 2026","note":"last spots!"}],
  "other_options": [{"name":"Programme Name","tagline":"Catchy benefit in 5-8 words","product_url":"https://angloville.pl/program/","signup_url":"https://angloville.pl/zapisz-sie/"}]
}`;
    }

    try {
      // Retry logic for overloaded API
      let aiData;
      let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] }),
        });
        aiData = await aiRes.json();
        
        if (aiRes.ok) break;
        
        // Check if overloaded - retry after delay
        if (aiData.error?.type === 'overloaded_error' || aiData.error?.message?.includes('overloaded')) {
          lastError = 'API przeciążone, próba ' + attempt + '/3...';
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 2000 * attempt)); // Wait 2s, 4s
            continue;
          }
        }
        throw new Error(aiData.error?.message || JSON.stringify(aiData) || 'Anthropic API error');
      }
      
      if (!aiData.content?.[0]?.text) throw new Error('AI zwróciło pustą odpowiedź. Spróbuj ponownie.');
      
      let raw = aiData.content[0].text;
      
      // Clean up response
      raw = raw.replace(/```json|```/g, '').trim();
      
      // Find JSON object in response in case there's extra text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI nie zwróciło poprawnego JSON. Odpowiedź: ' + raw.slice(0, 200));
      
      // Try to fix common JSON issues before parsing
      let jsonStr = jsonMatch[0];
      
      // Parse JSON with multiple fallback strategies
      let campaign;
      
      // Strategy 1: Direct parse
      try {
        campaign = JSON.parse(jsonStr);
      } catch (e1) {
        // Strategy 2: Replace newlines inside strings
        try {
          let cleaned = jsonStr
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
          
          // Fix newlines inside string values
          cleaned = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
            return match.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
          });
          
          campaign = JSON.parse(cleaned);
        } catch (e2) {
          // Strategy 3: Remove all control characters
          try {
            let aggressive = jsonStr
              .split('')
              .map(char => {
                const code = char.charCodeAt(0);
                if (code < 32 && code !== 9) return ' ';
                return char;
              })
              .join('')
              .replace(/\s+/g, ' ')
              .replace(/"\s*:\s*/g, '": ')
              .replace(/,\s*"/g, ', "')
              .replace(/{\s*"/g, '{"')
              .replace(/"\s*}/g, '"}');
            
            campaign = JSON.parse(aggressive);
          } catch (e3) {
            throw new Error('Błąd parsowania JSON: ' + e3.message + '. Fragment: ' + jsonStr.slice(0, 150).replace(/\n/g, '\\n'));
          }
        }
      }
      
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
        url:   item.secure_url,
        hero:  item.secure_url.replace('/upload/', '/upload/w_1140,h_751,c_fill,g_auto:faces,q_100,f_auto/'),
        body:  item.secure_url.replace('/upload/', '/upload/w_1140,h_450,c_fill,g_auto:faces,q_100,f_auto/'),
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

    const { campaign, cta_url, cta_url2, images, program_name, footer_html, social_html, dates_table_html } = body;
    const dc   = mcKey.split('-')[1] || 'us1';
    const imgs = images || [];
    const ctaUrl2 = cta_url2 || cta_url;
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
  <h1 style="margin:0;font-family:${FONT};font-size:28px;font-weight:900;line-height:115%;color:#111111;letter-spacing:-0.3px;">${campaign.headline}</h1>
</td></tr>`;

    const heroImg = imgs[0] ? `
<tr><td style="padding:20px 20px 0;line-height:0;">
  <img src="${imgs[0].heroUrl||imgs[0].thumb||imgs[0].url}" alt="" width="100%"
    style="display:block;width:100%;height:auto;border-radius:10px;object-fit:cover;border:0;">
</td></tr>` : '';

    const greetingLine = campaign.greetingHtml
      ? `<p style="margin:0 0 14px;font-size:17px;color:#111;font-family:${FONT};">${campaign.greetingHtml}</p>` : '';
    const introRow = `
<tr><td style="padding:20px 20px 0;font-family:${FONT};font-size:16px;line-height:170%;color:#333;">
  ${greetingLine}${safeHtml(campaign.intro)}
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

    const img2Row = imgs[1] ? img(imgs[1].bodyUrl||imgs[1].thumb||imgs[1].url) : '';

    const p2Row = `
<tr><td style="padding:20px 20px 0;font-family:${FONT};font-size:16px;line-height:160%;color:#1a1a1a;">
  ${bullets(campaign.body_p2)}
</td></tr>`;

    const img3Row = imgs[2] ? img(imgs[2].bodyUrl||imgs[2].thumb||imgs[2].url) : '';

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
      <a href="${ctaUrl2}" target="_blank"
        style="color:#FFFFFF;text-decoration:none;font-weight:800;font-family:${FONT};font-size:16px;display:block;white-space:nowrap;">${e(campaign.cta2||campaign.cta)}</a>
    </td></tr>
  </table>
</td></tr>`;

    const img4Row = imgs[3] ? img(imgs[3].bodyUrl||imgs[3].thumb||imgs[3].url) : '';

    const datesRow = dates_table_html || '';

    const socialRow = social_html || '';

    const dividerBeforeSocial = `
<tr><td style="padding:0 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="border-top:2px solid #EEEEEE;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>`;

    const rows = [logoBar,headlineRow,heroImg,introRow,cta1Row,p1Row,img2Row,p2Row,img3Row,p3Row,datesRow,psRow,cta2Row,img4Row,dividerBeforeSocial,socialRow].filter(Boolean).join('\n');

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

  // ── MAILCHIMP DRAFT — RAW HTML (for personal emails) ──
  if (body.action === 'mailchimp_draft_raw') {
    const mcKey  = process.env.MAILCHIMP_API_KEY;
    const mcList = process.env.MAILCHIMP_LIST_ID;
    if (!mcKey || !mcList) return res.status(200).json({ ok: true, draft_url: 'https://mailchimp.com', message: 'Mailchimp not configured' });

    const { html, subject, preheader, program_name } = body;
    const dc = mcKey.split('-')[1] || 'us1';

    try {
      const auth = 'Basic ' + Buffer.from('anystring:' + mcKey).toString('base64');
      const createRes = await fetch(`https://${dc}.api.mailchimp.com/3.0/campaigns`, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'regular',
          settings: {
            subject_line: subject || 'Personal email',
            preview_text: preheader || '',
            title: `[PERSONAL] ${program_name || 'Email'} – ${new Date().toLocaleDateString('en-GB')}`,
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
        body: JSON.stringify({ html }),
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
