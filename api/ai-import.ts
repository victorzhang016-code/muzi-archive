import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages required' });

  const aiRes = await fetch('https://api.kimi.com/coding/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 16384, messages }),
  });

  const data = await aiRes.json();
  return res.status(aiRes.status).json(data);
}
