import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WardrobeItem } from '../types';
import { ArrowLeft, Edit2, Trash2, Loader2 } from 'lucide-react';
import { AddEditItemModal } from './AddEditItemModal';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { sfx } from '../lib/sounds';
import { MargielaRating } from './MargielaRating';
import { cn } from '../lib/utils';
import { getTagTheme, getTagRotation } from '../lib/tagThemes';
import { useBestMatches, matchesContainingItem, bundleEntriesFromMatch } from '../contexts/BestMatchContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { TagBundle } from './TagBundle';

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<WardrobeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { matches } = useBestMatches();
  const { items: wardrobe } = useWardrobe();

  const relatedMatches = useMemo(
    () => (id ? matchesContainingItem(matches, id) : []),
    [matches, id]
  );

  const wardrobeMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    wardrobe.forEach((i) => m.set(i.id, i));
    return m;
  }, [wardrobe]);

  useEffect(() => {
    if (!id || !auth.currentUser) return;
    const docRef = doc(db, 'wardrobe_items', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setItem({ id: docSnap.id, ...docSnap.data() } as WardrobeItem);
      } else {
        setItem(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `wardrobe_items/${id}`);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id, auth.currentUser]);

  const handleDelete = async () => {
    if (!item) return;
    sfx.deleteItem();
    try {
      await deleteDoc(doc(db, 'wardrobe_items', item.id));
      navigate('/');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `wardrobe_items/${item.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-32">
        <h2 className="text-2xl font-story font-bold text-ink mb-4">Item Not Found</h2>
        <button onClick={() => navigate('/')} className="font-tag text-[10px] uppercase tracking-widest text-graphite hover:text-ink transition-colors font-bold">
          Return to Archive
        </button>
      </div>
    );
  }

  const theme = getTagTheme(item.id);
  const rotation = getTagRotation(item.id);

  const createdDate = item.createdAt?.toDate?.();
  const dateStr = createdDate
    ? `${createdDate.getFullYear()}.${String(createdDate.getMonth() + 1).padStart(2, '0')}.${String(createdDate.getDate()).padStart(2, '0')}`
    : '—';

  const polaroidInner = theme.isLight
    ? { background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.10)' }
    : { background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 2px 6px rgba(0,0,0,0.35)' };

  return (
    <div
      className="min-h-[70vh] cursor-pointer"
      onClick={() => { sfx.filterClick(); navigate(-1); }}
      title="点击空白处返回"
    >
    <div
      className="animate-fade-up max-w-xl mx-auto cursor-default"
      onClick={(e) => e.stopPropagation()}
    >

      {/* Back nav */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => { sfx.filterClick(); navigate(-1); }}
          className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors font-medium"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>返回</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { sfx.modalOpen(); setIsEditModalOpen(true); }}
            className="p-2 text-graphite hover:text-ink transition-colors border border-graphite/15 bg-tag/60 hover:bg-tag shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-graphite hover:text-stamp transition-colors border border-graphite/15 bg-tag/60 hover:bg-tag shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── The large physical tag ── */}
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
        {/* Texture layer */}
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
        {/* Colour tint */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: theme.overlayColor, zIndex: 1 }} />

        <div className="relative z-10">
          {/* CERTIFIED stamp */}
          {item.rating >= 9 && (
            <div className="absolute -top-4 -right-4 z-20 stamp-certified rotate-[15deg]"
              style={{ borderColor: theme.accentColor, mixBlendMode: 'normal', opacity: 0.85 }}>
              <span className="font-tag text-[7px] uppercase tracking-[0.08em] font-bold text-center leading-[1.3]"
                style={{ color: theme.accentColor }}>
                CERT<br/>IFIED
              </span>
            </div>
          )}

          {/* Top bar: ID + hole + season / year */}
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

          {/* Polaroid image */}
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
                  onClick={() => setIsEditModalOpen(true)}
                  className="aspect-[3/4] flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70"
                  style={{ background: theme.isLight ? '#EDE9E0' : 'rgba(255,255,255,0.05)' }}
                >
                  <span className="font-tag text-[11px] tracking-[0.3em] uppercase" style={{ color: theme.textMuted }}>
                    + Add Image
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

          {/* Content */}
          <div className="px-6 pb-6">
            <div className="h-px mb-5" style={{ background: theme.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }} />

            <h1
              onClick={() => { if (!item.name || item.name === '未命名') setIsEditModalOpen(true); }}
              className={cn(
                "font-story font-bold text-3xl sm:text-4xl leading-tight tracking-tight mb-1",
                (!item.name || item.name === '未命名') ? "italic cursor-pointer" : ""
              )}
              style={{ color: (!item.name || item.name === '未命名') ? theme.textMuted : theme.textPrimary }}
            >
              {item.name && item.name !== '未命名' ? item.name : '+ 添加名称...'}
            </h1>
            {item.brand && (
              <p className="font-tag text-[10px] uppercase tracking-[0.2em] mb-5" style={{ color: theme.textMuted }}>
                {item.brand}
              </p>
            )}

            <div className="mb-7">
              <div className="w-6 h-[1.5px] mb-5" style={{ background: theme.accentColor }} />
              {item.story ? (
                <p className="leading-[2] whitespace-pre-wrap text-[15px] font-story" style={{ color: theme.textSecondary }}>
                  {item.story}
                </p>
              ) : (
                <p
                  onClick={() => setIsEditModalOpen(true)}
                  className="leading-[2] text-[15px] font-story italic cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: theme.textMuted }}
                >
                  + 添加衣物故事...
                </p>
              )}
            </div>

            <MargielaRating rating={item.rating} size="lg" accentColor={theme.accentColor} dimColor={theme.textMuted} />
          </div>
        </div>
      </div>

      {/* ── Wash Label ── */}
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
          {item.topType && (
            <p><span style={{ color: theme.textMuted }}>TYPE </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.topType}</span></p>
          )}
          {item.length && (
            <p><span style={{ color: theme.textMuted }}>TYPE </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.length}</span></p>
          )}
          <p><span style={{ color: theme.textMuted }}>RATING </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.rating}/10</span></p>
          <p><span style={{ color: theme.textMuted }}>DATE </span><span style={{ color: theme.textSecondary }} className="font-medium">{dateStr}</span></p>
          {item.brand && (
            <p><span style={{ color: theme.textMuted }}>BRAND </span><span style={{ color: theme.textSecondary }} className="font-medium uppercase">{item.brand}</span></p>
          )}
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

      {/* ── 出现在 N 套搭配里 ── */}
      {relatedMatches.length > 0 && (
        <div className="mt-12 pt-8 border-t border-dashed border-graphite/25">
          <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/55 mb-1">
            Appears In
          </p>
          <h3 className="font-story text-lg text-ink mb-5">
            出现在 <strong>{relatedMatches.length}</strong> 套搭配里
          </h3>
          <div className="flex gap-5 overflow-x-auto hide-scrollbar pb-3 -mx-2 px-2">
            {relatedMatches.map((m) => {
              const entries = bundleEntriesFromMatch(m, wardrobeMap);
              return (
                <div
                  key={m.id}
                  onMouseEnter={() => sfx.cardHover()}
                  onClick={() => { sfx.cardClick(); navigate(`/best-match/${m.id}`); }}
                  className="shrink-0 rounded-xl bg-white/30 border border-dashed border-graphite/20 hover:border-graphite/45 hover:-translate-y-1 transition-all p-3 cursor-pointer"
                >
                  {entries.length > 0 && (
                    <TagBundle
                      entries={entries}
                      size="mini"
                      onItemClick={(it) => { sfx.cardClick(); navigate(`/item/${it.id}`); }}
                    />
                  )}
                  {m.name && (
                    <p className="font-story font-bold text-sm text-ink mt-2 text-center max-w-[220px] line-clamp-1">
                      {m.name}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddEditItemModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        itemToEdit={item}
      />
    </div>
    </div>
  );
}
