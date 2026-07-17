import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from './_lib/devGuard.js';
import { supabaseRest, verifySupabaseToken } from './_lib/supabase.js';

const MAX_TEXT_BODY_CHARS = 600_000;
const MAX_VISION_BODY_CHARS = 4_000_000;

// The default is the Kimi Code OpenAI-compatible endpoint. If the borrowed key
// is a Platform key, set KIMI_API_ENDPOINT and KIMI_MODEL in Vercel instead.
const KIMI_API_ENDPOINT = process.env.KIMI_API_ENDPOINT
  || 'https://api.kimi.com/coding/v1/chat/completions';
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-for-coding';

function getBody(req: VercelRequest): Record<string, any> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body as Record<string, any>;
}

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { error: text || 'empty upstream response' }; }
}

function validImageDataUrl(value: unknown): value is string {
  return typeof value === 'string'
    && /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(value);
}

function kimiHeaders(apiKey: string): HeadersInit {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  try {
    await verifySupabaseToken(token);
  } catch {
    return res.status(401).json({ error: '登录状态已失效，请重新登录' });
  }

  const body = getBody(req);
  const mode = body.mode === 'vision' ? 'vision' : 'text';

  let rateResponse: Response;
  try {
    rateResponse = await supabaseRest(
      'rpc/consume_ai_import',
      {
        method: 'POST',
        body: JSON.stringify({
          p_max: mode === 'vision' ? 10 : 40,
          p_window_ms: 3_600_000,
        }),
      },
      token,
    );
    if (!rateResponse.ok) return res.status(503).json({ error: '限流服务暂时不可用，请稍后重试' });
    if (await rateResponse.json()) return res.status(429).json({ error: '分析请求过于频繁，请稍后再试' });
  } catch {
    return res.status(503).json({ error: '限流服务暂时不可用，请稍后重试' });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIMI_API_KEY is not configured' });

  if (mode === 'vision') {
    const image = body.image;
    const isWardrobeItemDraft = body.task === 'wardrobe_item_draft';
    const prompt = isWardrobeItemDraft
      ? '识别照片中最主要的一件衣物，只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。字段必须为：name（简短中文名称，无法判断时写“未命名衣物”）、category（只能是“上装”“下装”“鞋子”“配饰”之一）、brand（能看出时填写，否则为空字符串）、needsConfirmation（始终为 true）。不要猜测图片中看不见的品牌或细节。'
      : typeof body.prompt === 'string' && body.prompt.trim()
      ? body.prompt.trim()
      : '请分析这张图片的构图、色彩、材质、风格、情绪和值得注意的细节。用中文自然语言回答，先给出一句总结，再分点说明。不要把图片转换成衣物数据库字段。';

    if (!validImageDataUrl(image)) {
      return res.status(400).json({ error: 'image must be a base64 data URL in jpeg, png, webp, or gif format' });
    }
    if (JSON.stringify({ image, prompt }).length > MAX_VISION_BODY_CHARS) {
      return res.status(413).json({ error: '图片过大，请使用更小的图片' });
    }

    const aiRes = await fetch(KIMI_API_ENDPOINT, {
      method: 'POST',
      headers: kimiHeaders(apiKey),
      body: JSON.stringify({
        model: KIMI_MODEL,
        max_tokens: Number(process.env[isWardrobeItemDraft ? 'KIMI_ITEM_DRAFT_MAX_TOKENS' : 'KIMI_IMAGE_MAX_TOKENS'] || (isWardrobeItemDraft ? 256 : 4096)),
        messages: [
          { role: 'system', content: '你是一个克制、敏锐的视觉分析助手。只分析图片中可见的信息，不臆测不可见事实。' },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });
    return res.status(aiRes.status).json(await readJsonResponse(aiRes));
  }

  const messages = body.messages;
  if (!messages) return res.status(400).json({ error: 'messages required' });
  if (JSON.stringify(messages).length > MAX_TEXT_BODY_CHARS) {
    return res.status(413).json({ error: '内容过长，请分批导入' });
  }

  // Kept for backwards compatibility with the old text-import UI. It now uses
  // the configured Kimi model instead of the obsolete Claude Sonnet relay.
  const aiRes = await fetch(KIMI_API_ENDPOINT, {
    method: 'POST',
    headers: kimiHeaders(apiKey),
    body: JSON.stringify({ model: KIMI_MODEL, max_tokens: 16_384, messages }),
  });
  return res.status(aiRes.status).json(await readJsonResponse(aiRes));
}
