import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { blockDevProdServices } from './_lib/devGuard';
import { verifySupabaseToken } from './_lib/supabase';

/**
 * 图片上传端点（Phase 3：图片搬出 Firestore）。
 *
 * 客户端把压缩后的小图（~70KB JPEG）以 base64 传上来，服务端验证 Firebase 身份后
 * 用 `put()` 存进 Vercel Blob（public），返回公开 URL；前端把这个 URL 存进 Firestore
 * 文档（不再存 base64）。公开看图直接走 Blob CDN，0 次 Firestore 读、发版不清。
 *
 * 鉴权：用 `jose` 验证 Firebase ID token（RS256，Google 公钥 JWKS），取 sub 作 uid，
 * 把 Blob 路径限定到 items/{uid}/，防越权。无需 firebase-admin。
 */

async function verifyUid(idToken: string): Promise<string> {
  return (await verifySupabaseToken(idToken)).id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // 1) 鉴权
  let uid: string;
  try {
    const header = (req.headers.authorization || '') as string;
    const idToken = header.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) return res.status(401).json({ error: 'missing token' });
    uid = await verifyUid(idToken);
  } catch (e: any) {
    return res.status(401).json({ error: `auth failed: ${e?.message || 'invalid token'}` });
  }

  // 2) 解析 base64 图
  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) || {};
    const image: string = body.image || '';
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(image);
    if (!m) return res.status(400).json({ error: 'bad image payload' });
    const mime = m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0) return res.status(400).json({ error: 'empty image' });
    if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'image too large' });

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    // 3) 存 Blob（路径含 uid，防越权；随机文件名防碰撞）
    const blobPath = `items/${uid}/${randomUUID()}.${ext}`;
    const { url } = await put(blobPath, buf, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    });
    return res.status(200).json({ url, blobPath });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'upload failed' });
  }
}
