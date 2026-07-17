import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from '../../_lib/devGuard.js';
import { supabaseRest } from '../../_lib/supabase.js';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function legacyDataUrl(value: string) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(value);
  if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES
    ? { bytes, contentType: match[1] }
    : null;
}

function isAllowedBlobUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'public.blob.vercel-storage.com'
        || parsed.hostname.endsWith('.public.blob.vercel-storage.com'));
  } catch {
    return false;
  }
}

async function readImage(value: string) {
  const legacy = legacyDataUrl(value);
  if (legacy) return legacy;
  if (!isAllowedBlobUrl(value)) return null;

  const upstream = await fetch(value, { redirect: 'error' });
  if (!upstream.ok) return null;
  const contentLength = Number(upstream.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) return null;
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return {
    bytes,
    contentType: upstream.headers.get('content-type')?.split(';', 1)[0] || 'image/jpeg',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const publicId = String(req.query.uid || '').trim();
  const id = String(req.query.id || '').trim();
  const isMatch = req.query.c === 'match';
  if (!publicId || !id) return res.status(400).end();

  try {
    const rpc = isMatch ? 'get_public_match' : 'get_public_item';
    const response = await supabaseRest(`rpc/${rpc}`, {
      method: 'POST',
      body: JSON.stringify({ p_public_id: publicId, p_id: id }),
    });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).end();
    }

    const data = await response.json();
    const value = isMatch ? data?.match?.photoBase64 : data?.imageUrl;
    if (!value || typeof value !== 'string') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).end();
    }

    const image = await readImage(value);
    if (!image) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).end();
    }

    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', String(image.bytes.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // One-hour cache keeps read pressure bounded while limiting un-share delay.
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=0');
    return res.status(200).end(image.bytes);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).end();
  }
}
