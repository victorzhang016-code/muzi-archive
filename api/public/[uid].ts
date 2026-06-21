import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdFirestore } from '../_lib/devGuard';

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
  const out: any = {};
  for (const k in fields) out[k] = decodeValue(fields[k]);
  return out;
}

async function runQuery(collectionId: string, uid: string, limit?: number): Promise<any[]> {
  const query: any = {
    from: [{ collectionId }],
    where: {
      fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: uid } },
    },
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
  };
  if (limit && limit > 0) query.limit = limit;

  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query }),
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

function pickVersion(doc: any): string | number | undefined {
  return (
    doc?.updatedAt ||
    doc?.createdAt ||
    doc?.imageUpdatedAt ||
    doc?.photoUpdatedAt ||
    undefined
  );
}

function withVersion(url: string, version?: string | number): string {
  if (version == null) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(version))}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdFirestore(res)) return;

  const uid = (req.query.uid as string) || '';
  if (!uid) return res.status(400).json({ error: 'uid required' });
  const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit as string, 10) || 0) : 0;

  try {
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

    const itemLimit = limit ? Math.max(limit * 3, 30) : undefined;
    const items = await runQuery('wardrobe_items', uid, itemLimit);
    let matches: any[] = [];
    if (!limit) {
      matches = await runQuery('best_matches', uid);
    }

    let outItems = items;
    if (limit) {
      outItems = [...items]
        .sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0))
        .slice(0, limit);
    }

    const rewriteImg = (val: any, apiPath: string): string | undefined => {
      if (!val || typeof val !== 'string') return undefined;
      return apiPath;
    };

    outItems = outItems.map((it) => {
      const out: any = { ...it, imageUrl: rewriteImg(it.imageUrl, withVersion(`/api/img/${uid}/${it.id}`, pickVersion(it))) };
      delete out.imageUrlBackup;
      return out;
    });

    matches = matches.map((m) => {
      const out: any = {
        ...m,
        photoBase64: rewriteImg(m.photoBase64, withVersion(`/api/img/${uid}/${m.id}?c=match`, pickVersion(m))),
      };
      delete out.photoBackup;
      return out;
    });

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
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
