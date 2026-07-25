/* ============================================================
   AI ENGINE — free Hugging Face Inference Providers router
   (OpenAI-compatible chat completions endpoint)

   Builds the prompt, calls the model with automatic fallback
   across models/providers, parses the response into a
   structured campaign object, and GUARANTEES every mandatory
   section (personas, ad copy, keywords, budget, schedule) is
   present and correctly shaped — even if the model returns
   malformed JSON or the request fails outright. Missing or
   short sections are backfilled deterministically from the
   product description so the required output is never empty.
   ============================================================ */

function buildPrompt(productDescription, excelInsights){
  const researchBlock = excelInsights
    ? `\nAdditional market research data uploaded by the user (use it to sharpen targeting, keywords, and budget):\n${excelInsights.slice(0, 3500)}\n`
    : "";

  return `You are a senior performance marketing strategist. Based on the product/offer below, generate a complete marketing campaign.
${researchBlock}
Product / Offer:
"""${productDescription}"""

Respond with ONLY a single valid JSON object (no markdown fences, no commentary, no preamble, no text after the JSON) matching EXACTLY this schema:

{
  "personas": [
    {"name": "string", "age_range": "string", "summary": "2-3 sentence description of who they are, their pain points and motivations"}
  ],
  "ad_copy": {
    "facebook": ["version 1 ad copy", "version 2 ad copy"],
    "instagram": ["version 1 ad copy", "version 2 ad copy"],
    "google": ["version 1 headline + description", "version 2 headline + description"],
    "twitter": ["version 1 ad copy", "version 2 ad copy"]
  },
  "keywords": {
    "high_intent": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "long_tail": ["long tail keyword phrase 1", "long tail keyword phrase 2", "long tail keyword phrase 3", "long tail keyword phrase 4"]
  },
  "budget": {
    "daily": "string with $ amount",
    "weekly": "string with $ amount",
    "monthly": "string with $ amount",
    "channel_split": [
      {"channel": "string", "percent": "string", "reasoning": "short reason"}
    ]
  },
  "schedule": [
    {"day": 1, "focus": "short description of what to publish/do that day"}
  ]
}

Rules:
- Exactly 3 personas.
- Exactly 2 ad copy versions per platform for facebook, instagram, google, twitter.
- At least 5 high_intent keywords and 4 long_tail keywords.
- schedule must contain exactly 30 entries, day 1 through day 30.
- Output valid JSON only. Do not wrap it in backticks. Do not add any text before or after the JSON.`;
}

/* ---------- Calling Hugging Face's router (OpenAI-compatible) ---------- */

async function queryHFModel(modelId, prompt){
  const response = await fetch(HF_API_BASE, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HUGGING_FACE_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.7,
      top_p: 0.9
    })
  });

  if (!response.ok){
    const errText = await response.text().catch(() => "");
    throw new Error(`${modelId} → HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${modelId} → empty response`);
  return content;
}

async function callHuggingFaceWithFallback(prompt, onStatus){
  let lastError;
  for (const modelId of HF_MODELS){
    try{
      onStatus?.(`Calling ${modelId.split("/")[1] || modelId}…`);
      const text = await queryHFModel(modelId, prompt);
      return text;
    } catch(err){
      lastError = err;
      console.warn(`Model ${modelId} failed:`, err.message);
    }
  }
  throw lastError || new Error("All models failed.");
}

/* Extracts the first valid JSON object from a blob of model text */
function extractJSON(text){
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try{
    return JSON.parse(candidate);
  } catch(e){
    try{
      const repaired = candidate.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(repaired);
    } catch(e2){
      return null;
    }
  }
}

/* ============================================================
   GUARANTEED OUTPUT — fills in any missing/short mandatory
   section deterministically from the product description, so
   the five required deliverables are ALWAYS fully populated
   regardless of what (if anything) the model returned.
   ============================================================ */

function extractKeywordsFromText(description, count){
  const stop = new Set(["that","this","with","from","your","their","have","will","about","into","which","they","them","been","were","when","what","offer","product","service"]);
  const words = (description.toLowerCase().match(/[a-z]{4,}/g) || [])
    .filter(w => !stop.has(w));
  const unique = [...new Set(words)];
  return unique.slice(0, count);
}

