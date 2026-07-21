import { useEffect, useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { signInWithGoogleIdToken } from '../lib/googleIdToken';
import { getEmailRedirectUrl } from '../lib/onboarding';

export interface AppUser { uid: string; email: string | null; displayName: string | null; photoURL: string | null; publicId: string }
let cachedUser: AppUser | null = null;
let cachedPendingEmail: string | null = null;
let cachedEmailVerificationRequired = false;
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
  const [pendingEmail, setPendingEmail] = useState<string | null>(cachedPendingEmail);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(cachedEmailVerificationRequired);
  useEffect(() => {
    if (!supabase) { setAuthError('Supabase 未配置'); setLoading(false); return; }
    const sync = async (raw: any) => {
      try {
        const unconfirmed = raw && raw.email && !raw.email_confirmed_at;
        cachedEmailVerificationRequired = !!unconfirmed;
        cachedPendingEmail = unconfirmed ? raw.email : null;
        setEmailVerificationRequired(!!unconfirmed);
        setPendingEmail(unconfirmed ? raw.email : null);
        const next = raw && !unconfirmed ? await appUser(raw) : null;
        cachedUser = next;
        setUser(next);
      } catch (e) { setAuthError(message(e)); } finally { setLoading(false); }
    };
    supabase.auth.getUser().then(({ data }) => sync(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => sync(session?.user ?? null), 0); });
    return () => data.subscription.unsubscribe();
  }, []);
  const login = async () => { setAuthError(null); try { await signInWithGoogleIdToken(); } catch (e) { setAuthError(message(e)); } };
  const emailLogin = async (email: string, password: string) => {
    setAuthError(null); setEmailVerificationRequired(false);
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) {
      if (/email.*confirm|confirm.*email|not confirmed/i.test(error.message)) {
        cachedPendingEmail = email; cachedEmailVerificationRequired = true;
        setPendingEmail(email); setEmailVerificationRequired(true);
        setAuthError('这个邮箱还没有完成验证，请先查收验证邮件。');
      } else setAuthError(message(error));
      return false;
    }
    return true;
  };
  const emailRegister = async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: getEmailRedirectUrl() } });
    if (error) { setAuthError(message(error)); return false; }
    cachedPendingEmail = email; cachedEmailVerificationRequired = true;
    setPendingEmail(email); setEmailVerificationRequired(true);
    return true;
  };
  const resendSignupEmail = async () => {
    if (!pendingEmail) return false;
    setAuthError(null);
    const { error } = await supabase!.auth.resend({ type: 'signup', email: pendingEmail, options: { emailRedirectTo: getEmailRedirectUrl() } });
    if (error) { setAuthError(message(error)); return false; }
    return true;
  };
  const resetPassword = async (email: string) => { setAuthError(null); const { error } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); if (error) { setAuthError(message(error)); return false; } return true; };
  const logout = async () => { await supabase!.auth.signOut(); cachedUser = null; cachedPendingEmail = null; cachedEmailVerificationRequired = false; setUser(null); };
  return { user, loading, login, emailLogin, emailRegister, resendSignupEmail, resetPassword, logout, authError, pendingEmail, emailVerificationRequired };
}

export function AuthButton({ className = '' }: { className?: string }) {
  const { user, loading, logout } = useAuth();
  if (loading) return <button disabled className={`flex items-center gap-2 min-h-10 px-3 border border-graphite/20 bg-tag/60 text-graphite/50 ${className}`}><Loader2 className="w-4 h-4 animate-spin" /></button>;
  if (!user) return null;
  return <div className={`flex items-center gap-2 ${className}`}>{user.photoURL && <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />}<span className="font-story text-[13px] text-graphite/75 hidden sm:block max-w-28 truncate">{user.displayName}</span><button onClick={logout} className="flex min-h-10 items-center gap-2 px-3 border border-graphite/20 bg-tag/60 hover:border-graphite/45 hover:text-ink text-graphite/75 transition-colors font-story text-[13px] whitespace-nowrap"><LogOut className="w-4 h-4" /><span>退出</span></button></div>;
}
