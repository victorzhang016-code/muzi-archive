import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthButton, useAuth } from './components/Auth';
import { WardrobeList } from './components/WardrobeList';
import { ItemDetail } from './components/ItemDetail';
import { ShareView } from './components/ShareView';
import { SharedItemView } from './components/SharedItemView';
import { SharedBestMatchView } from './components/SharedBestMatchView';
import { LoginMarquee } from './components/LoginMarquee';
import { BestMatchGallery } from './components/BestMatchGallery';
import { BestMatchBuilder } from './components/BestMatchBuilder';
import { BestMatchDetail } from './components/BestMatchDetail';
import { WardrobeProvider } from './contexts/WardrobeContext';
import { BestMatchProvider } from './contexts/BestMatchContext';
import { FeedbackPrompt } from './components/FeedbackPrompt';
import { SupabaseAuthCheck } from './components/SupabaseAuthCheck';
import { ResetPassword } from './components/ResetPassword';
import { supabase } from './lib/supabase';
import { Shirt, Loader2, ExternalLink, Copy, Check } from 'lucide-react';

// Google OAuth 不支持在各类 App 内置浏览器中登录
const isWebView = /MicroMessenger|WeiBo|QQ\/|MQQBrowser|BytedanceWebview|Line\/|FBAN|FBAV|Instagram|Twitter|Snapchat|Pinterest|LinkedInApp/i.test(navigator.userAgent)
  // Android WebView 特征
  || /Android.*Version\/\d+\.\d+.*Chrome\/\d+/i.test(navigator.userAgent)
  // iOS WebView（没有 Safari 标识）
  || (/iPhone|iPad/.test(navigator.userAgent) && !/Safari\//.test(navigator.userAgent) && /AppleWebKit/.test(navigator.userAgent));

function LoginPage() {
  const { login, emailLogin, emailRegister, resetPassword, authError } = useAuth();
  const navigate = useNavigate();
  const [linkCopied, setLinkCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailNote, setEmailNote] = useState<string | null>(null);

  const copyCurrentLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="relative min-h-screen bg-kraft flex flex-col items-center justify-center px-6 overflow-hidden selection:bg-stamp selection:text-white">
      {/* 背景卡墙（模糊、持续滚动） */}
      <LoginMarquee />
      {/* 可读性渐隐遮罩：保证中部文字清晰 */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 50%, rgba(221,216,204,0.92) 0%, rgba(221,216,204,0.78) 45%, rgba(221,216,204,0.45) 100%)',
        }}
      />
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full">
        {/* Logo mark */}
        <div className="mb-8">
          <Shirt className="w-14 h-14 text-stamp mx-auto mb-4" strokeWidth={1.5} />
          <h1
            className="font-tag font-bold text-ink"
            style={{ fontSize: '1.7rem', letterSpacing: '0.12em' }}
          >
            {/* 「衣」用简洁有力的无衬线 CJK 字体，与 JetBrains Mono 的 LOG 视觉统一 */}
            <span style={{ fontFamily: '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", sans-serif', fontWeight: 800 }}>衣</span>LOG
          </h1>
          <p className="font-tag text-[10px] uppercase tracking-[0.45em] text-graphite/50 mt-1.5">
            wearlog
          </p>
        </div>

        {/* Tagline */}
        <h2 className="text-2xl sm:text-3xl font-story font-bold text-ink tracking-tight mb-3">
          记录你的穿搭与衣橱故事
        </h2>
        <p className="text-sm sm:text-base text-graphite mb-10 leading-relaxed font-story">
          每一件衣服都有它的故事。<br />
          登录后开始记录购买经历、穿搭感受和那些难忘的瞬间。
        </p>

        {isWebView ? (
          /* 微信 / WebView 内无法用 Google 登录，引导用外部浏览器打开 */
          <div className="w-full max-w-xs flex flex-col items-center gap-4">
            <div className="w-full rounded-2xl border border-dashed border-graphite/30 bg-white/50 px-5 py-5 text-center">
              <ExternalLink className="w-6 h-6 text-graphite mx-auto mb-3" />
              <p className="text-sm font-story text-ink font-medium mb-1">请在系统浏览器中打开</p>
              <p className="text-xs text-graphite leading-relaxed mb-4">
                微信 / App 内置浏览器无法使用 Google 登录。<br />
                复制链接后，粘贴到 <span className="font-medium">Safari 或 Chrome</span> 打开即可。
              </p>
              <button
                onClick={copyCurrentLink}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-ink hover:bg-ink/85 text-kraft transition-colors text-sm font-medium shadow-sm"
              >
                {linkCopied ? <Check className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                {linkCopied ? '已复制链接 ✓' : '复制链接'}
              </button>
            </div>
          </div>
        ) : (
          /* 正常浏览器：Google 登录按钮 */
          <button
            onClick={login}
            className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-ink hover:bg-ink/85 text-kraft transition-colors text-sm font-medium shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 账号登录
          </button>
        )}

        {!isWebView && (
          <div className="mt-4 w-full max-w-xs space-y-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="邮箱" className="w-full rounded-full border border-graphite/20 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-ink" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="密码（至少 8 位）" className="w-full rounded-full border border-graphite/20 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-ink" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => emailLogin(email, password)} className="rounded-full border border-ink px-3 py-2 text-sm">邮箱登录</button>
              <button onClick={async () => { if (await emailRegister(email, password)) setEmailNote('验证邮件已发送，请验证后登录。'); }} className="rounded-full border border-ink px-3 py-2 text-sm">注册</button>
            </div>
            <button onClick={async () => { if (await resetPassword(email)) setEmailNote('重置邮件已发送。'); }} className="text-xs text-graphite underline">忘记密码</button>
            {emailNote && <p className="text-xs text-graphite">{emailNote}</p>}
          </div>
        )}

        {authError && (
          <p className="mt-4 w-full max-w-xs text-xs text-stamp bg-stamp/5 border border-stamp/25 px-4 py-3 leading-relaxed font-story text-left">
            {authError}
          </p>
        )}

        {/* 不登录也能看：作者的公开衣柜（理想态示例）—— 红色强引导，与深色登录按钮形成双主按钮 */}
        <button
          onClick={() => navigate('/author')}
          className="mt-4 w-full max-w-xs flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-stamp text-white hover:bg-stamp/90 transition-colors text-sm font-medium shadow-sm"
        >
          先看看作者的衣柜
          <span aria-hidden>→</span>
        </button>

        <p className="mt-6 text-xs text-graphite/60 font-story leading-relaxed">
          需 Google 账号登录，当前需在科学上网环境下使用。<br />
          登录即代表你的衣柜数据将与 Google 账号绑定。
        </p>
      </div>
    </div>
  );
}

