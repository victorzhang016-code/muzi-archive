import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';

/**
 * 公开图片接口：所有公开分享页图片都经由这里返回。
 * 这样分享关闭后，CDN 最长只保留短缓存，图片也会一起失效。
 *
 * 兼容三种历史/现存格式：
 * - data:base64
 * - 旧的公开 https URL
 * - 新的 Blob path（如 items/<uid>/<id>.jpg）
 *
 * 安全：未鉴权 REST 读取受 Firestore 规则约束，再叠加 shareEnabled 与 owner 校验。
 * /api/img/:uid/:id        → wardrobe_items/{id}.imageUrl
 * /api/img/:uid/:id?c=match → best_matches/{id}.photoBase64
 */

const PROJECT = 'gen-lang-client-0133868878';
const DB = 'ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${encodeURIComponent(DB)}/documents`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const uid = req.query.uid as string;
  const id = req.query.id as string;
  const isMatch = (req.query.c as string) === 'match';
  const collection = isMatch ? 'best_matches' : 'wardrobe_items';
  const field = isMatch ? 'photoBase64' : 'imageUrl';
  if (!uid || !id) return res.status(400).send('bad request');

  try {
    // 先读目标 doc，拿到 userId / 图片字段 / 单条 shared 标记
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

    // 闸门：这一条单独分享，或主人开启了整柜公开
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
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=0');
    return res.status(200).end(buf);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send('error');
  }
}
