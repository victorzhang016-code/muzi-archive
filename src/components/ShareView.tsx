import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { WardrobeItem, BestMatch, Category } from '../types';
import { WardrobeItemCard } from './WardrobeItemCard';
import { SharedItemCard } from './SharedItemCard';
import { TagBundle } from './TagBundle';
import { bundleEntriesFromMatch } from '../contexts/BestMatchContext';
import { fetchPublicWardrobe, SharingDisabledError } from '../lib/publicWardrobe';
import { resolveMediaUrl } from '../lib/media';
import { cn } from '../lib/utils';
import { Loader2, X, Lock, Plus } from 'lucide-react';

const CATEGORIES: ('全部' | Category)[] = ['全部', '上装', '下装', '鞋子', '配饰'];

/** 序列末尾的「创建我自己的衣柜」卡 —— 视觉仿 Archive 的「New Tag」添加卡。 */
function CreateOwnCTA({ onClick }: { onClick: () => void }) {
  return (
    <div className="cursor-pointer" onClick={onClick} style={{ transform: 'rotate(0.8deg)' }}>
      <div className="group tag-card-bg tag-shadow flex flex-col items-center justify-center min-h-[280px] hover:translate-y-[-3px] transition-all duration-300 border border-dashed border-graphite/25 hover:border-stamp/50">
        <div className="w-12 h-12 border border-dashed border-stamp/40 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
          <Plus className="w-5 h-5 text-stamp/70" />
        </div>
        <p className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/40 mb-1">Your Turn</p>
        <span className="text-ink/70 font-story font-bold text-base">创建我自己的衣柜 →</span>
      </div>
    </div>
  );
}

function ReadOnlyItemModal({ item, onClose }: { item: WardrobeItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4"
      onClick={onClose}
    >
      <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="p-2 text-graphite hover:text-ink transition-colors border border-graphite/15 bg-tag/80 hover:bg-tag shadow-sm"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <SharedItemCard item={item} />
      </div>
    </div>
  );
}

