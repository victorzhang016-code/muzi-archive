import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router';
import { doc, onSnapshot, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Edit2, Trash2, Loader2, Image as ImageIcon, GitBranch } from 'lucide-react';
import { db, auth } from '../firebase';
import { BestMatch, BestMatchItems, WardrobeItem } from '../types';
import { useWardrobe } from '../contexts/WardrobeContext';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { sfx } from '../lib/sounds';
import { TagBundle } from './TagBundle';
import type { BundleEntry } from './TagBundle';
import { compressToBase64 } from '../lib/cropImage';
import { getTagTheme } from '../lib/tagThemes';
import { cn } from '../lib/utils';

type SlotKey = keyof BestMatchItems;
const SLOT_LABELS: { key: SlotKey; label: string }[] = [
  { key: 'tops', label: '上装' },
  { key: 'bottoms', label: '下装' },
  { key: 'shoes', label: '鞋子' },
  { key: 'accessories', label: '配饰' },
];

export function BestMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items: wardrobe, loading: wardrobeLoading } = useWardrobe();
  const [match, setMatch] = useState<BestMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bundleVisible, setBundleVisible] = useState(true);
  const [slotDisplay, setSlotDisplay] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeWithAnimation = () => {
    sfx.filterClick();
    setBundleVisible(false);
    window.setTimeout(() => navigate(-1), 420);
  };

  useEffect(() => {
    if (!id || !auth.currentUser) return;
    const ref = doc(db, 'best_matches', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          // Defer normalization to context's helpers — but we read raw here.
          // Use bundleEntriesFromMatch downstream which handles slot shape.
          const data = snap.data() as any;
          const rawItems = data.items ?? {};
          const normalizeSlots = (raw: any) => {
            if (!Array.isArray(raw)) return [];
            return raw.map((entry: any) => {
              if (typeof entry === 'string') return { primary: entry };
              if (entry && typeof entry === 'object' && typeof entry.primary === 'string') {
                const variants = Array.isArray(entry.variants)
                  ? entry.variants.filter((v: unknown) => typeof v === 'string')
                  : undefined;
                return variants && variants.length > 0
                  ? { primary: entry.primary, variants }
                  : { primary: entry.primary };
              }
              return null;
            }).filter(Boolean);
          };
          setMatch({
            id: snap.id,
            userId: data.userId,
            items: {
              tops: normalizeSlots(rawItems.tops),
              bottoms: normalizeSlots(rawItems.bottoms),
              shoes: normalizeSlots(rawItems.shoes),
              accessories: normalizeSlots(rawItems.accessories),
            },
            allItemIds: data.allItemIds ?? [],
            name: data.name ?? undefined,
            story: data.story ?? data.note ?? undefined,
            sceneTags: data.sceneTags,
            photoBase64: data.photoBase64,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as BestMatch);
        } else {
          setMatch(null);
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `best_matches/${id}`);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    wardrobe.forEach((i) => m.set(i.id, i));
    return m;
  }, [wardrobe]);

  const entries = useMemo<BundleEntry[]>(() => {
    if (!match) return [];
    const out: BundleEntry[] = [];
    (['tops', 'bottoms', 'shoes', 'accessories'] as SlotKey[]).forEach((k) => {
      match.items[k].forEach((slot) => {
        const displayId = slotDisplay[slot.primary] ?? slot.primary;
        const item = itemMap.get(displayId);
        if (item) out.push({ item, variantCount: slot.variants?.length ?? 0 });
      });
    });
    return out;
  }, [match, itemMap, slotDisplay]);

  const handleDelete = async () => {
    if (!match) return;
    if (!confirm('删除这套搭配？此操作不可恢复。')) return;
    sfx.deleteItem();
    try {
      await deleteDoc(doc(db, 'best_matches', match.id));
      navigate('/best-match');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `best_matches/${match.id}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !match) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('图片不能超过 5MB');
      e.target.value = '';
      return;
    }
    setPhotoUploading(true);
    try {
      const base64 = await compressToBase64(file, 720, 0.78);
      await updateDoc(doc(db, 'best_matches', match.id), {
        photoBase64: base64,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `best_matches/${match.id}`);
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  if (loading || wardrobeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-32">
        <h2 className="text-2xl font-story font-bold text-ink mb-4">Match Not Found</h2>
        <button
          onClick={() => navigate('/best-match')}
          className="font-tag text-[10px] uppercase tracking-widest text-graphite hover:text-ink transition-colors font-bold"
        >
          Return to Gallery
        </button>
      </div>
    );
  }

  const created = match.createdAt?.toDate?.();
  const dateStr = created
    ? `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, '0')}.${String(created.getDate()).padStart(2, '0')}`
    : '—';

  const counts = {
    tops: match.items.tops.length,
    bottoms: match.items.bottoms.length,
    shoes: match.items.shoes.length,
    accessories: match.items.accessories.length,
  };

  const totalVariants = (['tops', 'bottoms', 'shoes', 'accessories'] as SlotKey[]).reduce(
    (sum, k) => sum + match.items[k].reduce((s, slot) => s + (slot.variants?.length ?? 0), 0),
    0
  );

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Top nav — full width */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => closeWithAnimation()}
          className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Best Match</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { sfx.modalOpen(); navigate(`/best-match/new?edit=${match.id}`); }}
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr] gap-8 lg:gap-10 items-start">
        {/* LEFT — sticky on desktop, scrollable when bundle is tall */}
        <aside className="lg:sticky lg:top-24">
          <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4 hide-scrollbar">
            {entries.length > 0 ? (
              <div className="flex lg:justify-start justify-center">
                <TagBundle
                  entries={entries}
                  size="detail"
                  variant="strung"
                  animateIn
                  collapsed={!bundleVisible}
                  onItemClick={(it) => { sfx.cardClick(); navigate(`/item/${it.id}`); }}
                />
              </div>
            ) : (
              <p className="font-story italic text-graphite/50 py-16 text-center">
                搭配里的衣物已被删除
              </p>
            )}
          </div>
        </aside>

        {/* RIGHT — everything else, stagger fade-in */}
        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } } }}
        >
          {/* Name */}
          {match.name && (
            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/55 mb-1">Title</p>
              <h1
                className="text-[2rem] sm:text-[2.6rem] leading-tight text-ink"
                style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.02em' }}
              >
                {match.name}
              </h1>
            </motion.div>
          )}

          {/* Scene tags */}
          {(match.sceneTags?.length ?? 0) > 0 && (
            <motion.div
              className="flex flex-wrap gap-2"
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
            >
              {match.sceneTags!.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 font-tag text-[11px] uppercase tracking-wider text-ink border border-ink/30 bg-ink/5"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          )}

          {/* Story */}
          {match.story && (
            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <div className="w-6 h-[1.5px] mb-3 bg-stamp/60" />
              <p className="font-story text-[15px] leading-[1.9] text-ink/85 whitespace-pre-wrap">
                {match.story}
              </p>
            </motion.div>
          )}

          {/* Photo */}
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
          >
            {match.photoBase64 ? (
              <div className="border border-graphite/20 p-2 bg-white/40 max-w-[240px]">
                <img
                  src={match.photoBase64}
                  alt="outfit"
                  className="w-full"
                  style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
                />
                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50">
                    Polaroid
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    className="font-tag text-[9px] uppercase tracking-wider text-graphite hover:text-ink disabled:opacity-40 transition-colors"
                  >
                    {photoUploading ? '上传中…' : '更换'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="flex flex-col items-center gap-2 px-6 py-5 border border-dashed border-graphite/30 hover:border-graphite/60 transition-colors text-graphite/55 hover:text-ink disabled:opacity-40"
              >
                {photoUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                <span className="font-tag text-[10px] uppercase tracking-wider">
                  {photoUploading ? '上传中…' : '上传整套 Look 照片'}
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </motion.div>

          {/* Constituent list */}
          <motion.div
            className="pt-3"
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-px bg-graphite/60" />
              <span className="font-tag text-[8px] tracking-[0.3em] font-bold text-graphite/60">
                CONSTITUENTS · {entries.length} 主件{totalVariants > 0 ? ` · ${totalVariants} 变体` : ''}
              </span>
            </div>

            <div className="space-y-3">
              {SLOT_LABELS.map(({ key, label }) => {
                const slots = match.items[key];
                if (slots.length === 0) return null;
                return (
                  <div key={key} className="border-l-2 border-graphite/15 pl-3">
                    <p className="font-tag text-[10px] uppercase tracking-[0.25em] text-graphite/55 mb-1.5">
                      {label} · {slots.length}
                    </p>
                    <div className="space-y-1.5">
                      {slots.map((slot) => {
                        const primary = itemMap.get(slot.primary);
                        if (!primary) return (
                          <p key={slot.primary} className="font-story italic text-xs text-graphite/40">
                            已删除的衣物
                          </p>
                        );
                        const hasVariants = (slot.variants?.length ?? 0) > 0;
                        const activeId = slotDisplay[slot.primary] ?? slot.primary;
                        const allIds = [slot.primary, ...(slot.variants ?? [])];

                        const switchTo = (targetId: string) => {
                          sfx.filterClick();
                          setSlotDisplay(prev => ({ ...prev, [slot.primary]: targetId }));
                        };

                        return (
                          <div key={slot.primary} className="space-y-0.5">
                            {allIds.map((itemId, itemIdx) => {
                              const item = itemMap.get(itemId);
                              if (!item) return (
                                <p key={itemId} className="font-story italic text-xs text-graphite/40 px-2">
                                  {itemIdx === 0 ? '已删除的衣物' : '已删除的变体'}
                                </p>
                              );
                              const theme = getTagTheme(item.id);
                              const isActive = activeId === itemId;
                              const isPrimary = itemIdx === 0;

                              return (
                                <div key={itemId} className={cn(
                                  "flex items-center gap-2 px-2 py-1 -mx-2 transition-colors",
                                  isActive ? "bg-ink/5" : "hover:bg-tag/40"
                                )}>
                                  {/* Switch indicator */}
                                  {hasVariants && (
                                    <button
                                      onClick={() => switchTo(itemId)}
                                      title={isActive ? '当前展示中' : '切换到此版本'}
                                      className="shrink-0 w-4 h-4 flex items-center justify-center transition-colors"
                                    >
                                      <div className={cn(
                                        "rounded-full transition-all",
                                        isActive
                                          ? "w-2.5 h-2.5 border-2"
                                          : "w-2 h-2 border opacity-35 hover:opacity-70"
                                      )}
                                        style={{ borderColor: isActive ? theme.accentColor : undefined }}
                                      />
                                    </button>
                                  )}
                                  {!hasVariants && (
                                    <div className="w-1 h-7 shrink-0" style={{ backgroundColor: theme.accentColor }} />
                                  )}

                                  {/* Item name row */}
                                  <button
                                    onClick={() => { sfx.cardClick(); navigate(`/item/${item.id}`); }}
                                    onMouseEnter={() => sfx.cardHover()}
                                    className="group flex-1 flex items-center gap-2 min-w-0 text-left"
                                  >
                                    {!isPrimary && <GitBranch className="w-3 h-3 text-graphite/40 shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "font-story text-sm truncate group-hover:text-stamp transition-colors",
                                        isPrimary ? "font-semibold text-ink" : "text-ink/70",
                                        isActive && "text-ink"
                                      )}>
                                        {item.name || '未命名'}
                                      </p>
                                      {item.brand && (
                                        <p className="font-tag text-[9px] uppercase tracking-wider text-graphite/50 truncate">
                                          {item.brand}
                                        </p>
                                      )}
                                    </div>
                                    <span className="font-tag text-[10px] text-graphite/35 group-hover:text-graphite transition-colors shrink-0">→</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Composition (wash-label style) */}
          <motion.div
            className="px-5 py-4"
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
            style={{
              background: 'rgba(0,0,0,0.04)',
              borderStyle: 'solid',
              borderWidth: '1px',
              borderColor: 'rgba(0,0,0,0.10)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-px bg-graphite/60" />
              <span className="font-tag text-[7px] tracking-[0.3em] font-bold text-graphite/60">
                COMPOSITION
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 font-tag text-[11px] tracking-[0.06em]">
              <p><span className="text-graphite/55">TOPS </span><span className="text-ink font-medium">{counts.tops}</span></p>
              <p><span className="text-graphite/55">BOTTOMS </span><span className="text-ink font-medium">{counts.bottoms}</span></p>
              <p><span className="text-graphite/55">SHOES </span><span className="text-ink font-medium">{counts.shoes}</span></p>
              <p><span className="text-graphite/55">ACCESSORIES </span><span className="text-ink font-medium">{counts.accessories}</span></p>
              {totalVariants > 0 && (
                <p className="col-span-2"><span className="text-graphite/55">VARIANTS </span><span className="text-ink font-medium">{totalVariants}</span></p>
              )}
              <p className="col-span-2"><span className="text-graphite/55">DATE </span><span className="text-ink font-medium">{dateStr}</span></p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
