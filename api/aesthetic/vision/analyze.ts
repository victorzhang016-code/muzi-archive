import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from '../../_lib/devGuard.js';
import { supabaseRest, verifySupabaseToken } from '../../_lib/supabase.js';

const MAX_BODY_CHARS = 4_000_000;
const KIMI_API_ENDPOINT = process.env.KIMI_API_ENDPOINT
  || 'https://api.kimi.com/coding/v1/chat/completions';
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-for-coding';

function bodyOf(req: VercelRequest): Record<string, any> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body as Record<string, any>;
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string'
    && /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(value);
}

function jsonFromContent(value: unknown): Record<string, any> | null {
  if (typeof value !== 'string') return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? value;
  const first = fenced.indexOf('{');
  const last = fenced.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try {
    const parsed = JSON.parse(fenced.slice(first, last + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function intChannel(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(255, Math.max(0, Math.round(number))) : 0;
}

function normalizePayload(raw: Record<string, any>) {
  const tags = (value: unknown) => Array.isArray(value)
    ? value.map((entry) => {
      if (typeof entry === 'string') return { value: entry, confidence: 0.5, evidence: '' };
      return {
        value: String(entry?.value ?? entry?.tag ?? '').trim(),
        confidence: Math.min(1, Math.max(0, Number(entry?.confidence ?? 0.5))),
        evidence: String(entry?.evidence ?? '').trim(),
      };
    }).filter((entry) => entry.value)
    : [];
  const colors = Array.isArray(raw.dominantColors) ? raw.dominantColors : [];
  return {
    silhouetteTags: tags(raw.silhouetteTags),
    materialTags: tags(raw.materialTags),
    patternTags: tags(raw.patternTags),
    styleTags: tags(raw.styleTags),
    designHighlights: tags(raw.designHighlights),
    visualWeight: raw.visualWeight ? {
      value: String(raw.visualWeight.value ?? raw.visualWeight).trim(),
      confidence: Math.min(1, Math.max(0, Number(raw.visualWeight.confidence ?? 0.5))),
      evidence: String(raw.visualWeight.evidence ?? '').trim(),
    } : null,
    formality: raw.formality ? {
      value: String(raw.formality.value ?? raw.formality).trim(),
      confidence: Math.min(1, Math.max(0, Number(raw.formality.confidence ?? 0.5))),
      evidence: String(raw.formality.evidence ?? '').trim(),
    } : null,
    dominantColors: colors.map((color) => {
      const rgb = Array.isArray(color?.rgb) ? color.rgb : [color?.r, color?.g, color?.b];
      const channels = [intChannel(rgb[0]), intChannel(rgb[1]), intChannel(rgb[2])] as [number, number, number];
      return {
        rgb: channels,
        hex: `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
        role: ['dominant', 'secondary', 'accent'].includes(color?.role) ? color.role : 'dominant',
        areaRatio: Math.min(1, Math.max(0, Number(color?.areaRatio ?? 0))),
        region: ['garment', 'trim', 'pattern', 'unknown'].includes(color?.region) ? color.region : 'unknown',
        confidence: Math.min(1, Math.max(0, Number(color?.confidence ?? 0.5))),
        source: 'vision_model' as const,
      };
    }).slice(0, 6),
  };
}

async function readJson(response: Response): Promise<any> {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { error: text || 'empty upstream response' }; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  let user: { id: string };
  try { user = await verifySupabaseToken(token) as { id: string }; }
  catch { return res.status(401).json({ error: '登录状态已失效，请重新登录' }); }

  const body = bodyOf(req);
  const image = body.image;
  if (!isImageDataUrl(image)) return res.status(400).json({ error: 'image must be a base64 image data URL' });
  if (JSON.stringify(body).length > MAX_BODY_CHARS) return res.status(413).json({ error: '图片过大，请使用压缩后的图片' });

  const consentResponse = await supabaseRest(
    `aesthetic_vision_consents?owner_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&select=owner_id&limit=1`,
    {},
    token,
  );
  if (!consentResponse.ok || !(await consentResponse.json())?.length) {
    return res.status(403).json({ error: '请先在审美实验台中同意图片识别' });
  }

  try {
    const rateResponse = await supabaseRest(
      'rpc/consume_ai_import',
      { method: 'POST', body: JSON.stringify({ p_max: 10, p_window_ms: 3_600_000 }) },
      token,
    );
    if (!rateResponse.ok) return res.status(503).json({ error: '分析限流服务暂时不可用' });
    if (await rateResponse.json()) return res.status(429).json({ error: '图片分析请求过于频繁，请稍后再试' });
  } catch {
    return res.status(503).json({ error: '分析限流服务暂时不可用' });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'KIMI_API_KEY is not configured' });

  const prompt = `你是衣LOG的服装视觉分析器。只根据图片中可见的服装事实进行判断，不猜测品牌、故事、身份和图片外的信息。只返回 JSON，不要 Markdown，不要解释。JSON 必须包含：
silhouetteTags、materialTags、patternTags、styleTags、designHighlights：数组，每项为 {"value": string, "confidence": 0到1, "evidence": string}；
designHighlights 只提取可见且具体的设计细节，例如特殊口袋、拼接、褶裥、裁片、扣件、缝线、标志性装饰或功能结构，不要输出泛泛的审美评价；
visualWeight、formality：对象 {"value": string, "confidence": 0到1, "evidence": string}，无法判断时为 null；
dominantColors：数组，每项为 {"rgb": [0到255整数, 0到255整数, 0到255整数], "role": "dominant|secondary|accent", "areaRatio": 0到1, "region": "garment|trim|pattern|unknown", "confidence": 0到1}。
颜色 RGB 必须表示服装本身的近似像素颜色。背景、皮肤和环境不计入服装主色。最多返回 6 个颜色。${typeof body.itemName === 'string' ? `单品名称仅供定位：${body.itemName}` : ''}`;

  const upstream = await fetch(KIMI_API_ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: KIMI_MODEL,
      max_tokens: Number(process.env.KIMI_IMAGE_MAX_TOKENS || 4096),
      messages: [
        { role: 'system', content: '只输出符合要求的 JSON。' },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: prompt }] },
      ],
    }),
  });
  const response = await readJson(upstream);
  if (!upstream.ok) return res.status(upstream.status).json(response);

  const content = response?.choices?.[0]?.message?.content
    ?? response?.choices?.[0]?.text
    ?? response?.output_text;
  const raw = jsonFromContent(content);
  if (!raw) return res.status(502).json({ error: '视觉模型未返回可解析的 JSON', raw: String(content ?? '') });
  return res.status(200).json({ modelVersion: KIMI_MODEL, payload: normalizePayload(raw) });
}
