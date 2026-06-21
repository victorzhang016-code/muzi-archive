import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';

function blobPathFromQuery(path: string | string[] | undefined): string {
  const raw = Array.isArray(path) ? path.join('/') : (path || '');
  return decodeURIComponent(raw);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const blobPath = blobPathFromQuery(req.query.path);
  if (!blobPath) return res.status(400).send('bad request');

  const blob = await get(blobPath, { access: 'public' });
  if (!blob || blob.statusCode !== 200) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send('not found');
  }

  res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=0');
  return res.status(200).end(Buffer.from(await new Response(blob.stream).arrayBuffer()));
}
