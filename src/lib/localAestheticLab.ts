import { aestheticSourceConfigError, aestheticSourceEnvironment, aestheticSourceSupabase } from './aestheticSourceSupabase';

export type LocalTag = {
  value: string;
  confidence: number;
  evidence: string;
  source?: 'vision_model' | 'user';
};

export type LocalColor = {
  rgb: [number, number, number];
  hex: string;
  role: 'dominant' | 'secondary' | 'accent';
  areaRatio: number;
  region: 'garment' | 'trim' | 'pattern' | 'unknown';
  confidence: number;
  source: 'pixel_sampling' | 'vision_model' | 'user';
};

export type LocalVisionPayload = {
  silhouetteTags: LocalTag[];
  materialTags: LocalTag[];
  patternTags: LocalTag[];
  styleTags: LocalTag[];
  designHighlights: LocalTag[];
  visualWeight: LocalTag | null;
  formality: LocalTag | null;
  dominantColors: LocalColor[];
};

export type LocalItem = {
  id: string;
  name?: string;
  category?: string;
  brand?: string;
  season?: string;
  purchaseYear?: number | string;
  story?: string;
  imageUrl?: string;
  [key: string]: unknown;
};

export type LocalSlot = { primary: string; variants?: string[] };
export type LocalMatch = {
  id: string;
  name?: string;
  story?: string;
  sceneTags?: string[];
  items?: Record<string, Array<LocalSlot | string>>;
  allItemIds?: string[];
  [key: string]: unknown;
};

export type LocalAnalysis = {
  id: string;
  itemId: string;
  status: 'proposed' | 'confirmed' | 'rejected' | 'failed';
  modelVersion: string;
  payload: LocalVisionPayload;
  sourceImageUrl?: string;
  errorMessage?: string;
  updatedAt: string;
};

export type LocalSnapshot = {
  schemaVersion: string;
  exportedAt: string;
  wardrobeItems: LocalItem[];
  bestMatches: LocalMatch[];
  visionAnalyses: LocalAnalysis[];
};

export type LocalAnalytics = {
  itemCount: number;
  matchCount: number;
  imageCount: number;
  confirmedVisionCount: number;
  categories: Array<[string, number]>;
  brands: Array<[string, number]>;
  seasons: Array<[string, number]>;
  years: Array<[string, number]>;
  relations: Array<{ left: string; right: string; count: number; kind: 'cooccurrence' | 'variant' }>;
  tags: Array<[string, number]>;
  textSignals: Array<[string, number]>;
  insights: Array<{ kind: 'fact' | 'inference' | 'hypothesis'; title: string; body: string; evidence: string }>;
};

const STORAGE_KEY = 'wearlog.local.aesthetic.snapshot.v1';

const emptyPayload = (): LocalVisionPayload => ({
  silhouetteTags: [],
  materialTags: [],
  patternTags: [],
  styleTags: [],
  designHighlights: [],
  visualWeight: null,
  formality: null,
  dominantColors: [],
});

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTag(value: unknown): LocalTag | null {
  if (typeof value === 'string') return value.trim() ? { value: value.trim(), confidence: 0.5, evidence: '' } : null;
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const next = text(item.value ?? item.tag);
  return next ? {
    value: next,
    confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.5))),
    evidence: text(item.evidence),
    source: item.source === 'user' ? 'user' : 'vision_model',
  } : null;
}

