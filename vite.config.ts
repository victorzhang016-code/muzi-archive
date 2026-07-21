import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {defineConfig, loadEnv, type Connect, type Plugin} from 'vite';

type VisionTag = {
  value: string;
  confidence: number;
  evidence: string;
};

type VisionPayload = {
  dominantColors: Array<{
    rgb: [number, number, number];
    hex: string;
    role: string;
    areaRatio: number;
    region: string;
    confidence: number;
  }>;
  silhouetteTags: VisionTag[];
  materialTags: VisionTag[];
  patternTags: VisionTag[];
  styleTags: VisionTag[];
  designHighlights: VisionTag[];
  visualWeight: {value: string; confidence: number; evidence: string} | null;
  formality: {value: string; confidence: number; evidence: string} | null;
  notes: string[];
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeTag = (value: unknown): VisionTag | null => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? {value: text, confidence: 0.5, evidence: ''} : null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const text = asText(record.value || record.label || record.tag);
  return text
    ? {
        value: text,
        confidence: clamp(record.confidence, 0, 1, 0.5),
        evidence: asText(record.evidence),
      }
    : null;
};

const normalizeTags = (value: unknown) =>
  Array.isArray(value)
    ? value.map(normalizeTag).filter((tag): tag is VisionTag => Boolean(tag)).slice(0, 12)
    : [];

const normalizeRgb = (value: unknown): [number, number, number] | null => {
  if (!Array.isArray(value) || value.length < 3) return null;
  return [
    Math.round(clamp(value[0], 0, 255, 0)),
    Math.round(clamp(value[1], 0, 255, 0)),
    Math.round(clamp(value[2], 0, 255, 0)),
  ];
};

const rgbToHex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

const normalizeColors = (value: unknown): VisionPayload['dominantColors'] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const rgb = normalizeRgb(record.rgb || record.RGB || record.color);
      if (!rgb) return null;
      return {
        rgb,
        hex: rgbToHex(rgb),
        role: asText(record.role) || '主色',
        areaRatio: clamp(record.areaRatio, 0, 1, 0),
        region: asText(record.region),
        confidence: clamp(record.confidence, 0, 1, 0.5),
      };
    })
    .filter((color): color is VisionPayload['dominantColors'][number] => Boolean(color))
    .slice(0, 6);
};

const normalizeScale = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const text = asText(record.value || record.label);
  return text
    ? {value: text, confidence: clamp(record.confidence, 0, 1, 0.5), evidence: asText(record.evidence)}
    : null;
};

const extractJson = (content: unknown) => {
  if (typeof content !== 'string') return null;
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

const readJsonBody = async (req: IncomingMessage, maxBytes = 8 * 1024 * 1024) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error('请求图片过大，本地实验单次最多 8MB');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
};

const sendJson = (res: ServerResponse, status: number, payload: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const toImageDataUrl = async (input: unknown) => {
  const value = asText(input);
  if (!value) return '';
  if (value.startsWith('data:image/')) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(url.protocol)) return '';
  const response = await fetch(url, {redirect: 'error'});
  if (!response.ok) throw new Error(`图片读取失败（${response.status}）`);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new Error('图片地址返回的不是图片');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error('远程图片超过 8MB');
  return `data:${contentType};base64,${bytes.toString('base64')}`;
};

