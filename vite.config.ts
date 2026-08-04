import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'node:os';
import crypto from 'node:crypto';
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
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

const normalizeColorRole = (value: unknown) => {
  const role = asText(value).toLowerCase();
  if (['accent', '点缀色', '點綴色'].includes(role)) return 'accent';
  if (['secondary', '辅色', '輔色'].includes(role)) return 'secondary';
  return 'dominant';
};

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
        role: normalizeColorRole(record.role),
        areaRatio: clamp(record.areaRatio, 0, 1, 0),
        region: ['garment', 'trim', 'pattern', 'unknown'].includes(asText(record.region)) ? asText(record.region) : 'unknown',
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

const jsonStable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(jsonStable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${jsonStable(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

const semanticSnapshotIdentity = (value: unknown) => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const ids = (entries: unknown) => Array.isArray(entries)
    ? entries.map((entry) => entry && typeof entry === 'object' ? asText((entry as Record<string, unknown>).id || (entry as Record<string, unknown>).itemId) : '').filter(Boolean).sort()
    : [];
  return jsonStable({
    itemIds: ids(record.wardrobeItems || record.items),
    matchIds: ids(record.bestMatches || record.matches),
    analysisIds: ids(record.visionAnalyses || record.analyses),
  });
};

const findMatchingDownload = async (snapshot: unknown) => {
  const downloads = path.join(os.homedir(), 'Downloads');
  const targetIdentity = semanticSnapshotIdentity(snapshot);
  try {
    const names = (await readdir(downloads)).filter((name) => /^wearlog-local-aesthetic-.*\.json$/i.test(name));
    for (const name of names.sort().reverse()) {
      const filePath = path.join(downloads, name);
      const bytes = await readFile(filePath);
      try {
        if (semanticSnapshotIdentity(JSON.parse(bytes.toString('utf8'))) === targetIdentity) {
          return {filePath, bytes};
        }
      } catch {
        // A malformed export is ignored; it is never modified.
      }
    }
  } catch {
    // Downloads may not exist in another local environment.
  }
  return null;
};

const normalizeKimiClaims = (value: unknown, records: Array<{sourceType: string; sourceId: string; text: string}>, model: string) => {
  if (!Array.isArray(value)) return [];
  const allowedTypes = new Set([
    'preference', 'aversion', 'design_appreciation', 'emotion_identity', 'function_comfort',
    'body_constraint', 'scene', 'core_item', 'color_operation', 'proportion_operation',
    'material_operation', 'formality_operation', 'substitution_reason', 'constraint',
  ]);
  const recordMap = new Map(records.map((record) => [`${record.sourceType}:${record.sourceId}`, record.text]));
  const maxClaims = records.length === 1 && records[0]?.sourceType === 'item' ? 2 : 20;
  return value.slice(0, maxClaims).map((entry, index) => {
    if (!entry || typeof entry !== 'object') return null;
    const raw = entry as Record<string, unknown>;
    const sourceType = raw.sourceType === 'item' ? 'item' : raw.sourceType === 'best_match' ? 'best_match' : '';
    const sourceId = asText(raw.sourceId);
    const quote = asText(raw.quote);
    const type = asText(raw.type);
    const source = recordMap.get(`${sourceType}:${sourceId}`) || '';
    if (!sourceType || !sourceId || !quote || !source.includes(quote) || !allowedTypes.has(type)) return null;
    return {
      id: `claim:kimi:${sourceType}:${sourceId}:${index}:${crypto.createHash('sha1').update(`${quote}:${type}`).digest('hex').slice(0, 10)}`,
      sourceType,
      sourceId,
      sourceHash: crypto.createHash('sha256').update(source).digest('hex'),
      quote,
      type,
      subjectItemIds: Array.isArray(raw.subjectItemIds) ? raw.subjectItemIds.map(asText).filter(Boolean) : [],
      operation: asText(raw.operation) || undefined,
      effect: asText(raw.effect) || undefined,
      condition: asText(raw.condition) || undefined,
      limitation: asText(raw.limitation) || undefined,
      confidence: clamp(raw.confidence, 0, 1, 0.7),
      status: 'candidate',
      extractor: 'kimi',
      modelVersion: model,
      promptVersion: 'wearlog-explicit-intent-v1',
    };
  }).filter(Boolean);
};

const normalizeDecisionBrief = (value: unknown) => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const brief = raw.brief && typeof raw.brief === 'object' ? raw.brief as Record<string, unknown> : raw;
  const shorten = (entry: unknown) => asText(entry).replace(/\s+/g, ' ').slice(0, 120);
  const result = {focus: shorten(brief.focus), problem: shorten(brief.problem), outcome: shorten(brief.outcome)};
  return result.focus || result.problem || result.outcome ? result : null;
};

const safeDecisionBriefItem = (value: unknown) => {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const allowedFields = new Set(['silhouette', 'material', 'pattern', 'style', 'design_highlight', 'visual_weight', 'formality']);
  return {
    itemId: asText(raw.itemId).slice(0, 120),
    itemName: asText(raw.itemName).slice(0, 120),
    slot: asText(raw.slot).slice(0, 40),
    confirmedFields: (Array.isArray(raw.confirmedFields) ? raw.confirmedFields : []).map((entry) => {
      const field = entry && typeof entry === 'object' ? asText((entry as Record<string, unknown>).field) : '';
      const rawValues = entry && typeof entry === 'object' ? (entry as Record<string, unknown>).values : [];
      const values = Array.isArray(rawValues) ? rawValues.map(asText).filter(Boolean).slice(0, 10) : [];
      return allowedFields.has(field) && values.length ? {field, values} : null;
    }).filter(Boolean).slice(0, 7),
    colors: (Array.isArray(raw.colors) ? raw.colors : []).map((entry) => {
      const color = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      const role = asText(color.role);
      const hex = asText(color.hex).toUpperCase();
      const family = asText(color.family);
      return /^#[0-9A-F]{6}$/.test(hex) && role ? {role, hex, family} : null;
    }).filter(Boolean).slice(0, 4),
  };
};

const createLocalAestheticKnowledgePlugin = (env: Record<string, string>): Plugin => ({
  name: 'wearlog-local-aesthetic-knowledge-v3',
  configureServer(server) {
    const localRoot = path.resolve(process.cwd(), '.local-data', 'aesthetic');
    const middleware: Connect.NextHandleFunction = async (req, res, next) => {
      const route = req.url?.split('?')[0];
      if (route === '/api/local/aesthetic/versions') {
        if (req.method !== 'POST') return sendJson(res, 405, {error: '仅支持 POST'});
        try {
          const body = await readJsonBody(req, 32 * 1024 * 1024);
          const snapshot = body.snapshot;
          const run = body.run && typeof body.run === 'object' ? body.run as Record<string, unknown> : {};
          if (!snapshot || !run.id) return sendJson(res, 400, {error: '缺少 snapshot 或 AnalysisRun'});
          const matching = await findMatchingDownload(snapshot);
          const snapshotBytes = matching?.bytes || Buffer.from(JSON.stringify(snapshot, null, 2), 'utf8');
          const sourceSha256 = crypto.createHash('sha256').update(snapshotBytes).digest('hex').toUpperCase();
          const generatedAt = new Date().toISOString();
          const safeStamp = generatedAt.replace(/[:.]/g, '-');
          const snapshotDir = path.resolve(localRoot, 'snapshots');
          const runDir = path.resolve(localRoot, 'runs');
          if (!snapshotDir.startsWith(localRoot) || !runDir.startsWith(localRoot)) throw new Error('本地数据路径越界');
          await Promise.all([mkdir(snapshotDir, {recursive: true}), mkdir(runDir, {recursive: true})]);
          const snapshotFile = path.join(snapshotDir, `${safeStamp}-${sourceSha256.slice(0, 12)}.json`);
          const runFile = path.join(runDir, `${safeStamp}-${sourceSha256.slice(0, 12)}.json`);
          const manifest = run.manifest && typeof run.manifest === 'object' ? run.manifest as Record<string, unknown> : {};
          const correctedRun = {
            ...run,
            inputSnapshotHash: sourceSha256,
            generatedAt,
            manifest: {...manifest, sourceFile: matching?.filePath, sourceSha256, generatedAt},
          };
          await Promise.all([
            writeFile(snapshotFile, snapshotBytes, {flag: 'wx'}).catch(async (error: NodeJS.ErrnoException) => {
              if (error.code !== 'EEXIST') throw error;
            }),
            writeFile(runFile, JSON.stringify(correctedRun, null, 2), {flag: 'wx'}),
          ]);
          return sendJson(res, 200, {sourceSha256, snapshotFile, runFile, generatedAt, run: correctedRun});
        } catch (error) {
          return sendJson(res, 500, {error: error instanceof Error ? error.message : '本地分析版本写入失败'});
        }
      }
      if (route === '/api/local/aesthetic/text-claims/capability') {
        if (req.method !== 'POST') return sendJson(res, 405, {error: 'Only POST is supported'});
        const apiKey = String(env.KIMI_API_KEY || '').trim();
        if (!apiKey) return sendJson(res, 503, {error: 'Kimi is not configured'});
        try {
          const endpoint = String(env.KIMI_API_ENDPOINT || 'https://api.kimi.com/coding/v1/chat/completions').trim();
          const model = String(env.KIMI_MODEL || 'kimi-for-coding').trim();
          const probeText = '用白色球鞋提亮深色外套，降低整体正式度。';
          const response = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`}, body: JSON.stringify({model, max_tokens: 1200, response_format: {type: 'json_object'}, messages: [{role: 'system', content: '只输出 JSON。'}, {role: 'user', content: `这是格式与提取测试。必须返回至少一条命题，quote 必须是“${probeText}”中的连续原文，type 必须为 color_operation 或 formality_operation。返回 {"claims":[{"sourceType":"best_match","sourceId":"probe","quote":"","type":"","subjectItemIds":[],"confidence":0.9}]}`}]})});
          const raw = await response.text();
          const envelope = JSON.parse(raw) as Record<string, any>;
          const content = envelope.choices?.[0]?.message?.content || envelope.choices?.[0]?.text || envelope.output_text;
          const parsed = extractJson(content);
          const claims = Array.isArray(parsed?.claims) ? parsed.claims as Array<Record<string, unknown>> : [];
          const semanticProbe = claims.some((claim) => typeof claim.quote === 'string' && probeText.includes(claim.quote) && (claim.type === 'color_operation' || claim.type === 'formality_operation'));
          return sendJson(res, 200, {modelVersion: model, status: response.status, structuredOutput: response.ok && Boolean(parsed), semanticProbe, rawSummary: semanticProbe ? undefined : (String(content || raw || '').slice(0, 300))});
        } catch (error) {
          return sendJson(res, 200, {structuredOutput: false, semanticProbe: false, detail: error instanceof Error ? error.message : 'Capability probe failed'});
        }
      }
      if (route === '/api/local/aesthetic/decision-brief') {
        if (req.method !== 'POST') return sendJson(res, 405, {error: '仅支持 POST'});
        const apiKey = String(env.KIMI_API_KEY || '').trim();
        if (!apiKey) return sendJson(res, 503, {error: 'Kimi 未配置；你仍可手动填写三句搭配意图'});
        try {
          const body = await readJsonBody(req, 128 * 1024);
          const incoming = body.request && typeof body.request === 'object' ? body.request as Record<string, unknown> : {};
          const anchor = safeDecisionBriefItem(incoming.anchor);
          const items = (Array.isArray(incoming.items) ? incoming.items : []).map(safeDecisionBriefItem).filter((item) => item.itemId && item.itemName).slice(0, 12);
          const matchId = asText(incoming.matchId).slice(0, 120);
          if (!matchId || !anchor.itemId || !items.some((item) => item.itemId === anchor.itemId)) return sendJson(res, 400, {error: '搭配意图草案缺少当前搭配的核心单品'});
          const evidence = {
            matchId,
            outfitName: asText(incoming.outfitName).slice(0, 160),
            story: asText(incoming.story).slice(0, 1600),
            anchor,
            items,
            confirmedTextEvidence: (Array.isArray(incoming.confirmedTextEvidence) ? incoming.confirmedTextEvidence : []).map((entry) => {
              const raw = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
              return {quote: asText(raw.quote).slice(0, 280), type: asText(raw.type), operation: asText(raw.operation).slice(0, 120), effect: asText(raw.effect).slice(0, 160)};
            }).filter((entry) => entry.quote).slice(0, 8),
            decisionMechanisms: (Array.isArray(incoming.decisionMechanisms) ? incoming.decisionMechanisms : []).map((entry) => {
              const raw = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
              return {operation: asText(raw.operation).slice(0, 80), role: asText(raw.role).slice(0, 40), condition: asText(raw.condition).slice(0, 180), action: asText(raw.action).slice(0, 180), effect: asText(raw.effect).slice(0, 180)};
            }).filter((entry) => entry.operation && entry.action).slice(0, 3),
          };
          const endpoint = String(env.KIMI_API_ENDPOINT || 'https://api.kimi.com/coding/v1/chat/completions').trim();
          const model = String(env.KIMI_DECISION_MODEL || env.KIMI_MODEL || 'kimi-for-coding').trim();
          const promptVersion = asText(body.promptVersion) || 'wearlog-decision-brief-v1';
          const prompt = `你是衣LOG的单套搭配意图起草助手。根据下方这一套搭配的已确认事实，起草三句短意图：focus（想突出什么）、problem（要处理什么问题）、outcome（最后效果怎样）。\n\n要求：\n- 只使用给出的原始搭配说明、已确认字段、已确认文字证据和已存在的本地机制；不补写不存在的身形、场景、品牌意图或穿着反馈。\n- 语言使用准确的穿搭表达，短、具体、可让用户修改；不要口号、拟人化或空泛形容词。\n- 每一项最多 60 个汉字；证据不足可留空字符串。\n- 这只是 Kimi 草案，用户确认前不进入正式意图证据。\n- 只返回 JSON：{"brief":{"focus":"","problem":"","outcome":""}}。\n\n当前搭配事实：${JSON.stringify(evidence)}`;
          const call = async (userPrompt: string) => {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
              body: JSON.stringify({model, max_tokens: 700, response_format: {type: 'json_object'}, messages: [{role: 'system', content: '只输出合法 JSON，不要 Markdown。'}, {role: 'user', content: userPrompt}]}),
            });
            const raw = await response.text();
            if (!response.ok) throw new Error(`Kimi 搭配意图服务返回 ${response.status}`);
            const envelope = JSON.parse(raw) as Record<string, any>;
            return envelope.choices?.[0]?.message?.content || envelope.choices?.[0]?.text || envelope.output_text || '';
          };
          let content = await call(prompt);
          let brief = normalizeDecisionBrief(extractJson(content));
          if (!brief) {
            content = await call(`将以下内容只修复为合法 JSON，不要重新解释：${String(content).slice(0, 1800)}`);
            brief = normalizeDecisionBrief(extractJson(content));
          }
          if (!brief) return sendJson(res, 502, {error: 'Kimi 返回内容无法整理成三句搭配意图；请重试或手动填写'});
          return sendJson(res, 200, {brief, modelVersion: model, promptVersion});
        } catch (error) {
          return sendJson(res, 502, {error: error instanceof Error ? error.message : 'Kimi 搭配意图起草失败'});
        }
      }
      if (route === '/api/local/aesthetic/text-claims') {
        if (req.method !== 'POST') return sendJson(res, 405, {error: '仅支持 POST'});
        const apiKey = String(env.KIMI_API_KEY || '').trim();
        if (!apiKey) return sendJson(res, 503, {error: 'Kimi 未配置；确定性分析仍可继续使用'});
        try {
          const body = await readJsonBody(req, 512 * 1024);
          const records = Array.isArray(body.records) ? body.records.map((entry) => {
            const raw = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
            return {sourceType: asText(raw.sourceType), sourceId: asText(raw.sourceId), text: asText(raw.text)};
          }).filter((record) => ['item', 'best_match'].includes(record.sourceType) && record.sourceId && record.text).slice(0, 8) : [];
          if (!records.length) return sendJson(res, 400, {error: '没有可提取的文字记录'});
          const itemMode = records.length === 1 && records[0]?.sourceType === 'item';
          const endpoint = String(env.KIMI_API_ENDPOINT || 'https://api.kimi.com/coding/v1/chat/completions').trim();
          const model = String(env.KIMI_MODEL || 'kimi-for-coding').trim();
          const prompt = `你是衣LOG个人审美档案的“显式意图提取器”。只提取原文明说的内容，严禁补写潜台词。每条 claim 必须保留原文中的精确连续子串 quote；quote 不在原文中会被系统删除。\n\n允许类型：preference, aversion, design_appreciation, emotion_identity, function_comfort, body_constraint, scene, core_item, color_operation, proportion_operation, material_operation, formality_operation, substitution_reason, constraint。\n\n返回 JSON：{"claims":[{"sourceType":"item|best_match","sourceId":"","quote":"精确原文","type":"","subjectItemIds":[],"operation":"可选","effect":"可选","condition":"可选","limitation":"可选","confidence":0.0}]}。歧义内容选择最高概率解释并降低 confidence；不要输出 Markdown。\n\n记录：${JSON.stringify(records)}`;
          const strictPrompt = body.repairContent
            ? `Repair this previous output into valid JSON only. Do not reinterpret it: ${asText(body.repairContent)}`
            : itemMode
              ? `你在解析一件单品的文字故事。最多输出 2 条，只保留对个人审美学习有新增价值的内容：喜欢或不喜欢的原因、设计欣赏、情感/身份意义、舒适度/限制、特殊使用场景。不要复述已经由视觉字段记录的颜色、材质、廓形、图案、风格、正式度；不要把一般性的“好看”“百搭”单独当命题。若没有这类新增信息，返回空数组。quote 必须逐字复制原文连续片段。允许类型：preference, aversion, design_appreciation, emotion_identity, function_comfort, body_constraint, scene, constraint。只输出 JSON：{"claims":[{"sourceType":"item","sourceId":"","quote":"","type":"","subjectItemIds":[],"effect":"","limitation":"","confidence":0.0}]}。记录：${JSON.stringify(records)}`
              : `你是衣LOG的文字意图提取器。逐条检查记录：只要原文明确说出喜欢原因、情感意义、穿着限制，或搭配动作（核心、颜色、比例、材质、正式度、场景、替换），就必须提取为命题；不要因为表达简短而返回空数组。quote 必须逐字复制原文中的连续片段。示例：原文“用白色球鞋提亮深色外套，降低整体正式度。”至少应输出 quote “用白色球鞋提亮深色外套”、type “color_operation”。允许类型：preference, aversion, design_appreciation, emotion_identity, function_comfort, body_constraint, scene, core_item, color_operation, proportion_operation, material_operation, formality_operation, substitution_reason, constraint。只输出 JSON：{"claims":[{"sourceType":"item|best_match","sourceId":"","quote":"","type":"","subjectItemIds":[],"operation":"","effect":"","condition":"","limitation":"","confidence":0.0}]}。每条最多 20 个命题。记录：${JSON.stringify(records)}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
            body: JSON.stringify({model, max_tokens: Number(env.KIMI_TEXT_MAX_TOKENS || 4500), ...(body.structuredOutput === true ? {response_format: {type: 'json_object'}} : {}), messages: [{role: 'system', content: 'Output JSON only.'}, {role: 'user', content: strictPrompt}]}),
          });
          const rawResponse = await response.text();
          if (!response.ok) return sendJson(res, response.status === 401 || response.status === 403 ? 503 : 502, {error: `Kimi 文本服务返回 ${response.status}`});
          const envelope = JSON.parse(rawResponse) as Record<string, any>;
          const content = envelope.choices?.[0]?.message?.content || envelope.choices?.[0]?.text || envelope.output_text;
          const parsed = extractJson(content);
          if (!parsed) return sendJson(res, 502, {error: 'Kimi 返回内容无法解析为 JSON', rawResponse: rawResponse.slice(0, 240)});
          const claims = normalizeKimiClaims(parsed.claims, records, model);
          const reasoning = envelope.choices?.[0]?.message?.reasoning_content || '';
          return sendJson(res, 200, {modelVersion: model, structuredOutput: body.structuredOutput === true, claims, rawSummary: claims.length ? undefined : `${content}\n${reasoning}`.slice(0, 3000)});
        } catch (error) {
          return sendJson(res, 502, {error: error instanceof Error ? error.message : 'Kimi 文本意图提取失败'});
        }
      }
      next();
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
    plugins: [react(), tailwindcss(), createLocalVisionPlugin(env), createLocalAestheticKnowledgePlugin(env)],
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
