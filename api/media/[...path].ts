import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import { blockDevProdServices } from '../_lib/devGuard.js';

function blobPathFromQuery(path: string | string[] | undefined): string {
  const raw = Array.isArray(path) ? path.join('/') : (path || '');
  return decodeURIComponent(raw);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');
  const blobPath = blobPathFromQuery(req.query.path);
  if (!blobPath) return res.status(400).send('bad request');
  if (!/^items\/[^/]+\/[^/]+$/.test(blobPath) || blobPath.includes('..')) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).send('bad blob path');
  }

  let blob;
  try {
    blob = await get(blobPath, { access: 'public' });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send('storage unavailable');
  }
  if (!blob || blob.statusCode !== 200) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send('not found');
  }

  res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream');
  // 与 /api/img 一致：1 小时缓存、不 SWR（省额度 + 撤销窗口 ~1 小时）。
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=0');
  return res.status(200).end(Buffer.from(await new Response(blob.stream).arrayBuffer()));
}
