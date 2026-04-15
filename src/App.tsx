import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthButton, useAuth } from './components/Auth';
import { WardrobeList } from './components/WardrobeList';
import { ItemDetail } from './components/ItemDetail';
import { ShareView } from './components/ShareView';
import { WardrobeProvider } from './contexts/WardrobeContext';
import { Shirt } from 'lucide-react';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kraft">
        <div className="animate-pulse flex flex-col items-center">
          <Shirt className="w-12 h-12 text-rule mb-4" />
          <div className="h-4 w-24 bg-rule rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kraft text-ink font-sans selection:bg-stamp selection:text-white">
      {/* Header */}
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

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {!user ? (
          <div className="text-center max-w-2xl mx-auto mt-12 sm:mt-20">
            <h2 className="text-3xl sm:text-5xl font-story font-bold text-ink tracking-tight mb-4 sm:mb-6">
              记录你的衣柜故事
            </h2>
            <p className="text-base sm:text-lg text-graphite mb-8 sm:mb-10 leading-relaxed font-story">
              每一件衣服都有它的故事。在这里，你可以记录下每一件心爱衣物的购买经历、穿搭感受和那些难忘的瞬间。
            </p>
            <div className="inline-block">
              <AuthButton />
            </div>
          </div>
        ) : (
          <WardrobeProvider uid={user.uid}>
            <Routes>
              <Route path="/" element={<WardrobeList />} />
              <Route path="/item/:id" element={<ItemDetail />} />
            </Routes>
          </WardrobeProvider>
        )}
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
