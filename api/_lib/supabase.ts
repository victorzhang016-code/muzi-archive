const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const environment = String(process.env.SUPABASE_ENV || '').trim().toLowerCase();
const deployment = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
const allowHostedDevelopment = ['1', 'true', 'yes', 'on'].includes(String(process.env.ALLOW_HOSTED_SUPABASE_DEV || '').trim().toLowerCase());

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

const config = () => {
  if (!url || !key) throw new Error('Supabase server environment is not configured');
  const isProduction = deployment === 'production';
  if (isProduction && environment !== 'production') throw new Error('Production requires SUPABASE_ENV=production');
  if (!isProduction && environment !== 'development') throw new Error('Preview/local requires SUPABASE_ENV=development');
  if (!isProduction && !isLocalUrl(url) && !allowHostedDevelopment) {
    throw new Error('Hosted development Supabase requires ALLOW_HOSTED_SUPABASE_DEV=true');
  }
  return { url, key };
};
export async function verifySupabaseToken(token: string) { const c = config(); const r = await fetch(`${c.url}/auth/v1/user`, { headers: { apikey: c.key, authorization: `Bearer ${token}` } }); if (!r.ok) throw new Error('invalid token'); return r.json() as Promise<{ id: string; email?: string }>; }
export async function supabaseRest(path: string, init: RequestInit = {}, token?: string) { const c = config(); return fetch(`${c.url}/rest/v1/${path}`, { ...init, headers: { apikey: c.key, authorization: `Bearer ${token || c.key}`, 'content-type': 'application/json', ...(init.headers || {}) } }); }
