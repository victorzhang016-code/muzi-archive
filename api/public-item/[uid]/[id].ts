import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from '../../_lib/devGuard.js';
import { supabaseRest } from '../../_lib/supabase.js';
import { rewritePublicItem } from '../../_lib/publicMedia.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const publicId = String(req.query.uid || '').trim();
  const itemId = String(req.query.id || '').trim();
  if (!publicId || !itemId) return res.status(400).json({ error: 'public id and item id required' });

  try {
    const response = await supabaseRest('rpc/get_public_item', {
      method: 'POST',
      body: JSON.stringify({ p_public_id: publicId, p_id: itemId }),
    });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }

    const item = await response.json();
    if (!item) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ item: rewritePublicItem(item, publicId) });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'busy' });
  }
}
