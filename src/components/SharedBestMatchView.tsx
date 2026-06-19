import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BestMatch, BestMatchItems, BestMatchSlot, WardrobeItem } from '../types';
import { TagBundle } from './TagBundle';
import type { BundleEntry } from './TagBundle';
import { bundleEntriesFromMatch } from '../contexts/BestMatchContext';
import { fetchPublicWardrobe, SharingDisabledError, toDateSafe } from '../lib/publicWardrobe';
import { getTagTheme } from '../lib/tagThemes';
import { cn } from '../lib/utils';
import { Loader2, Lock, ArrowLeft, ArrowRight, GitBranch } from 'lucide-react';

type SlotKey = keyof BestMatchItems;
const SLOT_LABELS: { key: SlotKey; label: string }[] = [
  { key: 'tops', label: '上装' },
  { key: 'bottoms', label: '下装' },
  { key: 'shoes', label: '鞋子' },
  { key: 'accessories', label: '配饰' },
];

/** 公开接口返回的 items 是 Firestore 原样解码，可能是 v1 string[] 或 v2 对象 —— 统一成 v2。 */
function normalizeSlots(raw: unknown): BestMatchSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: BestMatchSlot[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      out.push({ primary: entry });
    } else if (entry && typeof entry === 'object' && typeof (entry as any).primary === 'string') {
      const variants = Array.isArray((entry as any).variants)
        ? ((entry as any).variants as unknown[]).filter((v): v is string => typeof v === 'string')
        : undefined;
      out.push(variants && variants.length > 0
        ? { primary: (entry as any).primary, variants }
        : { primary: (entry as any).primary });
    }
  }
  return out;
}

