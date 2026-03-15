// /api/chat.js — Clario secure Claude API proxy
// The ANTHROPIC_API_KEY env variable is set in Vercel dashboard
// It is NEVER exposed to the browser

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic origin check — only allow requests from your domain
  const origin = req.headers.origin || '';
  const allowed = [
    'https://clarioai.ae',
    'https://www.clarioai.ae',
    'https://clario-alpha.vercel.app',
    'http://localhost:3000',   // local dev
    'http://127.0.0.1:5500',  // VS Code Live Server
  ];
  if (origin && !allowed.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { messages, system, max_tokens = 1000 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(response.status).json({ error: 'API error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
