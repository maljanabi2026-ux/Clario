// /api/zodiac.js — Generate daily zodiac cards for a user
// Called by the frontend when cards are needed
// In production: called by cron job at 4am, cached in Supabase

const CARD_PROMPTS = {
  fortune: (sign, date) => `You are writing a Fortune card for a ${sign} user. Today is ${date}.
Write a wealth and opportunity insight in exactly 2 sentences. Be specific and actionable.
Include a time reference like "before Thursday" or "this week".
Score their fortune today from 1 to 5. Never use vague phrases like "the universe is aligning".
Output valid JSON only: {"text":"...","score":N,"highlight":"one key phrase"}`,

  love: (sign, date) => `You are writing a Love card for a ${sign} user. Today is ${date}.
Write a connection and relationships insight in exactly 2 sentences.
Can reference romantic partner, family, or close friendships — do not assume which.
Score their love energy today from 1 to 5. Tone: warm, perceptive, never prescriptive.
Output valid JSON only: {"text":"...","score":N,"highlight":"one key phrase"}`,

  future: (sign, date) => `You are writing a Future card for a ${sign} user. Today is ${date}.
Write a path and direction insight in exactly 2 sentences. Speak to the next 7 to 30 days.
Score their future alignment from 1 to 5. Tone: expansive, purposeful, not vague.
Output valid JSON only: {"text":"...","score":N,"highlight":"one key phrase"}`,

  luck: (sign, date) => `You are writing a Luck card for a ${sign} user. Today is ${date}.
Write a timing and energy insight in exactly 2 sentences.
Include a lucky hour range, a lucky colour, and a specific planet or transit note.
Score their luck today from 1 to 5.
Output valid JSON only: {"text":"...","score":N,"lucky_hour":"Xam-Ypm","lucky_colour":"...","planet":"..."}`,

  health: (sign, date) => `You are writing a Health card for a ${sign} user. Today is ${date}.
Write a vitality and energy insight in exactly 2 sentences.
Recommend one focus area: rest, movement, nutrition timing, or mental clarity.
Score their health energy today from 1 to 5. Positive framing only.
NEVER reference medical conditions, medications, symptoms, or diagnoses of any kind.
Output valid JSON only: {"text":"...","score":N,"focus_area":"..."}`,

  master: (sign, date, cards) => `You are writing the Day Master Card for a ${sign} user. Today is ${date}.
Their 5 individual card results: ${JSON.stringify(cards)}

Write a comprehensive daily reading of 200 to 300 words in flowing prose — not bullet points.
Structure: opening planetary note for ${sign} today, then weave all 5 cards into a unified narrative,
flag any confluences between cards where two or more point in the same direction,
close with one specific action for today and a brief closing thought.
Voice: warm, precise, like a trusted advisor speaking directly to this person.
Never use generic horoscope language. Never be vague.
Output valid JSON only: {"text":"...","headline":"12 words max summarising the day","daily_action":"one specific sentence"}`
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { sign, date } = req.body;
  if (!sign || !date) return res.status(400).json({ error: 'sign and date required' });

  async function generateCard(type, extraData) {
    const prompt = type === 'master'
      ? CARD_PROMPTS.master(sign, date, extraData)
      : CARD_PROMPTS[type](sign, date);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Use Haiku for card generation — faster + cheaper
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    const text = data.content[0].text.trim();

    try {
      return JSON.parse(text);
    } catch {
      // Strip markdown fences if present
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    }
  }

  try {
    // Generate 5 individual cards
    const [fortune, love, future, luck, health] = await Promise.all([
      generateCard('fortune'),
      generateCard('love'),
      generateCard('future'),
      generateCard('luck'),
      generateCard('health'),
    ]);

    // Generate Day Master Card using all 5 results
    const master = await generateCard('master', { fortune, love, future, luck, health });

    return res.status(200).json({
      sign,
      date,
      generatedAt: new Date().toISOString(),
      cards: { fortune, love, future, luck, health, master }
    });

  } catch (err) {
    console.error('Zodiac generation error:', err);
    return res.status(500).json({ error: 'Card generation failed', detail: err.message });
  }
}