export function SharedBestMatchView() {
  const { userId, matchId } = useParams<{ userId: string; matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<BestMatch | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [tempError, setTempError] = useState(false);

  useEffect(() => {
    if (!matchId || !userId) return;
    // 走边缘缓存接口：一次拿到整柜，本地找出这套搭配 + 解析引用单品（0 次 Firestore 读）
    fetchPublicWardrobe(userId)
      .then(({ items, matches }) => {
        const m = matches.find((x) => x.id === matchId);
        if (!m) { setDenied(true); return; }
        // 归一化 slot 形状，保证下方明细列表对 v1/v2 数据都正确
        setMatch({
          ...m,
          items: {
            tops: normalizeSlots((m.items as any)?.tops),
            bottoms: normalizeSlots((m.items as any)?.bottoms),
            shoes: normalizeSlots((m.items as any)?.shoes),
            accessories: normalizeSlots((m.items as any)?.accessories),
          },
        });
        setItems(items);
      })
      .catch((e) => {
        if (e instanceof SharingDisabledError) setDenied(true);
        else setTempError(true);
      })
      .finally(() => setLoading(false));
  }, [matchId, userId]);

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    items.forEach((i) => m.set(i.id, i));
    return m;
  }, [items]);

  const entries = useMemo<BundleEntry[]>(
    () => (match ? bundleEntriesFromMatch(match, itemMap) : []),
    [match, itemMap]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (tempError) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Temporarily Unavailable</p>
          <p className="font-story text-ink/80 mb-2">暂时加载不出来</p>
          <p className="font-story text-graphite/55 text-sm mb-6">服务器有点忙，请稍后再刷新试试。</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 border border-graphite/30 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (denied || !match) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-10 h-10 text-graphite/25 mx-auto mb-5" />
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Not Available</p>
          <p className="font-story text-graphite/60">此搭配未公开或已删除</p>
        </div>
      </div>
    );
  }

  const created = toDateSafe(match.createdAt);
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

  const openItem = (id: string) => navigate(`/share/${userId}/item/${id}`);

  return (
    <div className="min-h-screen bg-kraft text-ink font-sans selection:bg-stamp selection:text-white">
      <header className="sticky top-0 z-40 bg-kraft/90 backdrop-blur-md border-b border-dashed border-graphite/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-tag font-bold text-ink" style={{ fontSize: '1.05rem', letterSpacing: '0.06em' }}>
              衣LOG
            </h1>
            <span className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/50 border border-dashed border-graphite/25 px-2 py-0.5">
              Best Match · 只读
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 返回 Best Match 列表 */}
        <Link
          to={`/share/${userId}`}
          state={{ view: 'matches' }}
          className="inline-flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors mb-8"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Best Match</span>
        </Link>

        <div className="flex flex-col items-center">
          {entries.length > 0 ? (
            <TagBundle
              entries={entries}
              size="detail"
              variant="strung"
              onItemClick={(it) => openItem(it.id)}
            />
          ) : match.photoBase64 ? (
            <div className="border border-graphite/20 p-2 bg-white/40 max-w-[280px]">
              <img src={match.photoBase64} alt={match.name || 'outfit'} className="w-full" loading="lazy" />
            </div>
          ) : (
            <p className="font-story italic text-graphite/50 py-16">搭配里的衣物已被删除</p>
          )}

          {match.name && (
            <h2
              className="text-center text-ink mt-6 leading-tight"
              style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '2rem' }}
            >
              {match.name}
            </h2>
          )}

          {(match.sceneTags?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {match.sceneTags!.map((tag) => (
                <span key={tag} className="px-3 py-1 font-tag text-[11px] uppercase tracking-wider text-ink border border-ink/30 bg-ink/5">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {match.story && (
            <p className="font-story text-[15px] leading-[1.9] text-ink/85 mt-5 whitespace-pre-wrap text-center max-w-md">
              {match.story}
            </p>
          )}

          {/* 整套 Look 照片（明细之外的实拍图，bundle 存在时也展示） */}
          {entries.length > 0 && match.photoBase64 && (
            <div className="border border-graphite/20 p-2 bg-white/40 max-w-[240px] mt-8">
              <img
                src={match.photoBase64}
                alt="outfit"
                className="w-full"
                style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
                loading="lazy"
              />
              <div className="mt-2 px-1">
                <span className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50">Polaroid</span>
              </div>
            </div>
          )}
        </div>

        {/* 构成单品明细（与主人视角一致，点击进单品深链） */}
        <div className="mt-10 pt-2">
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
                      const allIds = [slot.primary, ...(slot.variants ?? [])];
                      return (
                        <div key={slot.primary} className="space-y-0.5">
                          {allIds.map((itemId, itemIdx) => {
                            const item = itemMap.get(itemId);
                            const isPrimary = itemIdx === 0;
                            if (!item) return (
                              <p key={itemId} className="font-story italic text-xs text-graphite/40 px-2">
                                {isPrimary ? '已删除的衣物' : '已删除的变体'}
                              </p>
                            );
                            const theme = getTagTheme(item.id);
                            return (
                              <button
                                key={itemId}
                                onClick={() => openItem(item.id)}
                                className="group w-full flex items-center gap-2 px-2 py-1 -mx-2 text-left hover:bg-tag/40 transition-colors"
                              >
                                <div className="w-1 h-7 shrink-0" style={{ backgroundColor: theme.accentColor }} />
                                {!isPrimary && <GitBranch className="w-3 h-3 text-graphite/40 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "font-story text-sm truncate group-hover:text-stamp transition-colors",
                                    isPrimary ? "font-semibold text-ink" : "text-ink/70"
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
        </div>

        {/* COMPOSITION（与主人视角一致的洗标式统计） */}
        <div
          className="px-5 py-4 mt-6"
          style={{
            background: 'rgba(0,0,0,0.04)',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: 'rgba(0,0,0,0.10)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-px bg-graphite/60" />
            <span className="font-tag text-[7px] tracking-[0.3em] font-bold text-graphite/60">COMPOSITION</span>
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
        </div>

        <Link
          to={`/share/${userId}`}
          className="mt-10 w-full flex items-center justify-center gap-2 px-5 py-3 border border-graphite/25 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider"
        >
          查看完整衣柜
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </main>
    </div>
  );
}
