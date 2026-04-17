import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthButton, useAuth } from './components/Auth';
import { WardrobeList } from './components/WardrobeList';
import { ItemDetail } from './components/ItemDetail';
import { ShareView } from './components/ShareView';
import { MigrateData } from './components/MigrateData';
import { BestMatchGallery } from './components/BestMatchGallery';
import { BestMatchBuilder } from './components/BestMatchBuilder';
import { BestMatchDetail } from './components/BestMatchDetail';
import { WardrobeProvider } from './contexts/WardrobeContext';
import { BestMatchProvider } from './contexts/BestMatchContext';
import { Shirt, Loader2, ExternalLink } from 'lucide-react';

// Google OAuth 不支持在各类 App 内置浏览器中登录
const isWebView = /MicroMessenger|WeiBo|QQ\/|MQQBrowser|BytedanceWebview|Line\/|FBAN|FBAV|Instagram|Twitter|Snapchat|Pinterest|LinkedInApp/i.test(navigator.userAgent)
  // Android WebView 特征
  || /Android.*Version\/\d+\.\d+.*Chrome\/\d+/i.test(navigator.userAgent)
  // iOS WebView（没有 Safari 标识）
  || (/iPhone|iPad/.test(navigator.userAgent) && !/Safari\//.test(navigator.userAgent) && /AppleWebKit/.test(navigator.userAgent));

function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-kraft flex flex-col items-center justify-center px-6 selection:bg-stamp selection:text-white">
      <div className="flex flex-col items-center text-center max-w-md w-full">
        {/* Logo mark */}
        <div className="mb-8">
          <Shirt className="w-14 h-14 text-stamp mx-auto mb-4" strokeWidth={1.5} />
          <h1
            className="font-tag font-bold text-ink"
            style={{ fontSize: '1.4rem', letterSpacing: '0.08em' }}
          >
            模子の衣柜
          </h1>
        </div>

        {/* Tagline */}
        <h2 className="text-2xl sm:text-3xl font-story font-bold text-ink tracking-tight mb-3">
          记录你的衣柜故事
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
              <p className="text-xs text-graphite leading-relaxed">
                当前环境不支持 Google 登录。<br />
                请复制链接，粘贴到 <span className="font-medium">Safari 或 Chrome</span> 中打开
              </p>
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

        <p className="mt-6 text-xs text-graphite/60 font-story">
          登录即代表你的衣柜数据将与 Google 账号绑定
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
          <Route path="/migrate" element={<MigrateData />} />
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
              模子の衣柜
            </h1>
          </Link>
          <AuthButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <WardrobeProvider uid={user.uid}>
          <BestMatchProvider uid={user.uid}>
            <PageRoutes />
          </BestMatchProvider>
        </WardrobeProvider>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/share/:userId" element={<ShareView />} />
          <Route path="/author" element={
            import.meta.env.VITE_AUTHOR_UID
              ? <Navigate to={`/share/${import.meta.env.VITE_AUTHOR_UID}`} replace />
              : <Navigate to="/" replace />
          } />
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
