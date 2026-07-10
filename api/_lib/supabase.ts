const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const config = () => { if (!url || !key) throw new Error('Supabase server environment is not configured'); return { url, key }; };
export async function verifySupabaseToken(token: string) { const c = config(); const r = await fetch(`${c.url}/auth/v1/user`, { headers: { apikey: c.key, authorization: `Bearer ${token}` } }); if (!r.ok) throw new Error('invalid token'); return r.json() as Promise<{ id: string; email?: string }>; }
export async function supabaseRest(path: string, init: RequestInit = {}, token?: string) { const c = config(); return fetch(`${c.url}/rest/v1/${path}`, { ...init, headers: { apikey: c.key, authorization: `Bearer ${token || c.key}`, 'content-type': 'application/json', ...(init.headers || {}) } }); }
