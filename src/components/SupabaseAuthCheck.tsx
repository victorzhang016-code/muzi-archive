import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { signInWithGoogleIdToken } from '../lib/googleIdToken';

export function SupabaseAuthCheck() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError('Supabase 前端环境变量尚未配置。');
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data, error: authError }) => {
      setUser(data.user);
      setError(authError?.message ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async () => {
    if (!supabase) return;
    setError(null);
    try { await signInWithGoogleIdToken(); } catch (error) { setError(error instanceof Error ? error.message : 'Google 登录失败'); }
  };

  const logout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  const providers = user?.identities?.map((identity) => identity.provider).join(', ') || '无';

  return (
    <main className="min-h-screen bg-kraft flex items-center justify-center px-6 text-ink">
      <section className="w-full max-w-md rounded-2xl border border-graphite/20 bg-white/80 p-7 shadow-sm">
        <h1 className="font-story text-xl font-bold">Supabase 登录绑定检查</h1>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          此页面只验证 Google 身份是否绑定到迁移账号，不读取或修改衣柜数据。
        </p>

        {loading ? (
          <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-graphite" />
        ) : user ? (
          <div className="mt-6 space-y-3 text-sm">
            <p><span className="text-graphite">邮箱：</span>{user.email}</p>
            <p><span className="text-graphite">登录方式：</span>{providers}</p>
            <p className={providers.includes('google') ? 'text-green-700' : 'text-stamp'}>
              {providers.includes('google') ? 'Google 已成功绑定。' : '当前尚未检测到 Google identity。'}
            </p>
            <button onClick={logout} className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200">
              <LogOut className="h-4 w-4" />退出 Supabase 测试登录
            </button>
          </div>
        ) : (
          <button onClick={login} className="mt-6 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-kraft hover:bg-ink/85">
            使用 Google 验证并绑定
          </button>
        )}

        {error && <p className="mt-4 rounded-lg border border-stamp/25 bg-stamp/5 p-3 text-xs text-stamp">{error}</p>}
      </section>
    </main>
  );
}
