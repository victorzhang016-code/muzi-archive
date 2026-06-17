import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { WardrobeItem } from '../types';
import { SharedItemCard } from './SharedItemCard';
import { fetchPublicWardrobe, SharingDisabledError } from '../lib/publicWardrobe';
import { Loader2, Lock, ArrowRight } from 'lucide-react';

export function SharedItemView() {
  const { userId, itemId } = useParams<{ userId: string; itemId: string }>();
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [tempError, setTempError] = useState(false);

  useEffect(() => {
    if (!item) return;
    const brand = item.brand ? `${item.brand} ` : '';
    document.title = `${brand}${item.name} — 衣LOG 穿搭单品`;
    return () => { document.title = '衣LOG'; };
  }, [item]);

  useEffect(() => {
    if (!itemId || !userId) return;
    fetchPublicWardrobe(userId)
      .then(({ items }) => {
        const found = items.find((i) => i.id === itemId);
        if (found) setItem(found);
        else setDenied(true);
      })
      .catch((e) => {
        // 未开分享 = 未公开；其它（额度/网络）= 临时不可用
        if (e instanceof SharingDisabledError) setDenied(true);
        else setTempError(true);
      })
      .finally(() => setLoading(false));
  }, [itemId, userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (tempError) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Temporarily Unavailable</p>
          <p className="font-story text-ink/80 mb-2">暂时加载不出来</p>
          <p className="font-story text-graphite/55 text-sm mb-6">服务器有点忙，请稍后再刷新试试。</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 border border-graphite/30 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (denied || !item) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-10 h-10 text-graphite/25 mx-auto mb-5" />
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Not Available</p>
          <p className="font-story text-graphite/60">此内容未公开或已删除</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-kraft text-ink font-sans selection:bg-stamp selection:text-white">
      <header className="sticky top-0 z-40 bg-kraft/90 backdrop-blur-md border-b border-dashed border-graphite/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-tag font-bold text-ink" style={{ fontSize: '1.05rem', letterSpacing: '0.06em' }}>
              衣LOG
            </h1>
            <span className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/50 border border-dashed border-graphite/25 px-2 py-0.5">
              只读
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <SharedItemCard item={item} />

        <Link
          to={`/share/${userId}`}
          className="mt-8 w-full flex items-center justify-center gap-2 px-5 py-3 border border-graphite/25 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider"
        >
          查看完整衣柜
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </main>
    </div>
  );
}