const createLocalVisionPlugin = (env: Record<string, string>): Plugin => ({
  name: 'wearlog-local-aesthetic-vision',
  configureServer(server) {
    const middleware: Connect.NextHandleFunction = async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/api/local/aesthetic/vision') {
        next();
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, {error: '仅支持 POST'});
        return;
      }
      const apiKey = String(env.KIMI_API_KEY || '').trim();
      if (!apiKey) {
        sendJson(res, 503, {error: '本地读图服务未配置 KIMI_API_KEY，请在 .env.local 设置'});
        return;
      }
      try {
        const body = await readJsonBody(req);
        const image = await toImageDataUrl(body.image || body.imageUrl);
        if (!image) {
          sendJson(res, 400, {error: '请提供 data URL 或 http(s) 图片地址'});
          return;
        }
        const endpoint = String(env.KIMI_API_ENDPOINT || 'https://api.kimi.com/coding/v1/chat/completions').trim();
        const model = String(env.KIMI_MODEL || 'kimi-for-coding').trim();
        const refineMode = body.mode === 'refine';
        const refineField = asText(body.field) || 'materialTags';
        const refineCorrection = asText(body.correction);
        const prompt = refineMode
          ? `你是衣 log 的服装字段校正助手。请重新观察图片，并认真听取用户的人工概括。用户明确指出的方向优先，但不要把用户的模糊词直接伪装成精确事实。请给出 3 到 6 个适合保存为标签的候选词，从宽到窄排列，每项包含 value、confidence、evidence。只返回 JSON：{"suggestions":[{"value":"","confidence":0.0,"evidence":""}]}。当前需要校正的字段是 ${refineField}。用户的人工概括是：「${refineCorrection || '用户认为原识别不准确，请重新观察'}」。图片只作为辅助证据，不能猜测品牌或不可见信息。不要输出 Markdown。`
          : `你是衣 log 的服装视觉字段提取器。只依据图片中可见的服装本身输出 JSON，不猜测品牌、人物身份、背景或不可见信息。请使用简体中文。颜色必须给出 0-255 的 RGB 数组。字段必须完整存在：
{
  "dominantColors": [{"rgb":[0,0,0],"role":"主色|辅色|点缀色","areaRatio":0.0,"region":"","confidence":0.0}],
  "silhouetteTags": [{"value":"","confidence":0.0,"evidence":""}],
  "materialTags": [{"value":"","confidence":0.0,"evidence":""}],
  "patternTags": [{"value":"","confidence":0.0,"evidence":""}],
  "styleTags": [{"value":"","confidence":0.0,"evidence":""}],
  "designHighlights": [{"value":"","confidence":0.0,"evidence":""}],
  "visualWeight": {"value":"轻盈|中等|厚重","confidence":0.0,"evidence":""},
  "formality": {"value":"休闲|日常|正式","confidence":0.0,"evidence":""},
  "notes": ["可验证的观察"]
}
其中 designHighlights 只提取可见且具体的设计亮点，例如特殊口袋、拼接、褶裥、裁片、扣件、缝线、标志性装饰或功能结构；不要把泛泛的“好看”“高级”当作设计亮点。无法判断时使用空数组或 null。不要输出 Markdown。`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
          body: JSON.stringify({
            model,
            max_tokens: Number(env.KIMI_IMAGE_MAX_TOKENS || 4096),
            messages: [
              {role: 'system', content: '只输出符合要求的 JSON。'},
              {role: 'user', content: [{type: 'image_url', image_url: {url: image}}, {type: 'text', text: prompt}]},
            ],
          }),
        });
        const raw = await response.text();
        if (response.status === 401 || response.status === 403) {
          sendJson(res, 503, {error: 'KIMI_API_KEY 无效或已过期；当前已降级为本地 RGB 像素分析'});
          return;
        }
        if (!response.ok) throw new Error(`读图服务返回 ${response.status}`);
        const parsed = JSON.parse(raw) as Record<string, any>;
        const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.text || parsed.output_text;
        const json = extractJson(content);
        if (!json) throw new Error('读图服务返回无法解析的字段');
        if (refineMode) {
          sendJson(res, 200, {modelVersion: model, suggestions: normalizeTags(json.suggestions || json.candidates)});
          return;
        }
        const payload: VisionPayload = {
          dominantColors: normalizeColors(json.dominantColors),
          silhouetteTags: normalizeTags(json.silhouetteTags),
          materialTags: normalizeTags(json.materialTags),
          patternTags: normalizeTags(json.patternTags),
          styleTags: normalizeTags(json.styleTags),
          designHighlights: normalizeTags(json.designHighlights),
          visualWeight: normalizeScale(json.visualWeight),
          formality: normalizeScale(json.formality),
          notes: Array.isArray(json.notes) ? json.notes.map(asText).filter(Boolean).slice(0, 8) : [],
        };
        sendJson(res, 200, {modelVersion: model, payload});
      } catch (error) {
        sendJson(res, 502, {error: error instanceof Error ? error.message : '本地读图失败'});
      }
    };
    server.middlewares.use(middleware);
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // Vercel Preview and Production both run a production Vite build. Fail at
  // build time if the browser bundle is about to receive the wrong Supabase
  // environment; the runtime guard remains the second line of defence.
  if (process.env.VERCEL === '1') {
    const deployment = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
    const declaredDeployment = String(env.VITE_VERCEL_ENV || '').trim().toLowerCase();
    const declaredSupabase = String(env.VITE_SUPABASE_ENV || '').trim().toLowerCase();
    const expectedSupabase = deployment === 'production' ? 'production' : 'development';
    if (!deployment || declaredDeployment !== deployment || declaredSupabase !== expectedSupabase) {
      throw new Error(
        `[env] Vercel environment mismatch: VITE_VERCEL_ENV=${declaredDeployment || '(missing)'} `
        + `VERCEL_ENV=${deployment || '(missing)'}, VITE_SUPABASE_ENV=${declaredSupabase || '(missing)'}. `
        + 'Set Production to production/production and Preview to preview/development.'
      );
    }
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('[env] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required on Vercel.');
    }
  }

  return {
    plugins: [react(), tailwindcss(), createLocalVisionPlugin(env)],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
