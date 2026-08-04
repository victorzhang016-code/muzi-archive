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

export type LocalItem = { id: string; name?: string; category?: string; brand?: string; season?: string; purchaseYear?: number | string; story?: string; imageUrl?: string; [key: string]: unknown };
export type LocalSlot = { primary: string; variants?: string[] };
export type LocalMatch = { id: string; name?: string; story?: string; sceneTags?: string[]; items?: Record<string, Array<LocalSlot | string>>; allItemIds?: string[]; [key: string]: unknown };
export type LocalAnalysis = { id: string; itemId: string; status: 'proposed' | 'confirmed' | 'rejected' | 'failed'; modelVersion: string; payload: LocalVisionPayload; sourceImageUrl?: string; errorMessage?: string; updatedAt: string };
export type LocalSnapshot = { schemaVersion: string; exportedAt: string; wardrobeItems: LocalItem[]; bestMatches: LocalMatch[]; visionAnalyses: LocalAnalysis[] };

const list = (value: unknown) => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function normalizeTag(value: unknown): LocalTag | null {
  if (typeof value === 'string') return value.trim() ? { value: value.trim(), confidence: 0.5, evidence: '' } : null;
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const next = text(item.value ?? item.tag);
  return next ? { value: next, confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0.5))), evidence: text(item.evidence), source: item.source === 'user' ? 'user' : 'vision_model' } : null;
}

export function normalizeAestheticPayload(value: unknown): LocalVisionPayload {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const tags = (key: string) => list(raw[key]).map(normalizeTag).filter((tag): tag is LocalTag => Boolean(tag));
  const colors = list(raw.dominantColors).map((value) => {
    const color = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
    const source = Array.isArray(color.rgb) ? color.rgb : [color.r, color.g, color.b];
    const rgb = [0, 1, 2].map((index) => Math.max(0, Math.min(255, Math.round(Number(source[index]) || 0)))) as [number, number, number];
    return { rgb, hex: `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`, role: color.role === 'secondary' || color.role === 'accent' ? color.role : 'dominant', areaRatio: Math.max(0, Math.min(1, Number(color.areaRatio) || 0)), region: color.region === 'garment' || color.region === 'trim' || color.region === 'pattern' ? color.region : 'unknown', confidence: Math.max(0, Math.min(1, Number(color.confidence) || 0.5)), source: color.source === 'user' || color.source === 'pixel_sampling' ? color.source : 'vision_model' } as LocalColor;
  }).slice(0, 6);
  return { silhouetteTags: tags('silhouetteTags'), materialTags: tags('materialTags'), patternTags: tags('patternTags'), styleTags: tags('styleTags'), designHighlights: tags('designHighlights'), visualWeight: normalizeTag(raw.visualWeight), formality: normalizeTag(raw.formality), dominantColors: colors };
}

export function normalizeAestheticSnapshot(value: unknown): LocalSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const wardrobeItems = list(raw.wardrobeItems ?? raw.items).map((entry, index) => { const item = (entry && typeof entry === 'object' ? entry : {}) as LocalItem; return { ...item, id: text(item.id) || `item-${index + 1}`, name: text(item.name) || '未命名单品' }; });
  const bestMatches = list(raw.bestMatches ?? raw.matches).map((entry, index) => { const match = (entry && typeof entry === 'object' ? entry : {}) as LocalMatch; return { ...match, id: text(match.id) || `match-${index + 1}` }; });
  const visionAnalyses = list(raw.visionAnalyses ?? raw.analyses).map((entry, index) => {
    const analysis = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return { id: text(analysis.id) || `analysis-${index + 1}`, itemId: text(analysis.itemId ?? analysis.item_id), status: analysis.status === 'confirmed' || analysis.status === 'rejected' || analysis.status === 'failed' ? analysis.status : 'proposed', modelVersion: text(analysis.modelVersion ?? analysis.model_version) || 'product-import', payload: normalizeAestheticPayload(analysis.payload), sourceImageUrl: text(analysis.sourceImageUrl ?? analysis.source_image_url), errorMessage: text(analysis.errorMessage ?? analysis.error_message), updatedAt: text(analysis.updatedAt ?? analysis.updated_at) || new Date().toISOString() } as LocalAnalysis;
  }).filter((analysis) => analysis.itemId);
  return { schemaVersion: text(raw.schemaVersion) || 'wearlog-aesthetic-product-v1', exportedAt: text(raw.exportedAt) || new Date().toISOString(), wardrobeItems, bestMatches, visionAnalyses };
}
