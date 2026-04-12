import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractText, getDocumentProxy } from 'unpdf';

const PROMPT = `从以下文档中提取衣物信息，以 JSON 数组返回，每个对象包含：name（字符串）、rating（1-10的数字）、category（"上装"/"下装"/"鞋子"/"配饰" 之一）、season（"春季"/"秋季"/"春秋"/"夏季"/"冬季"/"四季" 之一）、story（描述或故事）。注意：输出必须是合法的 JSON 格式，严禁在对象末尾添加多余逗号，严禁添加任何 Markdown 标签，直接以 '[' 开始输出。`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { base64, mimeType, messages } = req.body;

  let finalMessages = messages;

  if (base64 && mimeType === 'application/pdf') {
    try {
      const buffer = Buffer.from(base64, 'base64');
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'PDF 文字提取失败：文档内可能为图片或扫描件' });
      }
      finalMessages = [{
        role: 'user',
        content: [{ type: 'text', text: `${PROMPT}\n\n以下是文档内容：\n\n${text}` }],
      }];
    } catch (err: any) {
      return res.status(500).json({ error: `PDF 解析失败: ${err?.message || String(err)}` });
    }
  }

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