export function ShareView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [matches, setMatches] = useState<BestMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'全部' | Category>('全部');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  // 从 Best Match 详情返回时带 state.view='matches'，落在对应 tab 而非默认单品 tab
  const [view, setView] = useState<'items' | 'matches'>(
    (location.state as { view?: 'items' | 'matches' } | null)?.view === 'matches' ? 'matches' : 'items'
  );

  useEffect(() => {
    document.title = '衣LOG · 穿搭档案 wearlog';
    return () => { document.title = '衣LOG'; };
  }, []);

  // 公开衣柜：统一走边缘缓存接口 /api/public/:uid（不直连 Firestore，省读取额度）
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchPublicWardrobe(userId)
      .then(({ items, matches }) => { setItems(items); setMatches(matches); })
      .catch((e) => {
        if (e instanceof SharingDisabledError) setAccessDenied(true);
        else setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const wardrobeMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    items.forEach((i) => m.set(i.id, i));
    return m;
  }, [items]);

  const filteredItems = items.filter(item =>
    filterCategory === '全部' || item.category === filterCategory
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-10 h-10 text-graphite/25 mx-auto mb-5" />
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Access Denied</p>
          <p className="font-story text-graphite/60">主人没有公开整个衣柜</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Temporarily Unavailable</p>
          <p className="font-story text-ink/80 mb-2">衣柜暂时加载不出来</p>
          <p className="font-story text-graphite/55 text-sm leading-relaxed mb-6">
            服务器有点忙（可能是访问量较大），请稍后再刷新试试。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 border border-graphite/30 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider"
          >
            重新加载
          </button>
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
          <p className="font-tag text-[10px] uppercase tracking-[0.15em] text-graphite/40">
            {items.length} Items
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* CTA：创建我自己的衣柜 —— 站点设计语言（直角 / 虚线 / tag 底），红实心按钮为唯一焦点 */}
        <div className="mb-10 border border-dashed border-graphite/30 bg-tag/60 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-story text-ink text-[15px] font-semibold">喜欢这种记录方式？</p>
            <p className="font-story text-graphite/70 text-[13px] mt-0.5">建一个只属于你的衣柜，记录每件衣服的故事。</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 bg-stamp text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors shadow-sm"
          >
            创建我自己的衣柜
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* 视图切换：单品 / Best Match */}
        {matches.length > 0 && (
          <div className="flex items-center gap-2 mb-8">
            <button
              onClick={() => setView('items')}
              className={cn(
                "px-5 py-2 font-tag text-[12px] uppercase tracking-[0.12em] font-semibold border transition-all",
                view === 'items'
                  ? "bg-ink text-white border-ink shadow-sm"
                  : "bg-tag/60 text-ink/55 border-graphite/25 hover:text-ink hover:border-graphite/55 hover:bg-tag"
              )}
            >
              单品
              <span className={cn("ml-1.5 text-[10px] font-normal", view === 'items' ? "text-white/60" : "text-graphite/45")}>{items.length}</span>
            </button>
            <button
              onClick={() => setView('matches')}
              className={cn(
                "px-5 py-2 font-tag text-[12px] uppercase tracking-[0.12em] font-semibold border transition-all",
                view === 'matches'
                  ? "bg-ink text-white border-ink shadow-sm"
                  : "bg-tag/60 text-ink/55 border-graphite/25 hover:text-ink hover:border-graphite/55 hover:bg-tag"
              )}
            >
              Best Match
              <span className={cn("ml-1.5 text-[10px] font-normal", view === 'matches' ? "text-white/60" : "text-graphite/45")}>{matches.length}</span>
            </button>
          </div>
        )}

        {/* ── Best Match 视图 ── */}
        {view === 'matches' && (
          <section className="mb-4">
            <p className="font-story italic text-graphite/75 text-[14px] leading-relaxed mb-8 max-w-2xl">
              Best Match 是 TA 心中「绝对没错」的搭配——把那些固定会一起穿、怎么搭都不会出错的单品组合记下来。点开任意一套，看看它由哪些单品构成。
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {matches.map((match) => {
                const entries = bundleEntriesFromMatch(match, wardrobeMap);
                return (
                  <button
                    key={match.id}
                    onClick={() => navigate(`/share/${userId}/best-match/${match.id}`)}
                    className="flex flex-col items-start gap-3 group text-left"
                  >
                    <div className="w-full rounded-xl bg-white/30 border border-dashed border-graphite/20 p-5 group-hover:border-graphite/45 group-hover:-translate-y-1 transition-all">
                      {entries.length > 0 ? (
                        <TagBundle entries={entries} size="mini" variant="stacked" />
                      ) : match.photoBase64 ? (
                        <img src={resolveMediaUrl(match.photoBase64)} alt={match.name || 'outfit'} className="w-full rounded" loading="lazy" />
                      ) : (
                        <p className="font-tag text-xs text-graphite/45 py-12 text-center">No items</p>
                      )}
                    </div>
                    {match.name && (
                      <h3 className="font-story font-bold text-base text-ink max-w-[220px] line-clamp-2">
                        {match.name}
                      </h3>
                    )}
                    {(match.sceneTags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-w-full">
                        {match.sceneTags!.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 font-tag text-[10px] uppercase tracking-wider text-graphite border border-graphite/25 bg-tag/40">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {match.story && (
                      <p className="font-story italic text-[12px] text-graphite/70 max-w-[240px] line-clamp-2">
                        {match.story}
                      </p>
                    )}
                  </button>
                );
              })}
              <CreateOwnCTA onClick={() => navigate('/')} />
            </div>
          </section>
        )}

        {/* ── 单品视图 ── */}
        {view === 'items' && (
        <>
        <div className="flex items-center gap-2 flex-wrap mb-10">
          {CATEGORIES.map(cat => {
            const isActive = filterCategory === cat;
            const count = cat === '全部' ? items.length : items.filter(i => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "relative px-5 py-2 font-tag text-[12px] uppercase tracking-[0.12em] font-semibold border transition-all",
                  isActive
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-tag/60 text-ink/55 border-graphite/25 hover:text-ink hover:border-graphite/55 hover:bg-tag"
                )}
              >
                {cat}
                <span className={cn("ml-2 text-[10px] font-normal", isActive ? "text-white/60" : "text-graphite/45")}>{count}</span>
              </button>
            );
          })}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-32">
            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/35">— Empty Archive —</p>
          </div>
        ) : (
          <div className="masonry-grid pt-4">
            {filteredItems.map((item, i) => (
              <WardrobeItemCard
                key={item.id}
                item={item}
                index={i}
                eager={false}
                onCardClick={(clickedItem) => setSelectedItem(clickedItem)}
              />
            ))}
            <CreateOwnCTA onClick={() => navigate('/')} />
          </div>
        )}
        </>
        )}
      </main>

      {selectedItem && (
        <ReadOnlyItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
