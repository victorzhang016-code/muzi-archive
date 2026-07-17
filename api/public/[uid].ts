import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from '../_lib/devGuard.js';
import { supabaseRest } from '../_lib/supabase.js';
import { rewritePublicWardrobe } from '../_lib/publicMedia.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const publicId = String(req.query.uid || '').trim();
  if (!publicId) return res.status(400).json({ error: 'public id required' });

  let limit: number | null = null;
  if (req.query.limit != null) {
    const parsed = Number(req.query.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 200' });
    }
    limit = parsed;
  }

  try {
    const response = await supabaseRest('rpc/get_public_wardrobe', {
      method: 'POST',
      body: JSON.stringify({ p_public_id: publicId, p_limit: limit }),
    });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }

    const data = await response.json();
    if (!data) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ wardrobePublic: false });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(rewritePublicWardrobe(data, publicId));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'busy' });
  }
}
