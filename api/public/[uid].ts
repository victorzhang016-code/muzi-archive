import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdFirestore } from '../_lib/devGuard';

/**
 * 公开衣柜的短缓存接口。
 *
 * 公开页（卡墙 / 示例卡 / 公开衣柜页 / 单品·搭配深链）全部读这个接口，
 * 由 Vercel CDN 做短缓存，尽量降低 Firestore 读压力，同时保留可撤销性：
 * 用户关闭分享后，公开 JSON 和图片链接都会在短时间内失效。
 *
 * 用 Firestore REST API（免捆绑 SDK、无 gRPC、冷启快）；未鉴权读取仍受安全规则约束，
 * 再叠加显式 wardrobePublic 校验，未公开整柜的衣柜不会泄露。
 */

// 非密钥（与前端 firebase-applet-config.json 一致，已在客户端 bundle 中公开）。
// 不用 JSON import：package.json 是 "type":"module"，ESM 下裸 JSON import 会在运行时报 ERR。
const PROJECT = 'gen-lang-client-0133868878';
const DB = 'ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${encodeURIComponent(DB)}/documents`;

// ── Firestore REST typed-value 解码 ──
function decodeValue(v: any): any {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime(); // → millis
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

async function runQuery(collectionId: string, uid: string): Promise<any[]> {
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } },
        },
      },
    }),
  });
  if (!res.ok) {
    const err: any = new Error(`runQuery ${collectionId} ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const rows: any[] = await res.json();
  const out: any[] = [];
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split('/').pop();
    out.push({ id, ...decodeFields(row.document.fields || {}) });
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdFirestore(res)) return;

  const uid = (req.query.uid as string) || '';
  if (!uid) return res.status(400).json({ error: 'uid required' });
  const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit as string, 10) || 0) : 0;

  try {
    // 1) 整柜公开闸门（wardrobe_users 规则 allow read: if true）—— v2 读 wardrobePublic
    const uRes = await fetch(`${BASE}/wardrobe_users/${uid}`);
    if (uRes.status === 429 || uRes.status === 503) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }
    const uDoc = uRes.ok ? await uRes.json() : null;
    const wardrobePublic = uDoc?.fields?.wardrobePublic?.booleanValue === true;
    if (!wardrobePublic) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ wardrobePublic: false });
    }

    // 2) 读单品（+ 非 limit 变体才读 best match）
    const items = await runQuery('wardrobe_items', uid);
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    let matches: any[] = [];
    if (!limit) {
      matches = await runQuery('best_matches', uid);
      matches.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    let outItems = items;
    if (limit) {
      // 卡墙 / 示例卡：有图优先，切前 N 件（响应小、登录页带宽低）
      outItems = [...items]
        .sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0))
        .slice(0, limit);
    }

    // 所有公开图片统一改写为 /api/img。
    // 这样无论底层存的是 base64、旧公网 URL，还是新的 Blob path，
    // 对外都只暴露一层可撤销、短缓存的应用内地址。
    const rewriteImg = (val: any, apiPath: string): string | undefined => {
      if (!val || typeof val !== 'string') return undefined;
      return apiPath;
    };
    // 注意：迁移会把原 base64 备份到 imageUrlBackup/photoBackup —— 公开 JSON 必须剔除，否则又把 base64 灌回来。
    outItems = outItems.map((it) => {
      const out: any = { ...it, imageUrl: rewriteImg(it.imageUrl, `/api/img/${uid}/${it.id}`) };
      delete out.imageUrlBackup;
      return out;
    });
    matches = matches.map((m) => {
      const out: any = { ...m, photoBase64: rewriteImg(m.photoBase64, `/api/img/${uid}/${m.id}?c=match`) };
      delete out.photoBackup;
      return out;
    });

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=0');
    return res.status(200).json({ wardrobePublic: true, items: outItems, matches });
  } catch (e: any) {
    if (e?.status === 429 || e?.status === 503) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }
    if (e?.status === 403) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ wardrobePublic: false });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