const PAGE_EASE = [0.22, 1, 0.36, 1] as const;
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: PAGE_EASE } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.1, ease: 'easeIn' as const } },
};

function PageRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Routes location={location}>
          <Route path="/" element={<WardrobeList />} />
          <Route path="/item/:id" element={<ItemDetail />} />
          <Route path="/best-match" element={<BestMatchGallery />} />
          <Route path="/best-match/new" element={<BestMatchBuilder />} />
          <Route path="/best-match/:id" element={<BestMatchDetail />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kraft">
        <Loader2 className="w-8 h-8 text-graphite animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-kraft text-ink font-sans selection:bg-stamp selection:text-white">
      <header className="sticky top-0 z-40 bg-kraft/90 backdrop-blur-md border-b border-dashed border-graphite/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <h1 className="font-tag font-bold text-ink group-hover:text-stamp transition-colors" style={{ fontSize: '1.05rem', letterSpacing: '0.06em' }}>
              衣LOG
            </h1>
          </Link>
          <AuthButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <WardrobeProvider uid={user.uid}>
          <BestMatchProvider uid={user.uid}>
            <PageRoutes />
            <FeedbackPrompt />
          </BestMatchProvider>
        </WardrobeProvider>
      </main>
    </div>
  );
}

/**
 * Supabase recovery links may land on the configured Site URL when the email
 * template uses {{ .SiteURL }} instead of {{ .RedirectTo }}. In that case the
 * recovery session is still valid, but the normal auth guard would render the
 * wardrobe home page. Keep recovery flows isolated from the normal login flow.
 */
function RecoveryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) return;

    const redirectToResetPassword = () => {
      if (window.location.pathname !== '/reset-password') {
        navigate('/reset-password', { replace: true });
      }
    };

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        redirectToResetPassword();
      }
    });

    // The hash/query marker is useful as a fallback for a recovery link that
    // was opened after the Supabase client had already restored a session.
    const hashType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
    const queryType = new URLSearchParams(window.location.search).get('type');
    if (hashType === 'recovery' || queryType === 'recovery') {
      void supabase.auth.getSession().then(({ data: sessionData }) => {
        if (sessionData.session) redirectToResetPassword();
      });
    }

    return () => data.subscription.unsubscribe();
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <RecoveryRedirect />
        <Routes>
          <Route path="/share/:userId/item/:itemId" element={<SharedItemView />} />
          <Route path="/share/:userId/best-match/:matchId" element={<SharedBestMatchView />} />
          <Route path="/share/:userId" element={<ShareView />} />
          <Route path="/author" element={
            import.meta.env.VITE_AUTHOR_UID
              ? <Navigate to={`/share/${import.meta.env.VITE_AUTHOR_UID}`} replace />
              : <Navigate to="/" replace />
          } />
          <Route path="/auth-check" element={<SupabaseAuthCheck />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
