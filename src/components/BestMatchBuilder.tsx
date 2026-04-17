import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ArrowLeft, Plus, X, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { sfx } from '../lib/sounds';
import { cn } from '../lib/utils';
import { compressToBase64 } from '../lib/cropImage';
import {
  BestMatch,
  BestMatchItems,
  BEST_MATCH_CAPS,
  Category,
  SCENE_TAGS,
  SceneTag,
  WardrobeItem,
} from '../types';
import { getTagTheme } from '../lib/tagThemes';
import { TagBundle } from './TagBundle';

type SlotKey = keyof BestMatchItems;

const SLOT_CONFIG: { key: SlotKey; label: string; category: Category; placeholder: string }[] = [
  { key: 'tops', label: '上装', category: '上装', placeholder: '+ 加上装' },
  { key: 'bottoms', label: '下装', category: '下装', placeholder: '+ 加下装' },
  { key: 'shoes', label: '鞋子', category: '鞋子', placeholder: '+ 加鞋' },
  { key: 'accessories', label: '配饰', category: '配饰', placeholder: '+ 加配饰' },
];

const EMPTY_ITEMS: BestMatchItems = { tops: [], bottoms: [], shoes: [], accessories: [] };

export function BestMatchBuilder() {
  const navigate = useNavigate();
  const { items: allItems, loading: wardrobeLoading } = useWardrobe();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [selected, setSelected] = useState<BestMatchItems>(EMPTY_ITEMS);
  const [sceneTags, setSceneTags] = useState<SceneTag[]>([]);
  const [note, setNote] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('上装');
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editId || !auth.currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'best_matches', editId));
        if (snap.exists()) {
          const data = snap.data() as BestMatch;
          setSelected(data.items);
          setSceneTags(data.sceneTags ?? []);
          setNote(data.note ?? '');
          setPhotoBase64(data.photoBase64 ?? null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `best_matches/${editId}`);
      } finally {
        setLoadingEdit(false);
      }
    })();
  }, [editId]);

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    allItems.forEach((i) => m.set(i.id, i));
    return m;
  }, [allItems]);

  const selectedOrdered = useMemo(() => {
    const ordered: WardrobeItem[] = [];
    (['tops', 'bottoms', 'shoes', 'accessories'] as SlotKey[]).forEach((k) => {
      selected[k].forEach((id) => {
        const it = itemMap.get(id);
        if (it) ordered.push(it);
      });
    });
    return ordered;
  }, [selected, itemMap]);

  const totalCount = selectedOrdered.length;
  const hasRequired = selected.tops.length >= 1 && selected.bottoms.length >= 1;
  const canSave = hasRequired && totalCount >= 2;

  const categoryItems = useMemo(
    () => allItems.filter((i) => i.category === activeCategory),
    [allItems, activeCategory]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 1800);
  };

  const toggleItem = (item: WardrobeItem) => {
    const slotKey = categoryToSlot(item.category);
    const current = selected[slotKey];
    if (current.includes(item.id)) {
      sfx.filterClick();
      setSelected({ ...selected, [slotKey]: current.filter((id) => id !== item.id) });
      return;
    }
    const cap = BEST_MATCH_CAPS[slotKey];
    if (current.length >= cap) {
      showToast(`${categoryLabel(slotKey)}最多 ${cap} 件`);
      return;
    }
    sfx.cardClick();
    setSelected({ ...selected, [slotKey]: [...current, item.id] });
  };

  const handleSave = async () => {
    if (!auth.currentUser || !canSave || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        userId: auth.currentUser.uid,
        items: selected,
        updatedAt: serverTimestamp(),
      };
      if (sceneTags.length > 0) payload.sceneTags = sceneTags;
      if (note.trim()) payload.note = note.trim();
      if (photoBase64) payload.photoBase64 = photoBase64;

      if (editId) {
        await updateDoc(doc(db, 'best_matches', editId), payload);
        sfx.modalClose();
        navigate(`/best-match/${editId}`);
      } else {
        payload.createdAt = serverTimestamp();
        const ref = await addDoc(collection(db, 'best_matches'), payload);
        sfx.modalClose();
        navigate(`/best-match/${ref.id}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'best_matches');
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片不能超过 5MB');
      return;
    }
    try {
      const base64 = await compressToBase64(file, 720, 0.78);
      setPhotoBase64(base64);
    } catch {
      showToast('图片处理失败');
    } finally {
      e.target.value = '';
    }
  };

  const softHint = hasRequired && (selected.shoes.length === 0 || selected.accessories.length === 0);

  if (wardrobeLoading || loadingEdit) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-graphite/40" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dashed border-graphite/25 pb-5">
        <button
          onClick={() => { sfx.filterClick(); navigate(-1); }}
          className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>返回</span>
        </button>
        <div className="text-center">
          <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/55">
            {editId ? 'Edit Best Match' : 'New Best Match'}
          </p>
          <h2 className="font-story font-bold text-xl text-ink tracking-tight">心中的最佳搭配</h2>
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className={cn(
            'px-5 py-2 font-tag text-[11px] uppercase tracking-wider font-bold border transition-all',
            canSave && !saving
              ? 'bg-ink text-white border-ink hover:bg-ink/85'
              : 'bg-tag/60 text-graphite/40 border-graphite/20 cursor-not-allowed'
          )}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
        </button>
      </div>

      {/* Preview — live TagBundle */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 items-start">
        <aside className="lg:sticky lg:top-24">
          <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/55 mb-3 text-center">
            Preview · {totalCount} 件
          </p>
          <div className="rounded-xl bg-white/30 border border-dashed border-graphite/20 p-4 flex justify-center min-h-[200px]">
            {selectedOrdered.length > 0 ? (
              <TagBundle items={selectedOrdered} size="mini" />
            ) : (
              <p className="font-tag text-xs text-graphite/45 self-center">
                选择衣物开始搭配
              </p>
            )}
          </div>
          {softHint && (
            <p className="mt-3 text-center font-story italic text-[11px] text-graphite/60">
              {selected.shoes.length === 0 && selected.accessories.length === 0
                ? '建议加上鞋和配饰，搭配档案会更完整'
                : selected.shoes.length === 0
                  ? '加一双鞋？档案会更完整'
                  : '加点配饰？档案会更完整'}
            </p>
          )}
        </aside>

        {/* Slot summary + picker */}
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-2">
            {SLOT_CONFIG.map((slot) => {
              const count = selected[slot.key].length;
              const cap = BEST_MATCH_CAPS[slot.key];
              const required = slot.key === 'tops' || slot.key === 'bottoms';
              const isActive = activeCategory === slot.category;
              return (
                <button
                  key={slot.key}
                  onClick={() => { sfx.filterClick(); setActiveCategory(slot.category); }}
                  className={cn(
                    'flex flex-col items-start gap-1 px-3 py-3 border transition-all text-left',
                    isActive
                      ? 'bg-ink text-white border-ink'
                      : count > 0
                        ? 'bg-tag border-ink/30 text-ink hover:border-ink/60'
                        : 'bg-tag/60 border-graphite/25 text-graphite hover:text-ink hover:border-graphite/50'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-tag text-[10px] uppercase tracking-[0.15em] font-semibold">
                      {slot.label}
                    </span>
                    {required && count === 0 && (
                      <span className={cn('text-[9px]', isActive ? 'text-white/60' : 'text-stamp/80')}>*</span>
                    )}
                  </div>
                  <span className={cn('font-tag text-[11px]', isActive ? 'text-white/70' : 'text-graphite/55')}>
                    {count} / {cap}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected items chips (current category) */}
          {selected[categoryToSlot(activeCategory)].length > 0 && (
            <div>
              <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-2">
                已选 · {activeCategory}
              </p>
              <div className="flex flex-wrap gap-2">
                {selected[categoryToSlot(activeCategory)].map((id) => {
                  const item = itemMap.get(id);
                  if (!item) return null;
                  const theme = getTagTheme(item.id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleItem(item)}
                      className="flex items-center gap-2 pl-2 pr-1 py-1 border bg-tag"
                      style={{ borderColor: theme.accentColor }}
                    >
                      <span className="font-story text-xs text-ink truncate max-w-[140px]">
                        {item.name || '未命名'}
                      </span>
                      <X className="w-3 h-3 text-graphite" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wardrobe grid for active category */}
          <div>
            <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-3">
              选 · {activeCategory}（{categoryItems.length}）
            </p>
            {categoryItems.length === 0 ? (
              <p className="font-story italic text-sm text-graphite/50 py-8 text-center border border-dashed border-graphite/20">
                该品类衣柜还没有衣物
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {categoryItems.map((item) => {
                  const slotKey = categoryToSlot(item.category);
                  const isSelected = selected[slotKey].includes(item.id);
                  const theme = getTagTheme(item.id);
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => sfx.cardHover()}
                      onClick={() => toggleItem(item)}
                      className={cn(
                        'relative aspect-[3/4] overflow-hidden border transition-all',
                        isSelected
                          ? 'ring-2 ring-ink ring-offset-2 ring-offset-kraft'
                          : 'hover:-translate-y-0.5'
                      )}
                      style={{
                        backgroundColor: theme.bgColor,
                        borderColor: theme.borderEdge,
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span
                            className="font-tag text-[9px] tracking-[0.2em] uppercase"
                            style={{ color: theme.textMuted }}
                          >
                            {item.name?.slice(0, 6) ?? 'No name'}
                          </span>
                        </div>
                      )}
                      <div
                        className="absolute inset-x-0 bottom-0 px-1.5 py-1 backdrop-blur-sm bg-black/40"
                      >
                        <p className="font-story text-[10px] text-white truncate leading-tight">
                          {item.name || '未命名'}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-ink flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta row — scene tags + note + optional photo */}
      <div className="space-y-5 border-t border-dashed border-graphite/25 pt-6">
        <div>
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-2">
            Scene 场景（可选）
          </p>
          <div className="flex flex-wrap gap-2">
            {SCENE_TAGS.map((tag) => {
              const active = sceneTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => {
                    sfx.filterClick();
                    setSceneTags(active ? sceneTags.filter((t) => t !== tag) : [...sceneTags, tag]);
                  }}
                  className={cn(
                    'px-3.5 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border transition-all',
                    active
                      ? 'bg-ink/10 text-ink border-ink/30'
                      : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-2">
            Note 备注（可选 · 最多 64 字）
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 64))}
            placeholder="一句话记录这套搭配的感觉…"
            rows={2}
            className="w-full px-3 py-2 bg-tag/40 border border-graphite/20 font-story text-sm text-ink placeholder:text-graphite/40 outline-none focus:border-ink/50 resize-none"
          />
          <p className="text-right font-tag text-[10px] text-graphite/40 mt-1">{note.length} / 64</p>
        </div>

        <div>
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-2">
            Photo 照片（可选）
          </p>
          <div className="flex items-start gap-3">
            {photoBase64 ? (
              <div className="relative w-24 h-24">
                <img src={photoBase64} alt="outfit photo" className="w-full h-full object-cover border border-graphite/20" />
                <button
                  onClick={() => setPhotoBase64(null)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-ink flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 border border-dashed border-graphite/30 flex flex-col items-center justify-center gap-1 text-graphite/50 hover:text-ink hover:border-graphite/60 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="font-tag text-[9px] uppercase tracking-wider">Upload</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-ink text-white font-tag text-xs uppercase tracking-wider px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function categoryToSlot(category: Category): SlotKey {
  switch (category) {
    case '上装': return 'tops';
    case '下装': return 'bottoms';
    case '鞋子': return 'shoes';
    case '配饰': return 'accessories';
  }
}

function categoryLabel(slot: SlotKey): string {
  switch (slot) {
    case 'tops': return '上装';
    case 'bottoms': return '下装';
    case 'shoes': return '鞋子';
    case 'accessories': return '配饰';
  }
}
