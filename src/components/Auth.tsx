import { useEffect, useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { signInWithGoogleIdToken } from '../lib/googleIdToken';

export interface AppUser { uid: string; email: string | null; displayName: string | null; photoURL: string | null; publicId: string }
let cachedUser: AppUser | null = null;
export const getCachedUser = () => cachedUser;
export async function getAccessToken() { const { data } = await supabase!.auth.getSession(); return data.session?.access_token ?? null; }

async function appUser(raw: any): Promise<AppUser> {
  const { data, error } = await supabase!.from('profiles').select('public_id').eq('id', raw.id).single();
  if (error) throw error;
  return { uid: raw.id, email: raw.email ?? null, displayName: raw.user_metadata?.full_name ?? raw.user_metadata?.name ?? raw.email ?? null, photoURL: raw.user_metadata?.avatar_url ?? raw.user_metadata?.picture ?? null, publicId: data.public_id };
}

function message(error: unknown) { return error instanceof Error ? error.message : '登录失败，请稍后重试。'; }

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(cachedUser);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) { setAuthError('Supabase 未配置'); setLoading(false); return; }
    const sync = async (raw: any) => { try { const next = raw ? await appUser(raw) : null; cachedUser = next; setUser(next); } catch (e) { setAuthError(message(e)); } finally { setLoading(false); } };
    supabase.auth.getUser().then(({ data }) => sync(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => sync(session?.user ?? null), 0); });
    return () => data.subscription.unsubscribe();
  }, []);
  const login = async () => { setAuthError(null); try { await signInWithGoogleIdToken(); } catch (e) { setAuthError(message(e)); } };
  const emailLogin = async (email: string, password: string) => { setAuthError(null); const { error } = await supabase!.auth.signInWithPassword({ email, password }); if (error) { setAuthError(message(error)); return false; } return true; };
  const emailRegister = async (email: string, password: string) => { setAuthError(null); const { error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); if (error) { setAuthError(message(error)); return false; } return true; };
  const resetPassword = async (email: string) => { setAuthError(null); const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (error) { setAuthError(message(error)); return false; } return true; };
  const logout = async () => { await supabase!.auth.signOut(); cachedUser = null; setUser(null); };
  return { user, loading, login, emailLogin, emailRegister, resetPassword, logout, authError };
}

export function AuthButton() {
  const { user, loading, logout } = useAuth();
  if (loading) return <button disabled className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /></button>;
  if (!user) return null;
  return <div className="flex items-center gap-3">{user.photoURL && <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />}<span className="text-sm font-medium text-gray-700 hidden sm:block">{user.displayName}</span><button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors text-sm font-medium"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">退出</span></button></div>;
}