export function normalizeLocalPayload(value: unknown): LocalVisionPayload {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const tags = (key: string) => list(raw[key]).map(normalizeTag).filter((tag): tag is LocalTag => !!tag);
  const scalar = (key: string) => normalizeTag(raw[key]);
  const colors = list(raw.dominantColors).map((value) => {
    const color = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const rgbValue = Array.isArray(color.rgb) ? color.rgb : [color.r, color.g, color.b];
    const rgb = [0, 1, 2].map((index) => Math.max(0, Math.min(255, Math.round(Number(rgbValue[index]) || 0)))) as [number, number, number];
    return {
      rgb,
      hex: `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
      role: color.role === 'secondary' || color.role === 'accent' ? color.role : 'dominant',
      areaRatio: Math.max(0, Math.min(1, Number(color.areaRatio) || 0)),
      region: color.region === 'garment' || color.region === 'trim' || color.region === 'pattern' ? color.region : 'unknown',
      confidence: Math.max(0, Math.min(1, Number(color.confidence) || 0.5)),
      source: color.source === 'user' || color.source === 'pixel_sampling' ? color.source : 'vision_model',
    } as LocalColor;
  }).slice(0, 6);
  return { silhouetteTags: tags('silhouetteTags'), materialTags: tags('materialTags'), patternTags: tags('patternTags'), styleTags: tags('styleTags'), designHighlights: tags('designHighlights'), visualWeight: scalar('visualWeight'), formality: scalar('formality'), dominantColors: colors };
}

export function normalizeLocalSnapshot(value: unknown): LocalSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const wardrobeItems = list(raw.wardrobeItems ?? raw.items).map((entry, index) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as LocalItem;
    return { ...item, id: text(item.id) || `item-${index + 1}`, name: text(item.name) || `未命名单品` };
  });
  const bestMatches = list(raw.bestMatches ?? raw.matches).map((entry, index) => {
    const match = (entry && typeof entry === 'object' ? entry : {}) as LocalMatch;
    return { ...match, id: text(match.id) || `match-${index + 1}` };
  });
  const visionAnalyses = list(raw.visionAnalyses ?? raw.analyses).map((entry, index) => {
    const analysis = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return {
      id: text(analysis.id) || `analysis-${index + 1}`,
      itemId: text(analysis.itemId ?? analysis.item_id),
      status: analysis.status === 'confirmed' || analysis.status === 'rejected' || analysis.status === 'failed' ? analysis.status : 'proposed',
      modelVersion: text(analysis.modelVersion ?? analysis.model_version) || 'local-import',
      payload: normalizeLocalPayload(analysis.payload),
      sourceImageUrl: text(analysis.sourceImageUrl ?? analysis.source_image_url),
      errorMessage: text(analysis.errorMessage ?? analysis.error_message),
      updatedAt: text(analysis.updatedAt ?? analysis.updated_at) || new Date().toISOString(),
    } as LocalAnalysis;
  }).filter((analysis) => analysis.itemId);
  return {
    schemaVersion: text(raw.schemaVersion) || 'wearlog-local-aesthetic-v1',
    exportedAt: text(raw.exportedAt) || new Date().toISOString(),
    wardrobeItems,
    bestMatches,
    visionAnalyses,
  };
}

export function loadLocalSnapshot(): LocalSnapshot {
  if (typeof window === 'undefined') return normalizeLocalSnapshot({});
  try { return normalizeLocalSnapshot(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')); } catch { return normalizeLocalSnapshot({}); }
}

export function saveLocalSnapshot(snapshot: LocalSnapshot) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

/** Read-only bridge from the authenticated Production source account. */
export async function loadSourceAccountSnapshot() {
  if (!import.meta.env.DEV || aestheticSourceEnvironment !== 'production') {
    throw new Error('账号数据源未通过只读 Production 闸门，已拒绝同步');
  }
  if (!aestheticSourceSupabase) throw new Error(aestheticSourceConfigError || '账号数据源未配置');
  const { data: sessionData } = await aestheticSourceSupabase.auth.getSession();
  if (!sessionData.session) throw new Error('请先在衣 log 登录一次，再回到本地分析台同步账号数据');
  const [itemsResult, matchesResult] = await Promise.all([
    aestheticSourceSupabase.from('wardrobe_items').select('*').order('created_at', { ascending: false }),
    aestheticSourceSupabase.from('best_matches').select('*').order('created_at', { ascending: false }),
  ]);
  if (itemsResult.error) throw new Error(`单品读取失败：${itemsResult.error.message}`);
  if (matchesResult.error) throw new Error(`Best Match 读取失败：${matchesResult.error.message}`);
  const analysesResult = await aestheticSourceSupabase.from('aesthetic_vision_analyses').select('*').order('updated_at', { ascending: false });
  return normalizeLocalSnapshot({
    schemaVersion: 'wearlog-local-aesthetic-v1',
    exportedAt: new Date().toISOString(),
    wardrobeItems: (itemsResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      season: row.season,
      purchaseYear: row.purchase_year,
      story: row.story,
      imageUrl: row.image_url,
      rating: row.rating,
      length: row.length,
      topType: row.top_type,
      accessoryType: row.accessory_type,
    })),
    bestMatches: (matchesResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      story: row.story,
      sceneTags: row.scene_tags,
      items: row.items,
      allItemIds: row.all_item_ids,
    })),
    visionAnalyses: analysesResult.error ? [] : analysesResult.data,
  });
}

function increment(map: Map<string, number>, value: unknown) {
  const key = text(value);
  if (key) map.set(key, (map.get(key) || 0) + 1);
}

function matchItemIds(match: LocalMatch) {
  if (list(match.allItemIds).length) return list(match.allItemIds).map(String);
  const ids: string[] = [];
  Object.values(match.items || {}).forEach((slotList) => list(slotList).forEach((entry) => {
    if (typeof entry === 'string') ids.push(entry);
    else if (entry && typeof entry === 'object') {
      const slot = entry as LocalSlot;
      if (slot.primary) ids.push(slot.primary);
      list(slot.variants).forEach((variant) => ids.push(String(variant)));
    }
  }));
  return ids;
}

export function analyzeLocalSnapshot(snapshot: LocalSnapshot): LocalAnalytics {
  const categories = new Map<string, number>();
  const brands = new Map<string, number>();
  const seasons = new Map<string, number>();
  const years = new Map<string, number>();
  snapshot.wardrobeItems.forEach((item) => { increment(categories, item.category); increment(brands, item.brand); increment(seasons, item.season); increment(years, item.purchaseYear); });
  const relationMap = new Map<string, { left: string; right: string; count: number; kind: 'cooccurrence' | 'variant' }>();
  snapshot.bestMatches.forEach((match) => {
    const ids = [...new Set(matchItemIds(match))];
    ids.forEach((left, index) => ids.slice(index + 1).forEach((right) => {
      const key = [left, right].sort().join('::');
      const current = relationMap.get(key) || { left, right, count: 0, kind: 'cooccurrence' as const };
      current.count += 1; relationMap.set(key, current);
    }));
    Object.values(match.items || {}).forEach((slotList) => list(slotList).forEach((entry) => {
      if (!entry || typeof entry === 'string') return;
      const slot = entry as LocalSlot;
      list(slot.variants).forEach((variant) => {
        const key = `${slot.primary}::${variant}::variant`;
        const current = relationMap.get(key) || { left: slot.primary, right: String(variant), count: 0, kind: 'variant' as const };
        current.count += 1; relationMap.set(key, current);
      });
    }));
  });
  const itemNames = new Map(snapshot.wardrobeItems.map((item) => [item.id, item.name || item.id]));
  const relations = [...relationMap.values()].sort((a, b) => b.count - a.count).slice(0, 30).map((relation) => ({ ...relation, left: itemNames.get(relation.left) || relation.left, right: itemNames.get(relation.right) || relation.right }));
  const tags = new Map<string, number>();
  snapshot.visionAnalyses.filter((analysis) => analysis.status === 'confirmed').forEach((analysis) => {
    [...analysis.payload.styleTags, ...analysis.payload.silhouetteTags, ...analysis.payload.materialTags, ...analysis.payload.patternTags, ...analysis.payload.designHighlights].forEach((tag) => increment(tags, tag.value));
  });
  const textSignals = new Map<string, number>();
  const signalTerms = ['喜欢', '偏爱', '舒服', '松弛', '克制', '复古', '极简', '正式', '质感', '层次', '比例', '颜色', '故事', '纪念', '旅行', '礼物', '朋友', '替代', '换成'];
  [...snapshot.wardrobeItems.map((item) => item.story), ...snapshot.bestMatches.map((match) => match.story)]
    .filter(Boolean)
    .forEach((story) => signalTerms.forEach((term) => { if (String(story).includes(term)) increment(textSignals, term); }));
  const sorted = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]);
  const insights: LocalAnalytics['insights'] = [];
  if (snapshot.bestMatches.length) {
    const top = relations[0];
    insights.push({ kind: 'fact', title: '搭配关系已经出现', body: `当前有 ${snapshot.bestMatches.length} 套 Best Match，最常见的共现关系是「${top ? `${top.left} × ${top.right}` : '暂未形成稳定组合'}」。`, evidence: `${snapshot.bestMatches.length} 套 Best Match / 关系按整套共现次数计算` });
  }
  if (sorted(tags)[0]) insights.push({ kind: 'inference', title: '确认后的视觉词汇正在变成个人证据', body: `已确认视觉字段中，「${sorted(tags)[0][0]}」出现 ${sorted(tags)[0][1]} 次，可以作为后续审美画像的观察线索。`, evidence: `${snapshot.visionAnalyses.filter((analysis) => analysis.status === 'confirmed').length} 个已确认读图结果` });
  if (sorted(textSignals)[0]) insights.push({ kind: 'inference', title: '描述文字里有可追踪的主观线索', body: `衣物与搭配描述中，「${sorted(textSignals)[0][0]}」出现 ${sorted(textSignals)[0][1]} 次；它应与视觉字段和真实穿着反馈交叉验证。`, evidence: '单品故事与 Best Match 描述的关键词计数' });
  if (sorted(years)[0]) insights.push({ kind: 'fact', title: '衣橱时间结构', body: `购买年份记录最多的是 ${sorted(years)[0][0]}，年份字段可继续与穿着频率、搭配复用和淘汰做纵向比较。`, evidence: `${sorted(years).map(([year, count]) => `${year}: ${count}`).join(' / ')}` });
  if (!insights.length) insights.push({ kind: 'hypothesis', title: '还没有足够证据', body: '先导入审计快照，再确认几件单品的读图字段，系统才会开始产生可追溯的统计与关系结论。', evidence: '当前本地数据为空或不足' });
  return { itemCount: snapshot.wardrobeItems.length, matchCount: snapshot.bestMatches.length, imageCount: snapshot.wardrobeItems.filter((item) => !!item.imageUrl).length, confirmedVisionCount: snapshot.visionAnalyses.filter((analysis) => analysis.status === 'confirmed').length, categories: sorted(categories), brands: sorted(brands), seasons: sorted(seasons), years: sorted(years), relations, tags: sorted(tags), textSignals: sorted(textSignals), insights };
}

export function emptyLocalPayload() { return emptyPayload(); }

export async function requestLocalVision(item: LocalItem, image?: string) {
  const response = await fetch('/api/local/aesthetic/vision', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image, imageUrl: image ? undefined : item.imageUrl, itemName: item.name }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status >= 500 && (image || item.imageUrl)) {
    return analyzeImagePixels(image || item.imageUrl || '');
  }
  if (!response.ok) throw new Error(String(body.error || '本地读图失败'));
  return { modelVersion: String(body.modelVersion || 'unknown'), payload: normalizeLocalPayload(body.payload) };
}

export type RefinableVisionField = 'silhouetteTags' | 'materialTags' | 'patternTags' | 'styleTags' | 'designHighlights' | 'visualWeight' | 'formality';

export async function requestLocalVisionCorrection(item: LocalItem, field: RefinableVisionField, correction: string) {
  const response = await fetch('/api/local/aesthetic/vision', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'refine', imageUrl: item.imageUrl, itemName: item.name, field, correction }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status >= 500 || !response.ok) {
    return { modelVersion: 'manual-correction-v1', suggestions: [{ value: correction.trim(), confidence: 1, evidence: 'Victor 的人工概括' }] };
  }
  return body as { modelVersion: string; suggestions: LocalTag[] };
}

/**
 * Provider 不可用时的本地保底：只从图片像素提取可验证的 RGB 主色。
 * 形态、材质和风格不会被猜测，交给 Victor 在审计台确认或手动填写。
 */
async function analyzeImagePixels(imageUrl: string) {
  if (typeof window === 'undefined' || !imageUrl) throw new Error('本地像素分析缺少图片');
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = 'anonymous';
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('图片无法在本地读取；请使用可访问的图片 URL 或重新上传图片'));
    element.src = imageUrl;
  });
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('当前浏览器不支持本地像素分析');
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const bins = new Map<string, {rgb: [number, number, number]; count: number}>();
  let visible = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 24) continue;
    visible += 1;
    const rgb: [number, number, number] = [0, 1, 2].map((channel) => Math.min(255, Math.round(pixels[index + channel] / 32) * 32)) as [number, number, number];
    const key = rgb.join(',');
    const current = bins.get(key) || {rgb, count: 0};
    current.count += 1;
    bins.set(key, current);
  }
  const colors = [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  const dominantColors: LocalColor[] = colors.map((color, index) => ({
    rgb: color.rgb,
    hex: `#${color.rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase(),
    role: index === 0 ? 'dominant' : index < 3 ? 'secondary' : 'accent',
    areaRatio: visible ? Number((color.count / visible).toFixed(3)) : 0,
    region: 'unknown',
    confidence: 0.65,
    source: 'pixel_sampling',
  }));
  return {
    modelVersion: 'local-pixel-v1',
    payload: {
      ...emptyPayload(),
      dominantColors,
    },
  };
}
