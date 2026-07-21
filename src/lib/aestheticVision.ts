import type { WardrobeItem } from '../types';
import { resolveMediaUrl } from './media';
import { supabase } from './supabase';

export type VisionStatus = 'pending' | 'processing' | 'proposed' | 'confirmed' | 'rejected' | 'failed';
export type VisionTag = { value: string; confidence: number; evidence: string; source?: 'vision_model' | 'user' };
export type VisionColor = {
  rgb: [number, number, number];
  hex: string;
  role: 'dominant' | 'secondary' | 'accent';
  areaRatio: number;
  region: 'garment' | 'trim' | 'pattern' | 'unknown';
  confidence: number;
  source: 'pixel_sampling' | 'vision_model' | 'user';
};
export type VisionScalar = { value: string; confidence: number; evidence: string; source?: 'vision_model' | 'user' };
export type VisionPayload = {
  silhouetteTags: VisionTag[];
  materialTags: VisionTag[];
  patternTags: VisionTag[];
  styleTags: VisionTag[];
  designHighlights: VisionTag[];
  visualWeight: VisionScalar | null;
  formality: VisionScalar | null;
  dominantColors: VisionColor[];
};
export type VisionAnalysis = {
  id: string;
  ownerId: string;
  itemId: string;
  imageHash: string;
  sourceImageUrl: string;
  modelVersion: string;
  status: VisionStatus;
  payload: VisionPayload;
  errorMessage?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const POLICY_VERSION = 'vision-consent-2026-07-19';

function db() {
  if (!supabase) throw new Error('Supabase 未配置');
  return supabase;
}

function mapAnalysis(row: Record<string, any>): VisionAnalysis {
  const rawPayload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Partial<VisionPayload>;
  return {
    id: row.id,
    ownerId: row.owner_id,
    itemId: row.item_id,
    imageHash: row.image_hash,
    sourceImageUrl: row.source_image_url,
    modelVersion: row.model_version,
    status: row.status,
    payload: {
      silhouetteTags: Array.isArray(rawPayload.silhouetteTags) ? rawPayload.silhouetteTags : [],
      materialTags: Array.isArray(rawPayload.materialTags) ? rawPayload.materialTags : [],
      patternTags: Array.isArray(rawPayload.patternTags) ? rawPayload.patternTags : [],
      styleTags: Array.isArray(rawPayload.styleTags) ? rawPayload.styleTags : [],
      designHighlights: Array.isArray(rawPayload.designHighlights) ? rawPayload.designHighlights : [],
      visualWeight: rawPayload.visualWeight || null,
      formality: rawPayload.formality || null,
      dominantColors: Array.isArray(rawPayload.dominantColors) ? rawPayload.dominantColors : [],
    },
    errorMessage: row.error_message,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getVisionConsent() {
  const { data, error } = await db().from('aesthetic_vision_consents').select('*').maybeSingle();
  if (error) throw error;
  return data as { owner_id: string; policy_version: string; granted_at: string; revoked_at: string | null } | null;
}

export async function grantVisionConsent() {
  const { data: session } = await db().auth.getSession();
  const ownerId = session.session?.user.id;
  if (!ownerId) throw new Error('登录状态已失效，请重新登录');
  const { data, error } = await db().from('aesthetic_vision_consents').upsert({
    owner_id: ownerId,
    policy_version: POLICY_VERSION,
    granted_at: new Date().toISOString(),
    revoked_at: null,
    updated_at: new Date().toISOString(),
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function revokeVisionConsent() {
  const { error } = await db().from('aesthetic_vision_consents').update({
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listVisionAnalyses() {
  const { data, error } = await db().from('aesthetic_vision_analyses').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAnalysis);
}

export async function listVisionRevisions(analysisId: string) {
  const { data, error } = await db().from('aesthetic_vision_revisions').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function imageToDataUrl(item: WardrobeItem) {
  if (!item.imageUrl) throw new Error('这件单品没有图片');
  if (item.imageUrl.startsWith('data:image/')) return item.imageUrl;
  const response = await fetch(resolveMediaUrl(item.imageUrl) || item.imageUrl);
  if (!response.ok) throw new Error('无法读取单品图片');
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(blob);
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, '0')).join('');
}

export async function analyzeVision(item: WardrobeItem) {
  const image = await imageToDataUrl(item);
  const imageHash = await sha256(image);
  const { data: session } = await db().auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('登录状态已失效，请重新登录');
  const ownerId = session.session.user.id;
  const response = await fetch('/api/aesthetic/vision/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ image, itemId: item.id, itemName: item.name }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error || '图片识别失败'));

  const now = new Date().toISOString();
  const { data, error } = await db().from('aesthetic_vision_analyses').upsert({
    owner_id: ownerId,
    item_id: item.id,
    image_hash: imageHash,
    source_image_url: item.imageUrl,
    model_version: body.modelVersion || 'unknown',
    status: 'proposed',
    payload: body.payload,
    error_message: null,
    reviewed_at: null,
    updated_at: now,
  }, { onConflict: 'owner_id,item_id,image_hash,model_version' }).select('*').single();
  if (error) throw error;
  const analysis = mapAnalysis(data);
  await recordVisionRevision(analysis.id, 'created', null, analysis.payload, null, 'proposed');
  return analysis;
}

export async function updateVisionReview(
  analysis: VisionAnalysis,
  payload: VisionPayload,
  status: Extract<VisionStatus, 'confirmed' | 'rejected'>,
) {
  const now = new Date().toISOString();
  const { data, error } = await db().from('aesthetic_vision_analyses').update({
    payload,
    status,
    reviewed_at: now,
    updated_at: now,
    error_message: null,
  }).eq('id', analysis.id).select('*').single();
  if (error) throw error;
  const next = mapAnalysis(data);
  const action = analysis.status === status ? 'edited' : status;
  await recordVisionRevision(analysis.id, action, analysis.payload, payload, analysis.status, status);
  return next;
}

async function recordVisionRevision(
  analysisId: string,
  action: 'created' | 'confirmed' | 'rejected' | 'edited' | 'retried',
  previousPayload: VisionPayload | null,
  nextPayload: VisionPayload,
  previousStatus: VisionStatus | null,
  nextStatus: VisionStatus,
) {
  const { data: session } = await db().auth.getSession();
  const ownerId = session.session?.user.id;
  if (!ownerId) throw new Error('登录状态已失效，请重新登录');
  const { error } = await db().from('aesthetic_vision_revisions').insert({
    owner_id: ownerId,
    analysis_id: analysisId,
    action,
    previous_payload: previousPayload,
    next_payload: nextPayload,
    previous_status: previousStatus,
    next_status: nextStatus,
  });
  if (error) throw error;
}

export function initialVisionPayload(): VisionPayload {
  return { silhouetteTags: [], materialTags: [], patternTags: [], styleTags: [], designHighlights: [], visualWeight: null, formality: null, dominantColors: [] };
}
