import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdFirestore } from '../../_lib/devGuard';

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

function versionFor(data: any): string | number | undefined {
  return data?.updatedAt || data?.createdAt || undefined;
}

function withVersion(url: string, version?: string | number): string {
  if (version == null) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(version))}`;
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
    if (out.imageUrl) out.imageUrl = withVersion(`/api/img/${uid}/${id}`, versionFor(data));
    delete out.imageUrlBackup;

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ item: out });
  } catch (e: any) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
