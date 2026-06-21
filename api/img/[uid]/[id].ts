import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import { blockDevProdFirestore } from '../../_lib/devGuard';

const PROJECT = 'gen-lang-client-0133868878';
const DB = 'ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${encodeURIComponent(DB)}/documents`;

function withVersionHeader(res: VercelResponse): void {
  // 1 小时缓存、不 SWR：图片回源每张每小时 ≤1 次 Firestore 读（省额度），
  // 同时把「取消分享后图片直链最长可见」收敛到 ~1 小时（无 purge 能力下的折中）。
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=0');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdFirestore(res)) return;

  const uid = req.query.uid as string;
  const id = req.query.id as string;
  const isMatch = (req.query.c as string) === 'match';
  const collection = isMatch ? 'best_matches' : 'wardrobe_items';
  const field = isMatch ? 'photoBase64' : 'imageUrl';
  if (!uid || !id) return res.status(400).send('bad request');

  try {
    const r = await fetch(`${BASE}/${collection}/${id}`);
    if (r.status === 429 || r.status === 503) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).send('busy');
    }
    if (!r.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).send('not found');
    }
    const doc: any = await r.json();
    const ownerId = doc?.fields?.userId?.stringValue;
    const raw = doc?.fields?.[field]?.stringValue;
    const docShared = doc?.fields?.shared?.booleanValue === true;
    if (ownerId !== uid || !raw) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).send('no image');
    }

    if (!docShared) {
      const shareRes = await fetch(`${BASE}/wardrobe_users/${uid}`);
      const shareDoc: any = shareRes.ok ? await shareRes.json() : null;
      if (shareDoc?.fields?.wardrobePublic?.booleanValue !== true) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).send('no image');
      }
    }

    let mime = 'image/jpeg';
    let buf: Buffer;
    if (/^https?:\/\//i.test(raw)) {
      const imgRes = await fetch(raw);
      if (!imgRes.ok) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).send('no image');
      }
      mime = imgRes.headers.get('content-type') || mime;
      buf = Buffer.from(await imgRes.arrayBuffer());
    } else if (raw.startsWith('data:')) {
      const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(raw);
      mime = m ? m[1] : 'image/jpeg';
      const b64 = m ? m[2] : raw;
      buf = Buffer.from(b64, 'base64');
    } else {
      const blob = await get(raw, { access: 'public' });
      if (!blob || blob.statusCode !== 200) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(404).send('no image');
      }
      mime = blob.blob.contentType || mime;
      buf = Buffer.from(await new Response(blob.stream).arrayBuffer());
    }

    res.setHeader('Content-Type', mime);
    withVersionHeader(res);
    return res.status(200).end(buf);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send('error');
  }
}
