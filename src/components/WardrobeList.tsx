import { useState, useEffect, useRef, useMemo } from 'react';
import { auth } from '../lib/authCompat';
import { deleteWardrobeItem, deleteWardrobeItems, insertWardrobeItems } from '../lib/supabaseData';
import { WardrobeItem, Category, Season, TopType, TOP_TYPES, AccessoryType, ACCESSORY_TYPES } from '../types';
import { WardrobeItemCard } from './WardrobeItemCard';
import { AddEditItemModal } from './AddEditItemModal';
import { QuickAddItemModal } from './QuickAddItemModal';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { Plus, Loader2, Database, ArrowUpDown, Trash2, Check, Sparkles, Lock, X, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { ShareCardModal } from './ShareCardModal';
import { buildItemShareUrl, isWardrobePublic, setWardrobePublic } from '../lib/sharing';
import { SEED_DATA } from '../data/seedData';
import { fetchAuthorPreferredSample } from '../lib/sampleItems';
import { parseCsv } from '../lib/csv';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useBestMatches } from '../contexts/BestMatchContext';
import { sfx } from '../lib/sounds';
import { useNavigate } from 'react-router';
import { AuthorWardrobeEntry } from './AuthorWardrobeEntry';

const CATEGORIES: ('全部' | Category)[] = ['全部', '上装', '下装', '鞋子', '配饰'];

// 单用户单品上限（防写入滥用 / 控制每人对额度的占用）
const ITEM_LIMIT = 200;

// Best Match 解锁门槛：上传满 3 件单品才解锁该功能
const BEST_MATCH_UNLOCK = 3;
const ARCHIVE_FILTER_KEY = 'wearlog-archive-filter-category';

function getSavedArchiveCategory(): '全部' | Category {
  try {
    const saved = sessionStorage.getItem(ARCHIVE_FILTER_KEY);
    if (saved === '全部' || CATEGORIES.includes(saved as Category)) return saved as '全部' | Category;
  } catch {
    // Storage can be unavailable in private browsing; fall back to the default tab.
  }
  return '全部';
}

function normalizeBrand(b: string): string {
  return b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function extractBrands(raw: string): string[] {
  return raw.split(/\s+[xX×]\s+/).map(normalizeBrand).filter(Boolean);
}

function extractAiText(data: any): string {
  if (Array.isArray(data?.content)) {
    return data.content
      .map((part: any) => typeof part === 'string' ? part : part?.text || '')
      .join('')
      .trim();
  }
  if (typeof data?.content === 'string') return data.content.trim();
  const openAiContent = data?.choices?.[0]?.message?.content;
  if (Array.isArray(openAiContent)) {
    return openAiContent.map((part: any) => part?.text || '').join('').trim();
  }
  return typeof openAiContent === 'string' ? openAiContent.trim() : '';
}

function parseAiItems(rawText: string): any[] {
  const candidates: string[] = [];
  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  if (arrayMatch) candidates.push(arrayMatch[0]);
  const objectMatch = rawText.match(/\{[\s\S]*\}/);
  if (objectMatch) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed?.items)) return parsed.items;
    } catch {
      // Try the next JSON-shaped fragment.
    }
  }

  throw new Error(`AI 未返回可解析的 JSON。原始返回（前 600 字）：${rawText.slice(0, 600)}`);
}

