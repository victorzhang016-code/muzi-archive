import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdFirestore } from '../../_lib/devGuard';

/**
 * 单条公开搭配接口（按搭配分享）。
 * 深链 /share/:uid/best-match/:id 走这里：搭配 shared==true（或主人整柜公开）即可读。
 * 返回 match + 其引用单品（allItemIds 对应、且可公开读取的那些）—— 落地页才能渲染吊牌串、点开单品。
 * Firestore REST + 短缓存；未鉴权读取仍受规则约束，再叠显式校验。
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
    const r = await fetch(`${BASE}/best_matches/${id}`);
    if (r.status === 429 || r.status === 503) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }
    if (r.status === 403 || r.status === 404 || !r.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }
    const doc: any = await r.json();
    const match = decodeFields(doc.fields || {});
    if (match.userId !== uid) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }

    // 闸门：搭配 shared，或主人整柜公开
    let allowed = match.shared === true;
    if (!allowed) {
      const uRes = await fetch(`${BASE}/wardrobe_users/${uid}`);
      const uDoc = uRes.ok ? await uRes.json() : null;
      allowed = uDoc?.fields?.wardrobePublic?.booleanValue === true;
    }
    if (!allowed) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }

    const matchOut: any = { id, ...match };
    if (matchOut.photoBase64) matchOut.photoBase64 = `/api/img/${uid}/${id}?c=match`;
    delete matchOut.photoBackup;

    // 引用单品：逐条读 allItemIds，只收可公开读取（规则放行）且属于本人的
    const ids: string[] = Array.from(new Set((match.allItemIds as string[]) ?? []));
    const items = await Promise.all(
      ids.map(async (itemId) => {
        try {
          const ir = await fetch(`${BASE}/wardrobe_items/${itemId}`);
          if (!ir.ok) return null;
          const idoc: any = await ir.json();
          const data = decodeFields(idoc.fields || {});
          if (data.userId !== uid) return null;
          const out: any = { id: itemId, ...data };
          if (out.imageUrl) out.imageUrl = `/api/img/${uid}/${itemId}`;
          delete out.imageUrlBackup;
          return out;
        } catch {
          return null;
        }
      })
    );

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=0');
    return res.status(200).json({ match: matchOut, items: items.filter(Boolean) });
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