function normalizeCampaign(parsed, productDescription){
  const p = parsed && typeof parsed === "object" ? { ...parsed } : {};
  const coreWords = extractKeywordsFromText(productDescription, 6);
  const topic = coreWords.slice(0, 3).join(" ") || "this product";
  let filled = false;
  const mark = () => { filled = true; };

  // ---- Personas (exactly 3) ----
  const personaTemplates = [
    { name: "The Convenience Seeker", age_range: "25–34", summary: `Busy and time-poor, drawn to ${topic} because it removes friction from their routine. Values speed and reliability over price.` },
    { name: "The Quality-Conscious Buyer", age_range: "30–45", summary: `Researches before buying and wants proof ${topic} delivers on its promise. Motivated by trust signals, reviews, and clear guarantees.` },
    { name: "The Aspirational Upgrader", age_range: "22–29", summary: `Wants ${topic} as part of a better lifestyle or self-image. Responsive to social proof and visually driven content.` }
  ];
  let personas = Array.isArray(p.personas) ? p.personas.filter(x => x && typeof x === "object") : [];
  if (personas.length < 3){ mark(); }
  while (personas.length < 3) personas.push(personaTemplates[personas.length]);
  personas = personas.slice(0, 3).map((per, i) => ({
    name: per.name || personaTemplates[i].name,
    age_range: per.age_range || personaTemplates[i].age_range,
    summary: per.summary || personaTemplates[i].summary
  }));
  p.personas = personas;

  // ---- Ad copy (2 versions × 4 platforms) ----
  const platforms = ["facebook", "instagram", "google", "twitter"];
  const adFallback = {
    facebook: [`Discover ${topic} — made for people who want results without the hassle. Tap to learn more.`, `Tired of settling? ${productDescription.slice(0, 90)}. See why customers switch.`],
    instagram: [`✨ ${topic}, reimagined. Swipe up to see what everyone's talking about.`, `This is your sign to try ${topic}. Link in bio.`],
    google: [`${topic} | Official Site — Get started today. Trusted by real customers, fast setup, no hidden fees.`, `Best ${topic} 2026 — Compare features, pricing, and reviews before you buy.`],
    twitter: [`${topic} just got easier. Here's why people are switching →`, `We built ${topic} for people who don't have time to waste. Try it today.`]
  };
  p.ad_copy = p.ad_copy && typeof p.ad_copy === "object" ? { ...p.ad_copy } : {};
  platforms.forEach((platform) => {
    let versions = Array.isArray(p.ad_copy[platform]) ? p.ad_copy[platform].filter(Boolean) : [];
    if (versions.length < 2){ mark(); }
    while (versions.length < 2) versions.push(adFallback[platform][versions.length]);
    p.ad_copy[platform] = versions.slice(0, 2);
  });

  // ---- Keywords ----
  p.keywords = p.keywords && typeof p.keywords === "object" ? { ...p.keywords } : {};
  let highIntent = Array.isArray(p.keywords.high_intent) ? p.keywords.high_intent.filter(Boolean) : [];
  let longTail = Array.isArray(p.keywords.long_tail) ? p.keywords.long_tail.filter(Boolean) : [];
  const hiFallback = [...coreWords.map(w => `buy ${w}`), `best ${topic}`, `${topic} price`, `${topic} near me`];
  const ltFallback = [`how to choose the best ${topic}`, `${topic} for beginners`, `is ${topic} worth it`, `${topic} reviews and pricing 2026`];
  if (highIntent.length < 5){ mark(); }
  while (highIntent.length < 5) highIntent.push(hiFallback[highIntent.length % hiFallback.length]);
  if (longTail.length < 4){ mark(); }
  while (longTail.length < 4) longTail.push(ltFallback[longTail.length % ltFallback.length]);
  p.keywords.high_intent = [...new Set(highIntent)].slice(0, Math.max(5, highIntent.length));
  p.keywords.long_tail = [...new Set(longTail)].slice(0, Math.max(4, longTail.length));

  // ---- Budget ----
  const budgetFallback = {
    daily: "$25–$40",
    weekly: "$175–$280",
    monthly: "$750–$1,200",
    channel_split: [
      { channel: "Facebook", percent: "30%", reasoning: "Broad reach and strong retargeting for warm audiences." },
      { channel: "Instagram", percent: "25%", reasoning: "Visual storytelling drives engagement with younger segments." },
      { channel: "Google", percent: "30%", reasoning: "Captures high-intent search demand." },
      { channel: "X / Twitter", percent: "15%", reasoning: "Low-cost awareness and real-time engagement." }
    ]
  };
  p.budget = p.budget && typeof p.budget === "object" ? { ...p.budget } : {};
  if (!p.budget.daily){ p.budget.daily = budgetFallback.daily; mark(); }
  if (!p.budget.weekly){ p.budget.weekly = budgetFallback.weekly; mark(); }
  if (!p.budget.monthly){ p.budget.monthly = budgetFallback.monthly; mark(); }
  if (!Array.isArray(p.budget.channel_split) || p.budget.channel_split.length === 0){
    p.budget.channel_split = budgetFallback.channel_split;
    mark();
  }

  // ---- 30-day schedule ----
  const scheduleCycle = [
    "Product highlight post", "Customer testimonial / social proof", "Behind-the-scenes content",
    "Educational tip related to the product", "Limited-time offer teaser", "User-generated content repost",
    "Engagement poll or question", "Founder / brand story moment", "Comparison or 'why us' post", "Retargeting ad push"
  ];
  let schedule = Array.isArray(p.schedule) ? p.schedule.filter(x => x && x.day) : [];
  if (schedule.length < 30){ mark(); }
  const byDay = new Map(schedule.map(s => [Number(s.day), s.focus]));
  const fullSchedule = [];
  for (let day = 1; day <= 30; day++){
    fullSchedule.push({
      day,
      focus: byDay.get(day) || `${scheduleCycle[(day - 1) % scheduleCycle.length]} across primary channels.`
    });
  }
  p.schedule = fullSchedule;

  return { campaign: p, wasBackfilled: filled };
}

async function generateCampaign(productDescription, excelInsights, onStatus){
  const prompt = buildPrompt(productDescription, excelInsights);
  let rawText = "";
  let aiError = null;

  try{
    rawText = await callHuggingFaceWithFallback(prompt, onStatus);
  } catch(err){
    aiError = err;
    console.warn("All Hugging Face models failed, using guaranteed fallback content:", err.message);
  }

  const parsed = rawText ? extractJSON(rawText) : null;
  const { campaign, wasBackfilled } = normalizeCampaign(parsed, productDescription);

  return { campaign, rawText, aiError, wasBackfilled };
}
