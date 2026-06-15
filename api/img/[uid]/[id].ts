import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 公开图片接口（Phase 2 带宽优化）——把单条文档里的 base64 图解码成 JPEG bytes 返回，
 * 长缓存（1 天）。公开页不再内联 8.58MB base64，改成引用这些 URL，按需/懒加载。
 *
 * 安全：未鉴权 REST 读取受 Firestore 规则约束（未开分享的库直接被拒），再校验 userId 匹配。
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
    const r = await fetch(`${BASE}/${collection}/${id}`);
    if (r.status === 429 || r.status === 503) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).send('busy');
    }
    if (r.status === 403) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.status(403).send('forbidden');
    }
    if (!r.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(404).send('not found');
    }
    const doc: any = await r.json();
    const ownerId = doc?.fields?.userId?.stringValue;
    const dataUrl = doc?.fields?.[field]?.stringValue;
    if (ownerId !== uid || !dataUrl) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(404).send('no image');
    }

    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(dataUrl);
    const mime = m ? m[1] : 'image/jpeg';
    const b64 = m ? m[2] : dataUrl;
    const buf = Buffer.from(b64, 'base64');

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).end(buf);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).send('error');
  }
}
