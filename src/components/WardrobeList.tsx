import { useState, useEffect } from 'react';
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

export function WardrobeList() {
  const { items, loading } = useWardrobe();
  const [filterCategory, setFilterCategory] = useState<'全部' | Category>('全部');
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

  // Collect available years from items
  const availableYears = Array.from(
    new Set(items.map(i => i.purchaseYear).filter((y): y is number => !!y))
  ).sort((a, b) => b - a);

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

        if (file.name.endsWith('.pdf')) {
          const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
          GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await getDocument({ data: arrayBuffer }).promise;
          const pages = await Promise.all(
            Array.from({ length: pdf.numPages }, (_, i) =>
              pdf.getPage(i + 1).then(p => p.getTextContent()).then(c => c.items.map((it: any) => it.str).join(' '))
            )
          );
          fileText = pages.join('\n');
        } else {
          fileText = await file.text();
        }

        const messageContent = [{
          type: 'text',
          text: `从以下文档中提取衣物信息，以 JSON 数组返回，每个对象包含：name（字符串）、rating（1-10的数字）、category（"上装"/"下装"/"鞋子"/"配饰" 之一）、season（"春季"/"秋季"/"春秋"/"夏季"/"冬季"/"四季" 之一）、story（描述或故事）。只返回 JSON 数组，不要其他内容。\n\n${fileText}`
        }];

        const aiRes = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5',
            max_tokens: 4096,
            messages: [{ role: 'user', content: messageContent }],
          }),
        });
        if (!aiRes.ok) throw new Error(`AI 解析失败: ${aiRes.status}`);
        const aiData = await aiRes.json();
        const rawText = aiData.content?.[0]?.text ?? '';
        if (!rawText) throw new Error(`AI 回包异常: ${JSON.stringify(aiData).slice(0, 300)}`);
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
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
        alert('文件中没有找到有效的数据（每条记录需要 name 和 category 字段）。');
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
      const isShorts = item.name.includes('短裤');
      if (subFilterLength === '短裤' && !isShorts) return false;
      if (subFilterLength === '长裤' && isShorts) return false;
    }

    if (filterYear !== '全部' && item.purchaseYear !== filterYear) return false;

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
        <div className="flex flex-col items-end gap-2">
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
              className="flex items-center gap-2 px-5 py-2.5 bg-ink text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-ink/85 transition-colors whitespace-nowrap"
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
      </div>

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
      />
    </div>
  );
}