export function WardrobeList() {
  const { items, loading, error } = useWardrobe();
  const { matches } = useBestMatches();
  const navigate = useNavigate();
  const scrollYRef = useRef(0);
  const [filterCategory, setFilterCategory] = useState<'全部' | Category>(getSavedArchiveCategory);
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);
  const [yearFilterOpen, setYearFilterOpen] = useState(false);
  const [brandStatsOpen, setBrandStatsOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const [importHelpDismissed, setImportHelpDismissed] = useState(() => {
    try {
      return localStorage.getItem('wearlog-import-help-hidden') === '1';
    } catch {
      return false;
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<WardrobeItem | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [subFilterSeason, setSubFilterSeason] = useState<'全部' | Season>('全部');
  const [subFilterLength, setSubFilterLength] = useState<'全部' | '长裤' | '短裤' | '裙子'>('全部');
  const [subFilterTopType, setSubFilterTopType] = useState<'全部' | TopType>('全部');
  const [subFilterAccessoryType, setSubFilterAccessoryType] = useState<'全部' | AccessoryType>('全部');
  const [sortOrder, setSortOrder] = useState<'default' | 'ratingDesc' | 'ratingAsc' | 'yearDesc' | 'yearAsc' | 'season' | 'brand' | 'category'>('default');
  const [filterYear, setFilterYear] = useState<number | '全部'>('全部');
  const [wardrobePublic, setWardrobePublicState] = useState(false);
  const [wardrobePublicLoading, setWardrobePublicLoading] = useState(true);
  const [sampleItem, setSampleItem] = useState<WardrobeItem | null>(null);
  const [shareTarget, setShareTarget] = useState<WardrobeItem | null>(null);
  const [shareHintSeen, setShareHintSeen] = useState(true);
  const [bmUnlockPopup, setBmUnlockPopup] = useState(false);
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // 新用户空衣柜：拉一张作者的真实卡片作为「示例」
  // 注意：仅在「真·空衣柜」时拉示例；若是加载失败（额度/网络）导致的空，
  // 不显示示例，避免把「读失败」误导成「你的账号是空的」。
  useEffect(() => {
    if (loading || items.length > 0 || error) return;
    let alive = true;
    fetchAuthorPreferredSample().then((it) => {
      if (alive && it) setSampleItem(it);
    });
    return () => { alive = false; };
  }, [loading, items.length, error]);

  // 首次进入 Archive 的分享提示
  useEffect(() => {
    setShareHintSeen(localStorage.getItem('wearlog-share-hint-seen') === '1');
  }, []);
  const dismissShareHint = () => {
    localStorage.setItem('wearlog-share-hint-seen', '1');
    setShareHintSeen(true);
  };

  // Best Match 解锁弹窗：单品首次满 3 件、且还没建过搭配、且没弹过 → 弹一次
  useEffect(() => {
    if (loading) return;
    if (items.length < BEST_MATCH_UNLOCK) return;
    if (matches.length > 0) return; // 老用户已在用，不打扰
    if (localStorage.getItem('wearlog-bm-unlock-seen') === '1') return;
    localStorage.setItem('wearlog-bm-unlock-seen', '1');
    setBmUnlockPopup(true);
  }, [loading, items.length, matches.length]);

  const bestMatchUnlocked = items.length >= BEST_MATCH_UNLOCK;

  useEffect(() => {
    if (!auth.currentUser) return;
    isWardrobePublic()
      .then(setWardrobePublicState)
      .catch(() => setWardrobePublicState(false))
      .finally(() => setWardrobePublicLoading(false));
  }, []);

  const toggleWardrobePublic = async () => {
    if (wardrobePublicLoading) return;
    const next = !wardrobePublic;
    setWardrobePublicState(next);
    try {
      await setWardrobePublic(next);
    } catch {
      setWardrobePublicState(!next);
      alert('操作失败，请重试');
    }
  };

  useEffect(() => {
    setSubFilterSeason('全部');
    setSubFilterLength('全部');
    setSubFilterTopType('全部');
    setSubFilterAccessoryType('全部');
  }, [filterCategory]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ARCHIVE_FILTER_KEY, filterCategory);
    } catch {
      // Storage is a convenience; filtering must still work without it.
    }
  }, [filterCategory]);

  // 滚动位置保存（离开时）/ 恢复（回来时）
  useEffect(() => {
    const onScroll = () => { scrollYRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      sessionStorage.setItem('wardrobe-list-scroll', String(scrollYRef.current));
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    const saved = sessionStorage.getItem('wardrobe-list-scroll');
    if (!saved) return;
    sessionStorage.removeItem('wardrobe-list-scroll');
    const y = Number(saved);
    if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  }, [loading]);

  // Collect available years from items
  const availableYears = Array.from(
    new Set(items.map(i => i.purchaseYear).filter((y): y is number => !!y))
  ).sort((a, b) => b - a);

  // 品牌索引（全量 items，不受筛选影响）
  const brandIndex = useMemo(() => {
    const map = new Map<string, { display: string; count: number }>();
    for (const item of items) {
      if (!item.brand) continue;
      const tokens = extractBrands(item.brand);
      for (const token of tokens) {
        const existing = map.get(token);
        if (existing) {
          existing.count++;
        } else {
          const rawPart = item.brand.split(/\s+[xX×]\s+/).find(p => normalizeBrand(p) === token) ?? item.brand;
          map.set(token, { display: rawPart.trim(), count: 1 });
        }
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count || a.display.localeCompare(b.display))
      .map(([key, val]) => ({ key, ...val }));
  }, [items]);

  // 当前品牌筛选下的统计（跨分类）
  const brandStats = useMemo(() => {
    if (!filterBrand) return null;
    const matching = items.filter(i => i.brand && extractBrands(i.brand).includes(filterBrand));
    return {
      total: matching.length,
      上装: matching.filter(i => i.category === '上装').length,
      下装: matching.filter(i => i.category === '下装').length,
      鞋子: matching.filter(i => i.category === '鞋子').length,
      配饰: matching.filter(i => i.category === '配饰').length,
    };
  }, [filterBrand, items]);

  const handleDelete = async (item: WardrobeItem) => {
    try {
      await deleteWardrobeItem(item.id);
    } catch (error) {
      const kind = handleFirestoreError(error, OperationType.DELETE, `wardrobe_items/${item.id}`);
      alert(kind === 'busy' ? '服务器繁忙，删除未成功，请稍后重试。' : '删除失败，请稍后重试。');
    }
  };

  const handleEdit = (item: WardrobeItem) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    if (items.length >= ITEM_LIMIT) {
      alert(`已达单品上限 ${ITEM_LIMIT} 件。如需继续记录，请先删除一些不再需要的单品。`);
      return;
    }
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const openQuickAddModal = () => {
    if (items.length >= ITEM_LIMIT) {
      alert(`已达单品上限 ${ITEM_LIMIT} 件。如需继续记录，请先删除一些不再需要的单品。`);
      return;
    }
    setIsQuickAddOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
      alert('请先登录后再导入数据。');
      event.target.value = '';
      return;
    }

    setIsSeeding(true);
    try {
      let parsedData: any[] = [];
      const idToken = await auth.currentUser.getIdToken();
      const requestAi = async (requestBody: Record<string, unknown>) => {
        const aiRes = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'authorization': `Bearer ${idToken}` },
          body: JSON.stringify(requestBody),
        });
        if (!aiRes.ok) {
          const errBody = await aiRes.text();
          throw new Error(`AI 解析失败: ${aiRes.status} — ${errBody.slice(0, 300)}`);
        }
        return aiRes.json();
      };

      if (file.name.endsWith('.json')) {
        const text = await file.text();
        parsedData = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsedData = parseCsv(text);
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.pdf')) {
        let fileText: string;

        if (file.name.endsWith('.pdf')) {
          const { extractText, getDocumentProxy } = await import('unpdf');
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
          const { text } = await extractText(pdf, { mergePages: true });
          if (!text || !text.trim()) {
            throw new Error('PDF 文字提取失败：可能是图片型扫描件，请改用图片文件或 TXT');
          }
          fileText = text;
        } else {
          fileText = await file.text();
        }
        const aiData = await requestAi({
          messages: [{ role: 'user', content: [{ type: 'text', text: `从以下文档中提取衣物信息，以 JSON 数组返回，每个对象包含：name（字符串）、brand（品牌名，字符串，可选）、rating（1-10的数字）、category（"上装"/"下装"/"鞋子"/"配饰" 之一）、season（"春季"/"秋季"/"秋冬"/"春秋"/"夏季"/"冬季"/"四季" 之一）、story（描述或故事）。注意：输出必须是合法的 JSON 格式，严禁在对象末尾添加多余逗号，严禁添加任何 Markdown 标签，直接以 '[' 开始输出。\n\n${fileText}` }] }],
        });
        const rawText = extractAiText(aiData);
        if (!rawText) throw new Error(`AI 返回空内容: ${JSON.stringify(aiData).slice(0, 200)}`);
        parsedData = parseAiItems(rawText);
      } else {
        alert('不支持的文件格式，请上传 JSON, CSV, TXT 或 PDF 文件。');
        return;
      }

      if (!Array.isArray(parsedData)) {
        alert('文件内容格式不正确，期望是一个数组。');
        return;
      }

      const userId = auth.currentUser.uid;

      let validItems = parsedData.filter(item => item.name && item.category);

      if (validItems.length === 0) {
        alert(`没有有效数据。parsedData 前两项：${JSON.stringify(parsedData.slice(0, 2))}`);
        return;
      }

      // 单品上限：超出部分不导入
      const remaining = ITEM_LIMIT - items.length;
      if (remaining <= 0) {
        alert(`已达单品上限 ${ITEM_LIMIT} 件，无法继续导入。`);
        return;
      }
      if (validItems.length > remaining) {
        const skipped = validItems.length - remaining;
        validItems = validItems.slice(0, remaining);
        alert(`单品上限为 ${ITEM_LIMIT} 件，本次仅导入前 ${remaining} 条，跳过 ${skipped} 条。`);
      }

      const prepared = validItems.map((item, i) => ({
            name: item.name,
            ...(item.brand ? { brand: item.brand } : {}),
            rating: Number(item.rating) || 5,
            category: item.category,
            season: item.season || '四季',
            story: item.story || '',
            userId,
            orderIndex: items.length + i,
            ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
          }));
      await insertWardrobeItems(userId, prepared);
      const totalCount = prepared.length;

      alert(`成功导入 ${totalCount} 条数据！`);
    } catch (error: any) {
      console.error("Error importing data", error);
      const msg = error?.message || error?.code || String(error);
      alert(`导入失败：${msg}`);
    } finally {
      setIsSeeding(false);
      event.target.value = '';
    }
  };

  const mappedItems = items.map(item => ({ ...item, displaySeason: item.season }));

  const filteredItems = mappedItems.filter(item => {
    if (sortOrder !== 'category' && filterCategory !== '全部' && item.category !== filterCategory) return false;

    if (filterCategory === '上装' && subFilterSeason !== '全部') {
      if (subFilterSeason === '秋冬') {
        if (!['秋季', '秋冬', '冬季'].includes(item.displaySeason)) return false;
      } else if (item.displaySeason !== subFilterSeason) {
        return false;
      }
    }

    if (filterCategory === '上装' && subFilterTopType !== '全部') {
      if (item.topType !== subFilterTopType) return false;
    }

    if (filterCategory === '下装' && subFilterLength !== '全部') {
      if (item.length !== subFilterLength) return false;
    }

    if (filterCategory === '配饰' && subFilterAccessoryType !== '全部') {
      if (item.accessoryType !== subFilterAccessoryType) return false;
    }

    if (filterYear !== '全部' && item.purchaseYear !== filterYear) return false;

    if (filterBrand !== null) {
      if (!item.brand || !extractBrands(item.brand).includes(filterBrand)) return false;
    }

    return true;
  });

  const SEASON_ORDER: Record<string, number> = { '夏季': 0, '春季': 1, '春秋': 2, '秋季': 3, '秋冬': 4, '冬季': 5, '四季': 6, '无': 7 };
  const CATEGORY_ORDER: Record<string, number> = { '上装': 0, '下装': 1, '鞋子': 2, '配饰': 3 };

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortOrder === 'ratingDesc') return b.rating - a.rating;
    if (sortOrder === 'ratingAsc') return a.rating - b.rating;
    if (sortOrder === 'yearDesc') return (b.purchaseYear ?? 0) - (a.purchaseYear ?? 0);
    if (sortOrder === 'yearAsc') return (a.purchaseYear ?? 9999) - (b.purchaseYear ?? 9999);
    if (sortOrder === 'season') return (SEASON_ORDER[a.season] ?? 7) - (SEASON_ORDER[b.season] ?? 7);
    if (sortOrder === 'brand') {
      const ba = a.brand?.toLowerCase() ?? 'zzz';
      const bb = b.brand?.toLowerCase() ?? 'zzz';
      return ba.localeCompare(bb, 'zh');
    }
    if (sortOrder === 'category') return (CATEGORY_ORDER[a.category] ?? 4) - (CATEGORY_ORDER[b.category] ?? 4);

    const getOrderIndex = (item: WardrobeItem) => {
      if (item.orderIndex !== undefined) return item.orderIndex;
      const seedIndex = SEED_DATA.findIndex(s => s.name === item.name);
      if (seedIndex !== -1) return seedIndex;
      return item.createdAt?.toMillis?.() ?? Date.now();
    };

    return getOrderIndex(a) - getOrderIndex(b);
  });

  // 筛选结果描述句
  const summaryText = (() => {
    const n = sortedItems.length;
    if (n === 0) return null;

    const brandDisplay = filterBrand
      ? (brandIndex.find(b => b.key === filterBrand)?.display ?? filterBrand)
      : null;

    // 构建描述
    if (brandDisplay && filterCategory !== '全部') {
      return `${brandDisplay} 的${filterCategory}，一共 ${n} 件`;
    }
    if (brandDisplay) {
      return `${brandDisplay}，一共 ${n} 件单品`;
    }
    if (filterCategory !== '全部') {
      if (subFilterLength !== '全部') {
        return `一共 ${n} 件${subFilterLength}`;
      }
      if (subFilterTopType !== '全部') {
        return subFilterSeason !== '全部'
          ? `${subFilterSeason} ${subFilterTopType}，一共 ${n} 件`
          : `一共 ${n} 件${subFilterTopType}`;
      }
      if (subFilterSeason !== '全部') {
        return `${subFilterSeason}${filterCategory}，一共 ${n} 件`;
      }
      if (subFilterAccessoryType !== '全部') {
        return `一共 ${n} 件${subFilterAccessoryType}`;
      }
      if (filterYear !== '全部') {
        return `${filterYear} 年入手的${filterCategory}，共 ${n} 件`;
      }
      return `一共 ${n} 件${filterCategory}`;
    }
    if (filterYear !== '全部') {
      return `${filterYear} 年入手，一共 ${n} 件单品`;
    }
    return `一共 ${n} 件单品`;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-graphite/40" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      {/* Header */}
        <div className="flex flex-col gap-3">
        <div className="border-b border-dashed border-graphite/25 pb-4">
          <p className="font-tag text-[10px] uppercase tracking-[0.3em] text-graphite/55 mb-2">
            D-Tag Archive · {items.length} Items
          </p>
          <div className="archive-title-row flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4">
            <div>
              <h2
                className="text-[2.75rem] sm:text-[3.5rem] leading-none text-ink"
                style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.04em' }}
              >
                Archive
              </h2>
              <p className="font-story text-[14px] text-graphite/70 mt-2 italic" style={{ letterSpacing: '0.02em' }}>
                记录独属于你和衣服的故事
              </p>
            </div>
            {/* Workspace 1: account sits above the two peer actions. */}
            <div className="archive-header-actions flex flex-wrap justify-end items-center gap-2 w-full sm:w-auto">
                <AuthorWardrobeEntry className="archive-utility-button" />
              <button
                type="button"
                onClick={() => { sfx.toggle(); toggleWardrobePublic(); }}
                disabled={wardrobePublicLoading}
                aria-pressed={wardrobePublic}
                aria-label={wardrobePublic ? '取消整柜公开' : '公开整柜'}
                title={wardrobePublic ? '点击取消整柜公开' : '点击公开整个衣柜'}
                className={cn(
                  "header-action-button archive-utility-button font-medium border transition-all disabled:opacity-60",
                  wardrobePublic
                    ? "bg-stamp text-white border-stamp"
                    : "bg-tag/70 text-ink/70 border-graphite/30 hover:border-stamp/60 hover:text-ink"
                )}
              >
                <span className={cn(
                  "w-5 h-5 flex items-center justify-center border transition-colors",
                  wardrobePublic ? "border-white/70 bg-white/15" : "border-graphite/35"
                )} aria-hidden="true">
                  {wardrobePublic && <Check className="w-3.5 h-3.5" />}
                </span>
                <span>整柜公开</span>
              </button>
              <div className="hidden">
                <ArrowUpDown className="w-[17px] h-[17px] text-graphite/60 shrink-0" />
                <select
                  value={sortOrder}
                  onChange={(e) => { sfx.toggle(); setSortOrder(e.target.value as any); }}
                  className="bg-transparent font-story text-[14px] tracking-wide text-ink/75 outline-none cursor-pointer hover:text-ink transition-colors w-full"
                >
                  <option value="default">默认排序</option>
                  <option value="ratingDesc">评分 ↓</option>
                  <option value="ratingAsc">评分 ↑</option>
                  <option value="yearDesc">年份 ↓</option>
                  <option value="yearAsc">年份 ↑</option>
                  <option value="season">季节</option>
                  <option value="brand">品牌</option>
                  <option value="category">品类</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Best Match entry —— 上传满 3 件单品才解锁 */}
        {bestMatchUnlocked ? (
          <button
            onMouseEnter={() => sfx.cardHover()}
            onClick={() => { sfx.cardClick(); navigate('/best-match'); }}
            className="best-match-entry group w-full text-left"
          >
            <div className="best-match-entry__mark" aria-hidden="true">
              <span className="tag-stack-mark__tag tag-stack-mark__tag--back" />
              <span className="tag-stack-mark__tag tag-stack-mark__tag--middle" />
              <span className="tag-stack-mark__tag tag-stack-mark__tag--front" />
            </div>
            <div className="best-match-entry__copy">
              <p className="best-match-entry__eyebrow">Best Match · {matches.length} Looks</p>
              <p className="best-match-entry__title">心中的最佳搭配</p>
              <p className="best-match-entry__description">
                {matches.length === 0 ? '把那些“绝对没错”的组合，存成你的审美档案。' : '查看与继续添加你最认可的搭配组合。'}
              </p>
            </div>
            <span className="best-match-entry__cta">
              <span className="best-match-entry__cta-full">进入档案</span>
              <span className="best-match-entry__cta-short">查看搭配</span>
              <span aria-hidden>↗</span>
            </span>
          </button>
        ) : (
          <div
            className="best-match-entry best-match-entry--locked w-full text-left"
            title={`再添加 ${BEST_MATCH_UNLOCK - items.length} 件单品解锁 Best Match`}
          >
            <div className="best-match-entry__mark">
              <Lock className="w-4 h-4 text-graphite/40" />
            </div>
            <div className="best-match-entry__copy">
              <p className="best-match-entry__eyebrow">Best Match · Locked</p>
              <p className="best-match-entry__title text-graphite/65">
                再添加 <strong className="text-graphite/80">{BEST_MATCH_UNLOCK - items.length}</strong> 件单品解锁「心中最佳搭配」
              </p>
            </div>
          </div>
        )}

        {/* 首次分享提示 */}
        {!shareHintSeen && items.length > 0 && (
          <div className="flex items-center gap-3 bg-tag/70 border border-dashed border-stamp/30 px-4 py-2.5">
            <p className="flex-1 font-story text-[13px] text-ink/75 leading-snug">
              点任意单品/搭配右上角的<span className="text-stamp font-semibold"> 分享 </span>，即可生成图文卡片发给朋友 →
            </p>
            <button
              onClick={dismissShareHint}
              className="shrink-0 p-1 text-graphite/50 hover:text-ink transition-colors"
              title="知道了"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-0 w-full">
          <div className="archive-actions w-full">
          <div className="archive-batch-actions">
            <button
              type="button"
              onClick={() => setBatchMenuOpen(v => !v)}
              className="archive-batch-trigger"
              aria-expanded={batchMenuOpen}
            >
              <Database className="w-4 h-4" />
              <span>批量导入</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", batchMenuOpen && "rotate-180")} />
            </button>
          <div className={cn("archive-batch-menu", batchMenuOpen && "archive-batch-menu--open")}>
            {/* 清理重复：对空衣柜无意义，新用户先聚焦「添加衣物」。整柜公开改由分享卡里勾选控制。 */}
            {items.length > 0 && (<>
            <button
              onClick={async () => {
                if (!auth.currentUser) return;
                setIsSeeding(true);
                try {
                  const allItems = items;

                  const nameGroups = new Map<string, WardrobeItem[]>();
                  allItems.forEach(item => {
                    const group = nameGroups.get(item.name) || [];
                    group.push(item);
                    nameGroups.set(item.name, group);
                  });

                  const idsToDelete: string[] = [];
                  let deleteCount = 0;

                  nameGroups.forEach(group => {
                    if (group.length > 1) {
                      group.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis() || 0;
                        const timeB = b.createdAt?.toMillis() || 0;
                        return timeA - timeB;
                      });
                      for (let i = 1; i < group.length; i++) {
                        idsToDelete.push(group[i].id);
                        deleteCount++;
                      }
                    }
                  });

                  if (deleteCount > 0) {
                    await deleteWardrobeItems(idsToDelete);
                    alert(`成功清理了 ${deleteCount} 条重复数据！`);
                  } else {
                    alert('没有发现重复数据。');
                  }
                } catch (error) {
                  console.error("Error deduplicating data", error);
                  alert('清理失败，请重试。');
                } finally {
                  setIsSeeding(false);
                }
              }}
              disabled={isSeeding}
              className="archive-deduplicate flex items-center gap-2 min-h-12 px-5 bg-tag border-y border-r border-graphite/20 font-story text-[14px] tracking-wide font-semibold text-stamp hover:bg-stamp/8 transition-colors whitespace-nowrap disabled:opacity-40"
            >
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>清理重复</span>
            </button>
            </>)}

            <div className="relative archive-import-control bg-tag border border-graphite/20 shadow-sm">
              <input
                type="file"
                accept=".json,.csv,.txt,.pdf"
                onClick={() => {
                  setBatchMenuOpen(false);
                  if (!importHelpDismissed) setImportHelpOpen(true);
                }}
                onChange={handleFileUpload}
                disabled={isSeeding}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                title="支持格式: JSON, CSV, TXT, PDF"
              />
              <button
                disabled={isSeeding}
                className="flex items-center gap-2 min-h-12 px-5 font-story text-[14px] tracking-wide font-semibold text-ink/70 hover:text-ink hover:bg-graphite/5 transition-colors whitespace-nowrap disabled:opacity-40 border-r border-graphite/15"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>导入数据</span>
              </button>
            </div>

          </div>

            <button
              onClick={() => { sfx.modalOpen(); openQuickAddModal(); }}
              className="archive-add-button ml-auto flex items-center gap-2 min-h-12 px-5 bg-ink text-white font-story text-[14px] tracking-wide font-semibold hover:bg-ink/85 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>添加衣物</span>
            </button>
          </div>

          {/* 导入说明：可导入内容与边界，降低批量导入的困惑 */}
          <div className="order-4 basis-full w-full sm:text-right">
            <button
              onClick={() => setImportHelpOpen(v => !v)}
              className="hidden"
            >
              <span>{importHelpOpen ? '▾' : '▸'}</span>
              <span>导入说明</span>
            </button>
            {importHelpOpen && (
              <div className="mt-2 px-4 py-3 bg-tag/70 border border-graphite/20 text-left max-w-md sm:ml-auto">
                <p className="font-tag text-[9px] uppercase tracking-widest text-graphite/45 mb-2">可导入的内容 / 边界</p>
                <ul className="space-y-1 list-disc pl-4 font-story text-[12px] leading-relaxed text-ink/70">
                  <li>支持 <strong>JSON / CSV / TXT / PDF</strong>；图片分析接口暂不接入本入口。</li>
                  <li>每条至少需 <strong>名称 + 品类</strong>；可含品牌 / 评分 / 季节 / 故事。</li>
                  <li>TXT / PDF 由 AI 解析，<strong>尽力而为</strong>，可能漏或错，导入后请核对。</li>
                  <li>单柜上限 <strong>200 件</strong>，超出部分不导入；单次文件不要过大。</li>
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setImportHelpDismissed(true);
                    setImportHelpOpen(false);
                    try {
                      localStorage.setItem('wearlog-import-help-hidden', '1');
                    } catch {
                      // The preference is optional when storage is unavailable.
                    }
                  }}
                  className="mt-3 font-story text-[12px] text-graphite/60 underline underline-offset-4 hover:text-ink transition-colors"
                >
                  不再显示
                </button>
              </div>
            )}
          </div>

        </div>
        </div>

        <button
          type="button"
          className="archive-filter-toggle sm:hidden"
          onClick={() => setFilterPanelOpen(v => !v)}
          aria-expanded={filterPanelOpen}
        >
          <span>筛选与排序</span>
          <span className="archive-filter-toggle__summary">{filterCategory}{filterBrand ? ` · ${filterBrand}` : ''}</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", filterPanelOpen && "rotate-180")} />
        </button>

        <div className={cn("archive-filter-panel", filterPanelOpen && "archive-filter-panel--open")}>
        {/* Category filter pills */}
        <div className="archive-category-filters flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-h-10 px-3 sm:px-4 bg-tag/70 border border-graphite/30 shrink-0">
            <ArrowUpDown className="w-[17px] h-[17px] text-graphite/60 shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => { sfx.toggle(); setSortOrder(e.target.value as any); }}
              className="bg-transparent font-story text-[14px] tracking-wide text-ink/75 outline-none cursor-pointer hover:text-ink transition-colors"
            >
              <option value="default">默认排序</option>
              <option value="ratingDesc">评分 ↓</option>
              <option value="ratingAsc">评分 ↑</option>
              <option value="yearDesc">年份 ↓</option>
              <option value="yearAsc">年份 ↑</option>
              <option value="season">季节</option>
              <option value="brand">品牌</option>
              <option value="category">品类</option>
            </select>
          </div>
          {CATEGORIES.map(cat => {
            const isActive = filterCategory === cat;
            const count = cat === '全部'
              ? items.length
              : items.filter(i => i.category === cat).length;
            return (
              <button
                key={cat}
                onMouseEnter={() => sfx.cardHover()}
                onClick={() => { sfx.filterClick(); setFilterCategory(cat); }}
                className={cn(
                  "relative min-h-10 sm:min-h-12 px-4 sm:px-6 font-story text-[13px] sm:text-[14px] tracking-wide font-semibold border transition-all shrink-0",
                  isActive
                    ? "bg-ink text-white border-ink shadow-sm"
                    : "bg-tag/60 text-ink/55 border-graphite/25 hover:text-ink hover:border-graphite/55 hover:bg-tag"
                )}
              >
                {cat}
                <span className={cn("ml-2 text-[12px] font-normal", isActive ? "text-white/60" : "text-graphite/45")}>{count}</span>
              </button>
            );
          })}
          {availableYears.length > 0 && (
            <button
              type="button"
              onClick={() => setYearFilterOpen(v => !v)}
              className="ml-auto flex min-h-10 sm:min-h-12 items-center gap-1.5 px-3 sm:px-4 font-tag text-[11px] uppercase tracking-widest text-graphite/60 border border-graphite/20 hover:text-ink hover:border-graphite/45 transition-colors shrink-0"
            >
              <span>Year</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", yearFilterOpen && "rotate-180")} />
            </button>
          )}
          {brandIndex.length > 0 && (
            <button
              type="button"
              onClick={() => setBrandFilterOpen(v => !v)}
              className="flex min-h-10 sm:min-h-12 items-center gap-1.5 px-3 sm:px-4 font-tag text-[11px] uppercase tracking-widest text-graphite/60 border border-graphite/20 hover:text-ink hover:border-graphite/45 transition-colors shrink-0"
            >
              <span>Brand</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", brandFilterOpen && "rotate-180")} />
            </button>
          )}
        </div>

        {/* Sub-filters */}
        {filterCategory === '上装' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[12px] uppercase tracking-widest text-graphite/55 shrink-0 mr-1">Type</span>
            {(['全部', ...TOP_TYPES] as ('全部' | TopType)[]).map(t => (
              <button
                key={t}
                onClick={() => { sfx.filterClick(); setSubFilterTopType(t); }}
                className={cn(
                  "min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border transition-all whitespace-nowrap",
                  subFilterTopType === t
                    ? "bg-ink/10 text-ink border-ink/30"
                    : "text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {filterCategory === '上装' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[12px] uppercase tracking-widest text-graphite/55 shrink-0 mr-1">Season</span>
            {['全部', '春秋', '春季', '秋季', '秋冬', '夏季', '冬季', '四季'].map(season => (
              <button
                key={season}
                onClick={() => { sfx.filterClick(); setSubFilterSeason(season as any); }}
                className={cn(
                  "min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border transition-all whitespace-nowrap",
                  subFilterSeason === season
                    ? "bg-ink/10 text-ink border-ink/30"
                    : "text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45"
                )}
              >
                {season}
              </button>
            ))}
          </div>
        )}

        {filterCategory === '配饰' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[12px] uppercase tracking-widest text-graphite/55 shrink-0 mr-1">Type</span>
            {(['全部', ...ACCESSORY_TYPES] as ('全部' | AccessoryType)[]).map(t => (
              <button
                key={t}
                onClick={() => { sfx.filterClick(); setSubFilterAccessoryType(t); }}
                className={cn(
                  "min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border transition-all whitespace-nowrap",
                  subFilterAccessoryType === t
                    ? "bg-ink/10 text-ink border-ink/30"
                    : "text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {filterCategory === '下装' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[12px] uppercase tracking-widest text-graphite/55 shrink-0 mr-1">Type</span>
            {['全部', '长裤', '短裤', '裙子'].map(length => (
              <button
                key={length}
                onClick={() => { sfx.filterClick(); setSubFilterLength(length as any); }}
                className={cn(
                  "min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border transition-all whitespace-nowrap",
                  subFilterLength === length
                    ? "bg-ink/10 text-ink border-ink/30"
                    : "text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45"
                )}
              >
                {length}
              </button>
            ))}
          </div>
        )}

        {/* Year filter — only shown when items have purchase years */}
        {availableYears.length > 0 && yearFilterOpen && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[12px] uppercase tracking-widest text-graphite/55 shrink-0 mr-1">Year</span>
            {(['全部', ...availableYears] as (number | '全部')[]).map(y => (
              <button
                key={y}
                onClick={() => { sfx.filterClick(); setFilterYear(y); }}
                className={cn(
                  "min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border transition-all whitespace-nowrap",
                  filterYear === y
                    ? "bg-ink text-white border-ink"
                    : "text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45"
                )}
              >
                {y}
              </button>
            ))}
          </div>
        )}
        {/* Brand filter — 折叠式，默认只显示标题行 */}
        {brandIndex.length > 0 && brandFilterOpen && (
          <div className="flex flex-col gap-2">
            {/* 标题行：Brand 标签 + 展开箭头 + 当前选中品牌（如有） */}
            <div className="hidden">
              <button
                onClick={() => setBrandFilterOpen(v => !v)}
                className="flex min-h-9 items-center gap-1.5 font-tag text-[12px] uppercase tracking-widest text-graphite/55 hover:text-ink transition-colors shrink-0"
              >
                <span>{brandFilterOpen ? '▾' : '▸'}</span>
                <span>Brand</span>
              </button>
              {/* 已选中时，收起状态也保留可见的 badge */}
              {filterBrand !== null && !brandFilterOpen && (() => {
                const b = brandIndex.find(b => b.key === filterBrand);
                return b ? (
                  <button
                    onClick={() => { sfx.filterClick(); setFilterBrand(null); }}
                    className="min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border bg-ink/10 text-ink border-ink/30 flex items-center gap-1.5"
                  >
                    {b.display}
                    <span className="text-ink/40 text-[10px]">✕</span>
                  </button>
                ) : null;
              })()}
            </div>
            {/* 展开后的 pills */}
            {brandFilterOpen && (
              <div className="flex items-center gap-2 flex-wrap pl-4">
                {filterBrand !== null && (
                  <button
                    onClick={() => { sfx.filterClick(); setFilterBrand(null); }}
                    className="min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border bg-ink/10 text-ink border-ink/30"
                  >
                    全部
                  </button>
                )}
                {brandIndex.map(({ key, display, count }) => (
                  <button
                    key={key}
                    onClick={() => { sfx.filterClick(); setFilterBrand(filterBrand === key ? null : key); }}
                    className={cn(
                      "min-h-10 px-4 py-2 font-story text-[13px] tracking-wide font-medium border transition-all whitespace-nowrap",
                      filterBrand === key
                        ? "bg-ink/10 text-ink border-ink/30"
                        : "text-graphite/55 border-graphite/20 hover:text-ink hover:border-graphite/45"
                    )}
                  >
                    {display}
                    <span className={cn("ml-1.5 text-[10px] font-normal", filterBrand === key ? "text-ink/50" : "text-graphite/40")}>{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 品牌维度统计（可折叠，品牌筛选激活时） */}
        {brandStats && (
          <div>
            <button
              onClick={() => setBrandStatsOpen(v => !v)}
              className="flex min-h-9 items-center gap-2 font-tag text-[12px] uppercase tracking-widest text-graphite/55 hover:text-ink transition-colors"
            >
              <span>{brandStatsOpen ? '▾' : '▸'}</span>
              <span>品牌详情</span>
            </button>
            {brandStatsOpen && (
              <div className="mt-2 px-4 py-3 bg-tag/70 border border-graphite/20 font-tag text-[11px] tracking-wider text-ink/70">
                <span>该品牌共 <strong className="text-ink">{brandStats.total}</strong> 件单品</span>
                {brandStats.上装 > 0 && <><span className="mx-2 text-graphite/30">·</span><span>上装 {brandStats.上装}</span></>}
                {brandStats.下装 > 0 && <><span className="mx-2 text-graphite/30">·</span><span>下装 {brandStats.下装}</span></>}
                {brandStats.鞋子 > 0 && <><span className="mx-2 text-graphite/30">·</span><span>鞋子 {brandStats.鞋子}</span></>}
                {brandStats.配饰 > 0 && <><span className="mx-2 text-graphite/30">·</span><span>配饰 {brandStats.配饰}</span></>}
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* ── 筛选结果描述句 ─────────────────────────────────── */}
      {summaryText && (
        <p
          className="font-story text-2xl sm:text-3xl text-ink font-semibold tracking-tight"
          style={{ fontStyle: 'italic' }}
        >
          {summaryText}
        </p>
      )}

      {/* ── Masonry Grid ─────────────────────────────────── */}
      <div>
        {sortedItems.length === 0 && error ? (
          /* 加载失败（最常见是免费层读额度用尽 → 429）：不要伪装成空衣柜吓人 */
          <div className="text-center py-24 max-w-md mx-auto">
            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/40 mb-3">Temporarily Unavailable</p>
            <h3 className="text-2xl font-story font-bold text-ink mb-3">衣柜暂时加载不出来</h3>
            <p className="text-graphite/70 mb-2 font-story leading-relaxed">
              {error === 'permission'
                ? '没有读取权限，请重新登录后再试。'
                : '服务器有点忙（可能是今天的访问/调试量较大），你的数据没有丢失，稍后刷新即可恢复。'}
            </p>
            <p className="text-graphite/45 text-xs font-story mb-8">
              {error === 'permission' ? '' : '（免费额度按太平洋时间午夜重置，约北京次日下午）'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-ink text-white font-tag text-[10px] uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors inline-flex items-center gap-2"
            >
              重新加载
            </button>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-20">
            {/* 示例卡：让新用户看到「填好一张卡」长什么样。明确标注这是作者的示例，不是用户自己的衣物 */}
            {sampleItem && (
              <div className="mb-14 flex flex-col items-center">
                <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/45 mb-1">
                  Sample · 示例（来自作者的衣柜）
                </p>
                <p className="font-story text-sm text-graphite/70 mb-1 italic">
                  这不是你的衣物 —— 只是给你看「一张填好的卡片」长什么样 ↓
                </p>
                <p className="font-story text-xs text-graphite/45 mb-6">
                  你的衣柜目前还是空的，添加后这里就会换成你自己的记录。
                </p>
                <div className="w-full max-w-[300px] pointer-events-none select-none opacity-95">
                  <WardrobeItemCard item={sampleItem} index={0} eager={false} />
                </div>
              </div>
            )}
            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/35 mb-6">— No Tags —</p>
            <h3 className="text-2xl font-story font-bold text-ink mb-4">Archive Empty</h3>
            <p className="text-graphite mb-8 font-story">开始记录你的第一件衣物故事吧</p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => setIsQuickAddOpen(true)}
                className="min-h-12 px-8 py-3 bg-ink text-white font-story text-[14px] font-semibold hover:bg-ink/90 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                先记录第一件
              </button>
              <button
                onClick={openQuickAddModal}
                className="hidden"
              >
                完整填写
              </button>
            </div>
          </div>
        ) : (
          <div className="masonry-grid pt-1 sm:pt-4">
            {sortedItems.map((item, i) => (
              <WardrobeItemCard
                key={item.id}
                item={{...item, season: item.displaySeason as Season}}
                index={i}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShare={(it) => { setShareTarget(it); }}
              />
            ))}

            {/* Add New Tag */}
            <div
              className="cursor-pointer"
              onClick={openQuickAddModal}
              style={{ transform: 'rotate(0.8deg)' }}
            >
              <div className="group tag-card-bg tag-shadow flex flex-col items-center justify-center min-h-[280px] hover:translate-y-[-3px] transition-all duration-300 border border-dashed border-graphite/20 hover:border-graphite/40">
                <div className="w-12 h-12 border border-dashed border-ink/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                  <Plus className="w-5 h-5 text-ink/50" />
                </div>
                <p className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/35 mb-1">New Tag</p>
                <span className="text-ink/50 font-story font-bold text-base">添加新记录</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AddEditItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        itemToEdit={itemToEdit}
        defaultCategory={itemToEdit ? undefined : (filterCategory !== '全部' ? filterCategory as Category : undefined)}
      />
      <QuickAddItemModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
      />

      {/* 卡片悬浮分享 → 分享卡 */}
      {shareTarget && auth.currentUser && (
        <ShareCardModal
          target={{ kind: 'item', item: shareTarget }}
          shareUrl={buildItemShareUrl(auth.currentUser.publicId, shareTarget.id)}
          onClose={() => setShareTarget(null)}
        />
      )}

      {/* Best Match 解锁弹窗 */}
      {bmUnlockPopup && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm"
          onClick={() => setBmUnlockPopup(false)}
        >
          <div
            className="bg-kraft border border-dashed border-graphite/30 max-w-sm w-full px-7 py-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 border border-stamp/40 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-5 h-5 text-stamp" />
            </div>
            <p className="font-tag text-[10px] uppercase tracking-[0.3em] text-graphite/55 mb-2">Unlocked</p>
            <h3 className="text-2xl font-story font-bold text-ink mb-3">🎉 Best Match 解锁了！</h3>
            <p className="font-story text-sm text-graphite/75 leading-relaxed mb-7">
              你已经记录了 3 件单品。现在可以把心里那些「绝对没错」的搭配组合记下来了。
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => { setBmUnlockPopup(false); sfx.modalOpen(); navigate('/best-match'); }}
                className="w-full px-6 py-3 bg-stamp text-white font-tag text-[11px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                去建立第一套
              </button>
              <button
                onClick={() => setBmUnlockPopup(false)}
                className="w-full px-6 py-2.5 font-tag text-[10px] uppercase tracking-widest font-bold text-graphite hover:text-ink transition-colors"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
