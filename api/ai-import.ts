import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { base64, mimeType, messages } = req.body;

  let textContent: string | undefined;

  // If PDF sent as base64, extract text server-side (no worker needed)
  if (base64 && mimeType === 'application/pdf') {
    const buffer = Buffer.from(base64, 'base64');
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf.getPage(i + 1)
          .then(p => p.getTextContent())
          .then(c => c.items.map((it: any) => it.str).join(' '))
      )
    );
    textContent = pages.join('\n');
  }

  const prompt = `从以下文档中提取衣物信息，以 JSON 数组返回，每个对象包含：name（字符串）、rating（1-10的数字）、category（"上装"/"下装"/"鞋子"/"配饰" 之一）、season（"春季"/"秋季"/"春秋"/"夏季"/"冬季"/"四季" 之一）、story（描述或故事）。注意：输出必须是合法的 JSON 格式，严禁在对象末尾添加多余逗号，严禁添加任何 Markdown 标签，直接以 '[' 开始输出。\n\n${textContent ?? ''}`;

  const finalMessages = textContent
    ? [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
    : messages;

  const aiRes = await fetch('https://api.kimi.com/coding/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 4096, messages: finalMessages }),
  });

  const data = await aiRes.json();
  return res.status(aiRes.status).json(data);
}
