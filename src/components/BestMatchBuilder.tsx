import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ArrowLeft, X, Loader2, Image as ImageIcon, Check, GitBranch, ArrowUpDown } from 'lucide-react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { sfx } from '../lib/sounds';
import { cn } from '../lib/utils';
import { compressToBase64 } from '../lib/cropImage';
import {
  BestMatchItems,
  BestMatchSlot,
  BEST_MATCH_CAPS,
  Category,
  Season,
  SCENE_TAGS,
  SceneTag,
  WardrobeItem,
  TopType,
  TOP_TYPES,
  AccessoryType,
  ACCESSORY_TYPES,
} from '../types';
import { getTagTheme } from '../lib/tagThemes';
import { TagBundle } from './TagBundle';
import type { BundleEntry } from './TagBundle';
import { emptyBestMatchItems, flattenItems } from '../contexts/BestMatchContext';

type SlotKey = keyof BestMatchItems;

const SLOT_CONFIG: { key: SlotKey; label: string; category: Category }[] = [
  { key: 'tops', label: '上装', category: '上装' },
  { key: 'bottoms', label: '下装', category: '下装' },
  { key: 'shoes', label: '鞋子', category: '鞋子' },
  { key: 'accessories', label: '配饰', category: '配饰' },
];

function normalizeBrand(b: string): string {
  return b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function extractBrands(raw: string): string[] {
  return raw.split(/\s+[xX×]\s+/).map(normalizeBrand).filter(Boolean);
}

export function BestMatchBuilder() {
  const navigate = useNavigate();
  const { items: allItems, loading: wardrobeLoading } = useWardrobe();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [selected, setSelected] = useState<BestMatchItems>(emptyBestMatchItems());
  const [name, setName] = useState('');
  const [story, setStory] = useState('');
  const [sceneTags, setSceneTags] = useState<SceneTag[]>([]);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('上装');
  const [variantSlot, setVariantSlot] = useState<{ category: SlotKey; primaryId: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Picker filters (scoped to active category)
  const [filterSeason, setFilterSeason] = useState<'全部' | Season>('全部');
  const [filterLength, setFilterLength] = useState<'全部' | '长裤' | '短裤' | '裙子'>('全部');
  const [filterTopType, setFilterTopType] = useState<'全部' | TopType>('全部');
  const [filterAccessoryType, setFilterAccessoryType] = useState<'全部' | AccessoryType>('全部');
  const [filterYear, setFilterYear] = useState<number | '全部'>('全部');
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'default' | 'ratingDesc' | 'ratingAsc'>('default');
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);

  useEffect(() => {
    if (!editId || !auth.currentUser) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'best_matches', editId));
        if (snap.exists()) {
          const data = snap.data() as any;
          // Normalize legacy v1 string[] data into v2 slot[] shape for editing
          const normalizeSlots = (raw: any): BestMatchSlot[] => {
            if (!Array.isArray(raw)) return [];
            const out: BestMatchSlot[] = [];
            for (const entry of raw) {
              if (typeof entry === 'string') {
                out.push({ primary: entry });
              } else if (entry && typeof entry === 'object' && typeof entry.primary === 'string') {
                const variants = Array.isArray(entry.variants)
                  ? (entry.variants as unknown[]).filter((v): v is string => typeof v === 'string')
                  : undefined;
                out.push(variants && variants.length > 0
                  ? { primary: entry.primary, variants }
                  : { primary: entry.primary });
              }
            }
            return out;
          };
          const rawItems = data.items ?? {};
          setSelected({
            tops: normalizeSlots(rawItems.tops),
            bottoms: normalizeSlots(rawItems.bottoms),
            shoes: normalizeSlots(rawItems.shoes),
            accessories: normalizeSlots(rawItems.accessories),
          });
          setName(data.name ?? '');
          setStory(data.story ?? data.note ?? '');
          setSceneTags(data.sceneTags ?? []);
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

  const previewEntries = useMemo<BundleEntry[]>(() => {
    const out: BundleEntry[] = [];
    (['tops', 'bottoms', 'shoes', 'accessories'] as SlotKey[]).forEach((k) => {
      selected[k].forEach((slot) => {
        const item = itemMap.get(slot.primary);
        if (item) out.push({ item, variantCount: slot.variants?.length ?? 0 });
      });
    });
    return out;
  }, [selected, itemMap]);

  const primaryCount = previewEntries.length;
  const variantCount = previewEntries.reduce((sum, e) => sum + (e.variantCount ?? 0), 0);
  const hasRequired = selected.tops.length >= 1 && selected.bottoms.length >= 1;
  const canSave = hasRequired;

  const categoryItems = useMemo(
    () => allItems.filter((i) => i.category === activeCategory),
    [allItems, activeCategory]
  );

  const availableYears = useMemo(() => {
    return Array.from(
      new Set(categoryItems.map((i) => i.purchaseYear).filter((y): y is number => !!y))
    ).sort((a, b) => b - a);
  }, [categoryItems]);

  const brandIndex = useMemo(() => {
    const map = new Map<string, { display: string; count: number }>();
    for (const item of categoryItems) {
      if (!item.brand) continue;
      const tokens = extractBrands(item.brand);
      for (const token of tokens) {
        const existing = map.get(token);
        if (existing) {
          existing.count++;
        } else {
          const rawPart = item.brand.split(/\s+[xX×]\s+/).find((p) => normalizeBrand(p) === token) ?? item.brand;
          map.set(token, { display: rawPart.trim(), count: 1 });
        }
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count || a.display.localeCompare(b.display))
      .map(([key, val]) => ({ key, ...val }));
  }, [categoryItems]);

  const filteredCategoryItems = useMemo(() => {
    let arr = categoryItems;
    if (activeCategory === '上装' && filterSeason !== '全部') {
      arr = arr.filter((i) => i.season === filterSeason);
    }
    if (activeCategory === '上装' && filterTopType !== '全部') {
      arr = arr.filter((i) => i.topType === filterTopType);
    }
    if (activeCategory === '下装' && filterLength !== '全部') {
      arr = arr.filter((i) => i.length === filterLength);
    }
    if (activeCategory === '配饰' && filterAccessoryType !== '全部') {
      arr = arr.filter((i) => i.accessoryType === filterAccessoryType);
    }
    if (filterYear !== '全部') {
      arr = arr.filter((i) => i.purchaseYear === filterYear);
    }
    if (filterBrand !== null) {
      arr = arr.filter((i) => i.brand && extractBrands(i.brand).includes(filterBrand));
    }
    const sorted = [...arr];
    if (sortOrder === 'ratingDesc') sorted.sort((a, b) => b.rating - a.rating);
    else if (sortOrder === 'ratingAsc') sorted.sort((a, b) => a.rating - b.rating);
    return sorted;
  }, [categoryItems, filterSeason, filterTopType, filterLength, filterAccessoryType, filterYear, filterBrand, sortOrder, activeCategory]);

  // Reset filters & exit variant mode when switching category
  useEffect(() => {
    setFilterSeason('全部');
    setFilterTopType('全部');
    setFilterLength('全部');
    setFilterAccessoryType('全部');
    setFilterYear('全部');
    setFilterBrand(null);
    setSortOrder('default');
    setBrandFilterOpen(false);
  }, [activeCategory]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), 1800);
  };

  const toggleItem = (item: WardrobeItem) => {
    const slotKey = categoryToSlot(item.category);
    const slots = selected[slotKey];

    // 加变体模式
    if (variantSlot && variantSlot.category === slotKey) {
      const isPrimary = slots.some((s) => s.primary === item.id);
      if (isPrimary) {
        showToast('这件是主件了，不能再做自己的变体');
        setVariantSlot(null);
        return;
      }
      const targetIdx = slots.findIndex((s) => s.primary === variantSlot.primaryId);
      if (targetIdx === -1) {
        setVariantSlot(null);
        return;
      }
      const target = slots[targetIdx];
      if (target.variants?.includes(item.id)) {
        showToast('已经是这件的变体了');
        return;
      }
      const newSlots = [...slots];
      newSlots[targetIdx] = { ...target, variants: [...(target.variants ?? []), item.id] };
      setSelected({ ...selected, [slotKey]: newSlots });
      setVariantSlot(null);
      sfx.cardClick();
      return;
    }

    // Toggle primary or remove existing variant
    const primaryIdx = slots.findIndex((s) => s.primary === item.id);
    if (primaryIdx >= 0) {
      sfx.filterClick();
      setSelected({ ...selected, [slotKey]: slots.filter((_, i) => i !== primaryIdx) });
      return;
    }
    const asVariantIdx = slots.findIndex((s) => s.variants?.includes(item.id));
    if (asVariantIdx >= 0) {
      sfx.filterClick();
      const newSlots = [...slots];
      const target = newSlots[asVariantIdx];
      newSlots[asVariantIdx] = { ...target, variants: target.variants!.filter((v) => v !== item.id) };
      setSelected({ ...selected, [slotKey]: newSlots });
      return;
    }
    const cap = BEST_MATCH_CAPS[slotKey];
    if (slots.length >= cap) {
      showToast(`${categoryLabel(slotKey)}主件最多 ${cap} 件`);
      return;
    }
    sfx.cardClick();
    setSelected({ ...selected, [slotKey]: [...slots, { primary: item.id }] });
  };

  const removeVariant = (slotKey: SlotKey, primaryId: string, variantId: string) => {
    const slots = selected[slotKey];
    const idx = slots.findIndex((s) => s.primary === primaryId);
    if (idx === -1) return;
    sfx.filterClick();
    const newSlots = [...slots];
    const target = newSlots[idx];
    const newVariants = (target.variants ?? []).filter((v) => v !== variantId);
    newSlots[idx] = newVariants.length > 0 ? { ...target, variants: newVariants } : { primary: target.primary };
    setSelected({ ...selected, [slotKey]: newSlots });
  };

  const removeSlot = (slotKey: SlotKey, primaryId: string) => {
    sfx.filterClick();
    setSelected({
      ...selected,
      [slotKey]: selected[slotKey].filter((s) => s.primary !== primaryId),
    });
    if (variantSlot?.primaryId === primaryId) setVariantSlot(null);
  };

  const startAddVariant = (slotKey: SlotKey, primaryId: string) => {
    sfx.cardClick();
    if (variantSlot?.primaryId === primaryId) {
      setVariantSlot(null);
      return;
    }
    setVariantSlot({ category: slotKey, primaryId });
    // jump picker to that category so user can pick variant
    const cat = SLOT_CONFIG.find((s) => s.key === slotKey)?.category;
    if (cat) setActiveCategory(cat);
  };

  const handleSave = async () => {
    if (!auth.currentUser || !canSave || saving) return;
    setSaving(true);
    try {
      const allItemIds = flattenItems(selected);
      const payload: Record<string, any> = {
        userId: auth.currentUser.uid,
        items: selected,
        allItemIds,
        updatedAt: serverTimestamp(),
      };
      if (name.trim()) payload.name = name.trim();
      if (story.trim()) payload.story = story.trim();
      if (sceneTags.length > 0) payload.sceneTags = sceneTags;
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
  const activeSlotKey = categoryToSlot(activeCategory);
  const currentSlots = selected[activeSlotKey];

  if (wardrobeLoading || loadingEdit) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-graphite/40" />
      </div>
    );
  }

  const seasonOptions: ('全部' | Season)[] = ['全部', '春秋', '春季', '秋季', '夏季', '冬季', '四季'];
  const lengthOptions: ('全部' | '长裤' | '短裤' | '裙子')[] = ['全部', '长裤', '短裤', '裙子'];

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-dashed border-graphite/25 pb-5">
        <button
          onClick={() => { sfx.filterClick(); navigate(editId ? `/best-match/${editId}` : '/best-match'); }}
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

      {/* Name + main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
        {/* Aside: Preview + Photo */}
        <aside className="lg:sticky lg:top-24 space-y-5">
          <div>
            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/55 mb-3 text-center">
              Preview · {primaryCount} 主件{variantCount > 0 ? ` · ${variantCount} 变体` : ''}
            </p>
            <div className="rounded-xl bg-white/30 border border-dashed border-graphite/20 p-4 flex justify-center min-h-[200px]">
              {previewEntries.length > 0 ? (
                <TagBundle entries={previewEntries} size="mini" />
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
          </div>

          {/* Photo upload — moved up, near preview */}
          <div>
            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/55 mb-2 text-center">
              整套 Look 照片（可选）
            </p>
            <div className="flex justify-center">
              {photoBase64 ? (
                <div className="relative w-32 h-32">
                  <img src={photoBase64} alt="outfit" className="w-full h-full object-cover border border-graphite/20" />
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
                  className="w-32 h-32 border border-dashed border-graphite/30 flex flex-col items-center justify-center gap-1 text-graphite/50 hover:text-ink hover:border-graphite/60 transition-colors"
                >
                  <ImageIcon className="w-5 h-5" />
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
        </aside>

        {/* Main: name, slot tabs, selected slots, filters, grid */}
        <div className="space-y-6">
          {/* Name input */}
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 32))}
              placeholder="给这套搭配起个名字…"
              className="w-full bg-transparent border-b border-graphite/25 pb-2 font-story font-bold text-xl text-ink placeholder:text-graphite/40 outline-none focus:border-ink/60 transition-colors"
              maxLength={32}
            />
          </div>

          {/* Slot tabs */}
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

          {/* Selected slots in current category — primaries with variants */}
          {currentSlots.length > 0 && (
            <div>
              <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-2">
                已选 · {activeCategory}
              </p>
              <div className="space-y-2.5">
                {currentSlots.map((slot) => {
                  const primary = itemMap.get(slot.primary);
                  if (!primary) return null;
                  const theme = getTagTheme(primary.id);
                  const isAddingHere = variantSlot?.primaryId === slot.primary;
                  return (
                    <div key={slot.primary} className="flex flex-wrap items-center gap-2">
                      {/* Primary chip */}
                      <button
                        onClick={() => removeSlot(activeSlotKey, slot.primary)}
                        className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 border-2 bg-tag font-semibold"
                        style={{ borderColor: theme.accentColor }}
                      >
                        <span className="font-story text-sm text-ink truncate max-w-[160px]">
                          {primary.name || '未命名'}
                        </span>
                        <X className="w-3.5 h-3.5 text-graphite" />
                      </button>
                      <span className="font-tag text-[10px] text-graphite/40 uppercase tracking-wider">→</span>
                      {/* Variants */}
                      {slot.variants?.map((vid) => {
                        const v = itemMap.get(vid);
                        if (!v) return null;
                        const vTheme = getTagTheme(v.id);
                        return (
                          <button
                            key={vid}
                            onClick={() => removeVariant(activeSlotKey, slot.primary, vid)}
                            className="flex items-center gap-1.5 pl-2 pr-1 py-1 border bg-tag/60"
                            style={{ borderColor: vTheme.accentColor + '80' }}
                          >
                            <GitBranch className="w-3 h-3 text-graphite/60" />
                            <span className="font-story text-xs text-ink/80 truncate max-w-[120px]">
                              {v.name || '未命名'}
                            </span>
                            <X className="w-3 h-3 text-graphite" />
                          </button>
                        );
                      })}
                      {/* Add variant button */}
                      <button
                        onClick={() => startAddVariant(activeSlotKey, slot.primary)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 border border-dashed font-tag text-[10px] uppercase tracking-wider transition-colors',
                          isAddingHere
                            ? 'border-ink bg-ink text-white'
                            : 'border-graphite/40 text-graphite/60 hover:text-ink hover:border-graphite/70'
                        )}
                      >
                        <GitBranch className="w-3 h-3" />
                        {isAddingHere ? '取消' : '加变体'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {variantSlot && (
                <p className="font-story italic text-xs text-stamp mt-3">
                  ↓ 在下方选一件作为变体（同品类）
                </p>
              )}
            </div>
          )}

          {/* Filters bar */}
          <div className="space-y-2.5">
            {/* Sort + Year row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-tag/70 border border-graphite/30">
                <ArrowUpDown className="w-3.5 h-3.5 text-graphite/60 shrink-0" />
                <select
                  value={sortOrder}
                  onChange={(e) => { sfx.toggle(); setSortOrder(e.target.value as any); }}
                  className="bg-transparent font-tag text-[11px] uppercase tracking-wider text-ink/75 outline-none cursor-pointer hover:text-ink transition-colors"
                >
                  <option value="default">默认</option>
                  <option value="ratingDesc">评分 ↓</option>
                  <option value="ratingAsc">评分 ↑</option>
                </select>
              </div>
              {availableYears.length > 0 && (
                <>
                  <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 ml-1">Year</span>
                  {(['全部', ...availableYears] as (number | '全部')[]).map((y) => (
                    <button
                      key={y}
                      onClick={() => { sfx.filterClick(); setFilterYear(y); }}
                      className={cn(
                        'px-2.5 py-1 font-tag text-[10px] tracking-wider font-semibold border transition-all whitespace-nowrap',
                        filterYear === y
                          ? 'bg-ink text-white border-ink'
                          : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Season (上装 only) */}
            {activeCategory === '上装' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 mr-1">Season</span>
                {seasonOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { sfx.filterClick(); setFilterSeason(s); }}
                    className={cn(
                      'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                      filterSeason === s
                        ? 'bg-ink/10 text-ink border-ink/30'
                        : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* TopType (上装 only) */}
            {activeCategory === '上装' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 mr-1">Type</span>
                <button
                  onClick={() => { sfx.filterClick(); setFilterTopType('全部'); }}
                  className={cn(
                    'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                    filterTopType === '全部'
                      ? 'bg-ink/10 text-ink border-ink/30'
                      : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                  )}
                >
                  全部
                </button>
                {TOP_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { sfx.filterClick(); setFilterTopType(t); }}
                    className={cn(
                      'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                      filterTopType === t
                        ? 'bg-ink/10 text-ink border-ink/30'
                        : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* AccessoryType (配饰 only) */}
            {activeCategory === '配饰' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 mr-1">Type</span>
                <button
                  onClick={() => { sfx.filterClick(); setFilterAccessoryType('全部'); }}
                  className={cn(
                    'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                    filterAccessoryType === '全部'
                      ? 'bg-ink/10 text-ink border-ink/30'
                      : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                  )}
                >
                  全部
                </button>
                {ACCESSORY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { sfx.filterClick(); setFilterAccessoryType(t); }}
                    className={cn(
                      'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                      filterAccessoryType === t
                        ? 'bg-ink/10 text-ink border-ink/30'
                        : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Type (下装 only) */}
            {activeCategory === '下装' && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 mr-1">Type</span>
                {lengthOptions.map((l) => (
                  <button
                    key={l}
                    onClick={() => { sfx.filterClick(); setFilterLength(l); }}
                    className={cn(
                      'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                      filterLength === l
                        ? 'bg-ink/10 text-ink border-ink/30'
                        : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}

            {/* Brand */}
            {brandIndex.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setBrandFilterOpen((v) => !v)}
                    className="flex items-center gap-1.5 font-tag text-[10px] uppercase tracking-widest text-graphite/50 hover:text-ink transition-colors shrink-0"
                  >
                    <span>{brandFilterOpen ? '▾' : '▸'}</span>
                    <span>Brand</span>
                  </button>
                  {filterBrand !== null && !brandFilterOpen && (() => {
                    const b = brandIndex.find((b) => b.key === filterBrand);
                    return b ? (
                      <button
                        onClick={() => { sfx.filterClick(); setFilterBrand(null); }}
                        className="px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border bg-ink/10 text-ink border-ink/30 flex items-center gap-1.5"
                      >
                        {b.display}
                        <span className="text-ink/40 text-[10px]">✕</span>
                      </button>
                    ) : null;
                  })()}
                </div>
                {brandFilterOpen && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-4">
                    {filterBrand !== null && (
                      <button
                        onClick={() => { sfx.filterClick(); setFilterBrand(null); }}
                        className="px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border bg-ink/10 text-ink border-ink/30"
                      >
                        全部
                      </button>
                    )}
                    {brandIndex.map(({ key, display, count }) => (
                      <button
                        key={key}
                        onClick={() => { sfx.filterClick(); setFilterBrand(filterBrand === key ? null : key); }}
                        className={cn(
                          'px-2.5 py-1 font-tag text-[10px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap',
                          filterBrand === key
                            ? 'bg-ink/10 text-ink border-ink/30'
                            : 'text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45'
                        )}
                      >
                        {display}
                        <span className={cn('ml-1 text-[10px] font-normal', filterBrand === key ? 'text-ink/50' : 'text-graphite/40')}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wardrobe grid for active category */}
          <div>
            <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mb-3">
              选 · {activeCategory}（{filteredCategoryItems.length} / {categoryItems.length}）
              {variantSlot && ' · 选变体中'}
            </p>
            {filteredCategoryItems.length === 0 ? (
              <p className="font-story italic text-sm text-graphite/50 py-8 text-center border border-dashed border-graphite/20">
                {categoryItems.length === 0 ? '该品类衣柜还没有衣物' : '当前筛选下没有衣物'}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {filteredCategoryItems.map((item) => {
                  const slots = selected[activeSlotKey];
                  const isPrimary = slots.some((s) => s.primary === item.id);
                  const isVariant = slots.some((s) => s.variants?.includes(item.id));
                  const isSelected = isPrimary || isVariant;
                  const theme = getTagTheme(item.id);
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => sfx.cardHover()}
                      onClick={() => toggleItem(item)}
                      className={cn(
                        'relative aspect-[3/4] overflow-hidden border transition-all',
                        isPrimary
                          ? 'ring-2 ring-ink ring-offset-2 ring-offset-kraft'
                          : isVariant
                            ? 'ring-2 ring-stamp/60 ring-offset-2 ring-offset-kraft'
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
                      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 backdrop-blur-sm bg-black/40">
                        <p className="font-story text-[10px] text-white truncate leading-tight">
                          {item.name || '未命名'}
                        </p>
                      </div>
                      {isSelected && (
                        <div className={cn(
                          'absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center',
                          isPrimary ? 'bg-ink' : 'bg-stamp'
                        )}>
                          {isPrimary ? <Check className="w-3 h-3 text-white" /> : <GitBranch className="w-3 h-3 text-white" />}
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

      {/* Bottom: scene tags + story */}
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
            搭配故事（可选 · 最多 500 字）
          </p>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value.slice(0, 500))}
            placeholder="为什么是这套？灵感是什么？想穿去哪？记下来…"
            rows={6}
            className="w-full px-3 py-2.5 bg-tag/40 border border-graphite/20 font-story text-sm text-ink placeholder:text-graphite/40 outline-none focus:border-ink/50 resize-none leading-relaxed"
          />
          <p className="text-right font-tag text-[10px] text-graphite/40 mt-1">{story.length} / 500</p>
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

