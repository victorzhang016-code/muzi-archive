import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { WardrobeItem, Category } from '../types';
import { WardrobeItemCard } from './WardrobeItemCard';
import { MargielaRating } from './MargielaRating';
import { getTagTheme } from '../lib/tagThemes';
import { cn } from '../lib/utils';
import { Loader2, X, Lock } from 'lucide-react';

const CATEGORIES: ('全部' | Category)[] = ['全部', '上装', '下装', '鞋子', '配饰'];

function ReadOnlyItemModal({ item, onClose }: { item: WardrobeItem; onClose: () => void }) {
  const theme = getTagTheme(item.id);

  const createdDate = item.createdAt?.toDate?.();
  const dateStr = createdDate
    ? `${createdDate.getFullYear()}.${String(createdDate.getMonth() + 1).padStart(2, '0')}.${String(createdDate.getDate()).padStart(2, '0')}`
    : '—';

  const polaroidInner = theme.isLight
    ? { background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.10)' }
    : { background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 2px 6px rgba(0,0,0,0.35)' };

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

        <div
          className="tag-shadow relative overflow-hidden"
          style={{
            backgroundColor: theme.bgColor,
            borderStyle: 'solid',
            borderWidth: '1px',
            borderRightWidth: '1.5px',
            borderBottomWidth: '2px',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderLeftColor: 'rgba(255,255,255,0.06)',
            borderRightColor: theme.borderEdge,
            borderBottomColor: theme.borderEdge,
          }}
        >
          {theme.texture !== 'none' && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: theme.texture,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.28,
              mixBlendMode: 'multiply',
              zIndex: 0,
            }} />
          )}
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: theme.overlayColor, zIndex: 1 }} />

          <div className="relative z-10">
            {item.rating >= 9 && (
              <div className="absolute -top-4 -right-4 z-20 stamp-certified rotate-[15deg]"
                style={{ borderColor: theme.accentColor, mixBlendMode: 'normal', opacity: 0.85 }}>
                <span className="font-tag text-[7px] uppercase tracking-[0.08em] font-bold text-center leading-[1.3]"
                  style={{ color: theme.accentColor }}>
                  CERT<br/>IFIED
                </span>
              </div>
            )}

            <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
              <span className="font-tag text-[7px] uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>
                {item.id.slice(-8).toUpperCase()}
              </span>
              <div className="absolute left-1/2 top-4 -translate-x-1/2 tag-hole" style={{ backgroundColor: theme.holeColor }} />
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-tag text-[7px] uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>
                  {item.season}
                </span>
                {item.purchaseYear && (
                  <span className="font-tag text-[8px] tracking-[0.05em]" style={{ color: theme.accentColor, opacity: 0.85 }}>
                    {item.purchaseYear}
                  </span>
                )}
              </div>
            </div>

            <div className="mx-4 mb-4">
              <div style={{ padding: '8px 8px 28px 8px', ...polaroidInner }}>
                {item.imageUrl ? (
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
                      loading="eager"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[3/4] flex items-center justify-center"
                    style={{ background: theme.isLight ? '#EDE9E0' : 'rgba(255,255,255,0.05)' }}
                  >
                    <span className="font-tag text-[11px] tracking-[0.3em] uppercase" style={{ color: theme.textMuted }}>
                      No Image
                    </span>
                  </div>
                )}
                <div className="h-[28px] flex items-center justify-center">
                  <span className="font-tag text-[8px] uppercase tracking-[0.15em]"
                    style={{ color: theme.isLight ? 'rgba(107,106,101,0.45)' : 'rgba(255,255,255,0.35)' }}>
                    {item.category}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="h-px mb-5" style={{ background: theme.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }} />
              <h1 className="font-story font-bold text-3xl sm:text-4xl leading-tight tracking-tight mb-5"
                style={{ color: theme.textPrimary }}>
                {item.name && item.name !== '未命名' ? item.name : '未命名'}
              </h1>
              <div className="mb-7">
                <div className="w-6 h-[1.5px] mb-5" style={{ background: theme.accentColor }} />
                {item.story ? (
                  <p className="leading-[2] whitespace-pre-wrap text-[15px] font-story" style={{ color: theme.textSecondary }}>
                    {item.story}
                  </p>
                ) : (
                  <p className="leading-[2] text-[15px] font-story italic" style={{ color: theme.textMuted }}>
                    暂无故事
                  </p>
                )}
              </div>
              <MargielaRating rating={item.rating} size="lg" accentColor={theme.accentColor} dimColor={theme.textMuted} />
            </div>
          </div>
        </div>

        <div
          className="wash-label px-6 py-5"
          style={{
            background: theme.isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.25)',
            borderStyle: 'solid',
            borderWidth: '0 1px 1px 1px',
            borderColor: theme.borderEdge,
            color: theme.textSecondary,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-px" style={{ background: theme.textMuted }} />
            <span className="text-[7px] tracking-[0.3em] font-bold" style={{ color: theme.textMuted }}>CARE LABEL</span>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <p><span style={{ color: theme.textMuted }}>CAT. </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.category}</span></p>
            <p><span style={{ color: theme.textMuted }}>SEASON </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.season}</span></p>
            <p><span style={{ color: theme.textMuted }}>RATING </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.rating}/10</span></p>
            <p><span style={{ color: theme.textMuted }}>DATE </span><span style={{ color: theme.textSecondary }} className="font-medium">{dateStr}</span></p>
            {item.purchaseYear && (
              <p><span style={{ color: theme.textMuted }}>YEAR </span><span style={{ color: theme.accentColor }} className="font-bold">{item.purchaseYear}</span></p>
            )}
          </div>
          <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: `1px dashed ${theme.textMuted}`, opacity: 0.5 }}>
            {['◯', '△', '☐', '◇', '⬡'].map((sym, i) => (
              <span key={i} className="text-[15px]">{sym}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShareView() {
  const { userId } = useParams<{ userId: string }>();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'全部' | Category>('全部');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'wardrobe_items'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WardrobeItem)));
      setLoading(false);
    }, () => {
      setAccessDenied(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

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
          <p className="font-story text-graphite/60">此衣柜未开启分享</p>
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
              模子の衣柜
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
                onCardClick={(clickedItem) => setSelectedItem(clickedItem)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedItem && (
        <ReadOnlyItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
