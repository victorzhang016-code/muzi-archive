import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, deleteDoc, doc, writeBatch, getDocs, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WardrobeItem, Category, Season } from '../types';
import { WardrobeItemCard } from './WardrobeItemCard';
import { AddEditItemModal } from './AddEditItemModal';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { Plus, Loader2, Database, ArrowUpDown, Trash2, Share2, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { SEED_DATA } from '../data/seedData';
import { useWardrobe } from '../contexts/WardrobeContext';
import { sfx } from '../lib/sounds';

const CATEGORIES: ('全部' | Category)[] = ['全部', '上装', '下装', '鞋子', '配饰'];

function normalizeBrand(b: string): string {
  return b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function extractBrands(raw: string): string[] {
  return raw.split(/\s+[xX×]\s+/).map(normalizeBrand).filter(Boolean);
}

export function WardrobeList() {
  const { items, loading } = useWardrobe();
  const scrollYRef = useRef(0);
  const [filterCategory, setFilterCategory] = useState<'全部' | Category>('全部');
  const [filterBrand, setFilterBrand] = useState<string | null>(null);
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);
  const [brandStatsOpen, setBrandStatsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<WardrobeItem | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [splitSpringAutumn, setSplitSpringAutumn] = useState(false);
  const [subFilterSeason, setSubFilterSeason] = useState<'全部' | Season>('全部');
  const [subFilterLength, setSubFilterLength] = useState<'全部' | '长裤' | '短裤'>('全部');
  const [sortOrder, setSortOrder] = useState<'default' | 'ratingDesc' | 'ratingAsc' | 'yearDesc' | 'yearAsc'>('default');
  const [filterYear, setFilterYear] = useState<number | '全部'>('全部');
  const [shareEnabled, setShareEnabled] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const shareUrl = auth.currentUser ? `${window.location.origin}/share/${auth.currentUser.uid}` : '';

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'wardrobe_users', auth.currentUser.uid)).then(snap => {
      if (snap.exists()) setShareEnabled(snap.data().shareEnabled === true);
    });
  }, []);

  const toggleShare = async () => {
    if (!auth.currentUser) return;
    const newVal = !shareEnabled;
    await setDoc(doc(db, 'wardrobe_users', auth.currentUser.uid), { shareEnabled: newVal }, { merge: true });
    setShareEnabled(newVal);
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  };

  useEffect(() => {
    setSubFilterSeason('全部');
    setSubFilterLength('全部');
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
      await deleteDoc(doc(db, 'wardrobe_items', item.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `wardrobe_items/${item.id}`);
    }
  };

  const handleEdit = (item: WardrobeItem) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
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

      if (file.name.endsWith('.json')) {
        const text = await file.text();
        parsedData = JSON.parse(text);
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.trim());
          parsedData = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((header, i) => {
              obj[header] = values[i];
            });
            return obj;
          });
        }
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.pdf')) {
        let fileText: string;

        let requestBody: object;

        if (file.name.endsWith('.pdf')) {
          const { extractText, getDocumentProxy } = await import('unpdf');
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
          const { text } = await extractText(pdf, { mergePages: true });
          if (!text || !text.trim()) {
            throw new Error('PDF 文字提取失败：可能是图片型扫描件，请改用 TXT 或 JSON');
          }
          fileText = text;
        } else {
          fileText = await file.text();
        }
        requestBody = {
          messages: [{ role: 'user', content: [{ type: 'text', text: `从以下文档中提取衣物信息，以 JSON 数组返回，每个对象包含：name（字符串）、brand（品牌名，字符串，可选）、rating（1-10的数字）、category（"上装"/"下装"/"鞋子"/"配饰" 之一）、season（"春季"/"秋季"/"春秋"/"夏季"/"冬季"/"四季" 之一）、story（描述或故事）。注意：输出必须是合法的 JSON 格式，严禁在对象末尾添加多余逗号，严禁添加任何 Markdown 标签，直接以 '[' 开始输出。\n\n${fileText}` }] }],
        };

        const aiRes = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!aiRes.ok) {
          const errBody = await aiRes.text();
          throw new Error(`AI 解析失败: ${aiRes.status} — ${errBody.slice(0, 300)}`);
        }
        const aiData = await aiRes.json();
        const rawText = aiData.content?.[0]?.text ?? '';
        if (!rawText) throw new Error(`AI 返回空内容: ${JSON.stringify(aiData).slice(0, 200)}`);
        let jsonStr = '';
        const fullMatch = rawText.match(/\[[\s\S]*\]/);
        if (fullMatch) {
          jsonStr = fullMatch[0];
        } else {
          // 兜底：返回被截断了，找到最后一个完整对象后手动闭合
          const startIdx = rawText.indexOf('[');
          if (startIdx === -1) throw new Error(`AI 未返回 JSON。原始返回（前 600 字）：${rawText.slice(0, 600)}`);
          const partial = rawText.slice(startIdx);
          const lastObjEnd = partial.lastIndexOf('},');
          if (lastObjEnd === -1) throw new Error(`AI 返回内容无完整对象。原始返回（前 600 字）：${rawText.slice(0, 600)}`);
          jsonStr = partial.slice(0, lastObjEnd + 1) + ']';
        }
        const cleanJson = jsonStr.replace(/,\s*([}\]])/g, '$1');
        parsedData = JSON.parse(cleanJson);
      } else {
        alert('不支持的文件格式，请上传 JSON, CSV, TXT 或 PDF 文件。');
        return;
      }

      if (!Array.isArray(parsedData)) {
        alert('文件内容格式不正确，期望是一个数组。');
        return;
      }

      const itemsRef = collection(db, 'wardrobe_items');
      const userId = auth.currentUser.uid;

      const validItems = parsedData.filter(item => item.name && item.category);

      if (validItems.length === 0) {
        alert(`没有有效数据。parsedData 前两项：${JSON.stringify(parsedData.slice(0, 2))}`);
        return;
      }

      const BATCH_SIZE = 400;
      let totalCount = 0;

      for (let batchStart = 0; batchStart < validItems.length; batchStart += BATCH_SIZE) {
        const chunk = validItems.slice(batchStart, batchStart + BATCH_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((item, i) => {
          const newDocRef = doc(itemsRef);
          const itemData: Record<string, any> = {
            name: item.name,
            ...(item.brand ? { brand: item.brand } : {}),
            rating: Number(item.rating) || 5,
            category: item.category,
            season: item.season || '四季',
            story: item.story || '',
            userId,
            orderIndex: items.length + batchStart + i,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          if (item.imageUrl) itemData.imageUrl = item.imageUrl;
          batch.set(newDocRef, itemData);
        });

        await batch.commit();
        totalCount += chunk.length;
      }

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

  const mappedItems = items.map(item => {
    let displaySeason = item.season;
    if (!splitSpringAutumn) {
      if (displaySeason === '春季' || displaySeason === '秋季') {
        displaySeason = '春秋';
      }
    }
    return { ...item, displaySeason };
  });

  const filteredItems = mappedItems.filter(item => {
    if (filterCategory !== '全部' && item.category !== filterCategory) return false;

    if (filterCategory === '上装' && subFilterSeason !== '全部') {
      if (item.displaySeason !== subFilterSeason) return false;
    }

    if (filterCategory === '下装' && subFilterLength !== '全部') {
      if (subFilterLength === '短裤' && item.length !== '短裤') return false;
      if (subFilterLength === '长裤' && item.length !== '长裤') return false;
    }

    if (filterYear !== '全部' && item.purchaseYear !== filterYear) return false;

    if (filterBrand !== null) {
      if (!item.brand || !extractBrands(item.brand).includes(filterBrand)) return false;
    }

    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortOrder === 'ratingDesc') return b.rating - a.rating;
    if (sortOrder === 'ratingAsc') return a.rating - b.rating;
    if (sortOrder === 'yearDesc') return (b.purchaseYear ?? 0) - (a.purchaseYear ?? 0);
    if (sortOrder === 'yearAsc') return (a.purchaseYear ?? 9999) - (b.purchaseYear ?? 9999);

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
      if (subFilterSeason !== '全部') {
        return `${subFilterSeason}${filterCategory}，一共 ${n} 件`;
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
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-5">
        <div className="border-b border-dashed border-graphite/25 pb-5">
          <p className="font-tag text-[10px] uppercase tracking-[0.3em] text-graphite/55 mb-2">
            D-Tag Archive · {items.length} Items
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2
                className="text-[3.5rem] leading-none text-ink"
                style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.04em' }}
              >
                Archive
              </h2>
              <p className="font-story text-[14px] text-graphite/70 mt-2 italic" style={{ letterSpacing: '0.02em' }}>
                记录独属于你和衣服的故事
              </p>
            </div>
            {/* Controls: spring toggle + sort */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { sfx.toggle(); setSplitSpringAutumn(!splitSpringAutumn); }}
                className={cn(
                  "px-3 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border transition-all",
                  splitSpringAutumn
                    ? "bg-stamp text-white border-stamp"
                    : "bg-tag/70 text-ink/70 border-graphite/30 hover:border-graphite/60 hover:text-ink"
                )}
              >
                {splitSpringAutumn ? '已拆分春秋' : '合并春秋'}
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-tag/70 border border-graphite/30">
                <ArrowUpDown className="w-3.5 h-3.5 text-graphite/60 shrink-0" />
                <select
                  value={sortOrder}
                  onChange={(e) => { sfx.toggle(); setSortOrder(e.target.value as any); }}
                  className="bg-transparent font-tag text-[11px] uppercase tracking-wider text-ink/75 outline-none cursor-pointer hover:text-ink transition-colors"
                >
                  <option value="default">默认排序</option>
                  <option value="ratingDesc">评分 ↓</option>
                  <option value="ratingAsc">评分 ↑</option>
                  <option value="yearDesc">年份 ↓</option>
                  <option value="yearAsc">年份 ↑</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          {/* Mobile-only primary action */}
          <button
            onClick={() => { sfx.modalOpen(); openAddModal(); }}
            className="sm:hidden w-full flex items-center justify-center gap-2 px-5 py-3 bg-ink text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-ink/85 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>添加衣物</span>
          </button>
          <div className="flex items-center gap-0 overflow-x-auto hide-scrollbar bg-tag border border-graphite/20 shadow-sm">
            <button
              onClick={toggleShare}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 font-tag text-[12px] uppercase tracking-wider font-semibold transition-colors whitespace-nowrap border-r border-graphite/15",
                shareEnabled
                  ? "text-stamp hover:bg-stamp/8"
                  : "text-ink/65 hover:text-ink hover:bg-graphite/5"
              )}
            >
              <Share2 className="w-4 h-4" />
              <span>{shareEnabled ? '关闭分享' : '分享'}</span>
            </button>
            <button
              onClick={async () => {
                if (!auth.currentUser) return;
                setIsSeeding(true);
                try {
                  const q = query(collection(db, 'wardrobe_items'), where('userId', '==', auth.currentUser.uid));
                  const snapshot = await getDocs(q);
                  const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WardrobeItem));

                  const nameGroups = new Map<string, WardrobeItem[]>();
                  allItems.forEach(item => {
                    const group = nameGroups.get(item.name) || [];
                    group.push(item);
                    nameGroups.set(item.name, group);
                  });

                  const batch = writeBatch(db);
                  let deleteCount = 0;

                  nameGroups.forEach(group => {
                    if (group.length > 1) {
                      group.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis() || 0;
                        const timeB = b.createdAt?.toMillis() || 0;
                        return timeA - timeB;
                      });
                      for (let i = 1; i < group.length; i++) {
                        batch.delete(doc(db, 'wardrobe_items', group[i].id));
                        deleteCount++;
                      }
                    }
                  });

                  if (deleteCount > 0) {
                    await batch.commit();
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
              className="flex items-center gap-2 px-4 py-2.5 font-tag text-[12px] uppercase tracking-wider font-semibold text-stamp hover:bg-stamp/8 transition-colors whitespace-nowrap disabled:opacity-40 border-r border-graphite/15"
            >
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>清理重复</span>
            </button>

            <div className="relative">
              <input
                type="file"
                accept=".json,.csv,.txt,.pdf"
                onChange={handleFileUpload}
                disabled={isSeeding}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                title="支持格式: JSON, CSV, TXT, PDF"
              />
              <button
                disabled={isSeeding}
                className="flex items-center gap-2 px-4 py-2.5 font-tag text-[12px] uppercase tracking-wider font-semibold text-ink/65 hover:text-ink hover:bg-graphite/5 transition-colors whitespace-nowrap disabled:opacity-40 border-r border-graphite/15"
              >
                {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>导入数据</span>
              </button>
            </div>

            <button
              onClick={() => { sfx.modalOpen(); openAddModal(); }}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-ink text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-ink/85 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>添加衣物</span>
            </button>
          </div>

          {shareEnabled && (
            <div className="flex items-center gap-2 bg-tag border border-graphite/20 px-3 py-2 max-w-full">
              <span className="font-tag text-[9px] uppercase tracking-[0.15em] text-graphite/50 shrink-0">Link</span>
              <span className="font-tag text-[10px] text-ink/70 truncate">{shareUrl}</span>
              <button
                onClick={copyShareUrl}
                className="shrink-0 p-1 text-graphite hover:text-ink transition-colors"
                title="复制链接"
              >
                {copyDone ? <Check className="w-3.5 h-3.5 text-stamp" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
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

        {/* Sub-filters */}
        {filterCategory === '上装' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 shrink-0 mr-1">Season</span>
            {['全部', ...(splitSpringAutumn ? ['春秋', '春季', '秋季'] : ['春秋']), '夏季', '冬季', '四季'].map(season => (
              <button
                key={season}
                onClick={() => { sfx.filterClick(); setSubFilterSeason(season as any); }}
                className={cn(
                  "px-3.5 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap",
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

        {filterCategory === '下装' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 shrink-0 mr-1">Length</span>
            {['全部', '长裤', '短裤'].map(length => (
              <button
                key={length}
                onClick={() => { sfx.filterClick(); setSubFilterLength(length as any); }}
                className={cn(
                  "px-3.5 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap",
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
        {availableYears.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-tag text-[10px] uppercase tracking-widest text-graphite/50 shrink-0 mr-1">Year</span>
            {(['全部', ...availableYears] as (number | '全部')[]).map(y => (
              <button
                key={y}
                onClick={() => { sfx.filterClick(); setFilterYear(y); }}
                className={cn(
                  "px-3.5 py-1.5 font-tag text-[11px] tracking-wider font-semibold border transition-all whitespace-nowrap",
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
        {brandIndex.length > 0 && (
          <div className="flex flex-col gap-2">
            {/* 标题行：Brand 标签 + 展开箭头 + 当前选中品牌（如有） */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setBrandFilterOpen(v => !v)}
                className="flex items-center gap-1.5 font-tag text-[10px] uppercase tracking-widest text-graphite/50 hover:text-ink transition-colors shrink-0"
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
                    className="px-3.5 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border bg-ink/10 text-ink border-ink/30 flex items-center gap-1.5"
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
                    className="px-3.5 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border bg-ink/10 text-ink border-ink/30"
                  >
                    全部
                  </button>
                )}
                {brandIndex.map(({ key, display, count }) => (
                  <button
                    key={key}
                    onClick={() => { sfx.filterClick(); setFilterBrand(filterBrand === key ? null : key); }}
                    className={cn(
                      "px-3.5 py-1.5 font-tag text-[11px] uppercase tracking-wider font-semibold border transition-all whitespace-nowrap",
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
              className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-widest text-graphite/50 hover:text-ink transition-colors"
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
        {sortedItems.length === 0 ? (
          <div className="text-center py-32">
            <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/35 mb-6">— No Tags —</p>
            <h3 className="text-2xl font-story font-bold text-ink mb-4">Archive Empty</h3>
            <p className="text-graphite mb-8 font-story">开始记录你的第一件衣物故事吧</p>
            <button
              onClick={openAddModal}
              className="px-8 py-3 bg-ink text-white font-tag text-[10px] uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              添加衣物
            </button>
          </div>
        ) : (
          <div className="masonry-grid pt-4">
            {sortedItems.map((item, i) => (
              <WardrobeItemCard
                key={item.id}
                item={{...item, season: item.displaySeason as Season}}
                index={i}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}

            {/* Add New Tag */}
            <div
              className="cursor-pointer"
              onClick={openAddModal}
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
    </div>
  );
}
