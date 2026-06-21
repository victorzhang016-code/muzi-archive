import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdFirestore } from '../../_lib/devGuard';

/**
 * 单条公开单品接口（按单品分享）。
 * 深链 /share/:uid/item/:id 走这里：只要这一件 shared==true（或主人整柜公开）即可读，
 * 整柜未公开也能打开单条。Firestore REST + 短缓存，未鉴权读取仍受规则约束，再叠显式校验。
 */

const PROJECT = 'gen-lang-client-0133868878';
const DB = 'ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${encodeURIComponent(DB)}/documents`;

function decodeValue(v: any): any {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime();
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}
function decodeFields(fields: any): any {
  const o: any = {};
  for (const k in fields) o[k] = decodeValue(fields[k]);
  return o;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdFirestore(res)) return;

  const uid = (req.query.uid as string) || '';
  const id = (req.query.id as string) || '';
  if (!uid || !id) return res.status(400).json({ error: 'uid and id required' });

  try {
    const r = await fetch(`${BASE}/wardrobe_items/${id}`);
    if (r.status === 429 || r.status === 503) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }
    if (r.status === 403 || r.status === 404 || !r.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }
    const doc: any = await r.json();
    const data = decodeFields(doc.fields || {});
    if (data.userId !== uid) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }

    // 闸门：单条 shared，或主人整柜公开
    let allowed = data.shared === true;
    if (!allowed) {
      const uRes = await fetch(`${BASE}/wardrobe_users/${uid}`);
      const uDoc = uRes.ok ? await uRes.json() : null;
      allowed = uDoc?.fields?.wardrobePublic?.booleanValue === true;
    }
    if (!allowed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }

    const out: any = { id, ...data };
    if (out.imageUrl) out.imageUrl = `/api/img/${uid}/${id}`;
    delete out.imageUrlBackup;

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=0');
    return res.status(200).json({ item: out });
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
