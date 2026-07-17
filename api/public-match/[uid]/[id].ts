import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from '../../_lib/devGuard.js';
import { supabaseRest } from '../../_lib/supabase.js';
import { rewritePublicMatch } from '../../_lib/publicMedia.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const publicId = String(req.query.uid || '').trim();
  const matchId = String(req.query.id || '').trim();
  if (!publicId || !matchId) return res.status(400).json({ error: 'public id and match id required' });

  try {
    const response = await supabaseRest('rpc/get_public_match', {
      method: 'POST',
      body: JSON.stringify({ p_public_id: publicId, p_id: matchId }),
    });
    if (!response.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'busy' });
    }

    const data = await response.json();
    if (!data) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ shared: false });
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(rewritePublicMatch(data, publicId));
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'busy' });
  }
}
