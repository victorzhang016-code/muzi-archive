import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { WardrobeItem, Category } from '../types';
import { WardrobeItemCard } from './WardrobeItemCard';
import { SharedItemCard } from './SharedItemCard';
import { cn } from '../lib/utils';
import { Loader2, X, Lock } from 'lucide-react';

const CATEGORIES: ('全部' | Category)[] = ['全部', '上装', '下装', '鞋子', '配饰'];

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
