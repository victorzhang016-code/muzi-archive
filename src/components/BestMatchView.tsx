import { useMemo, useState, ReactNode } from 'react';
import { motion } from 'motion/react';
import { GitBranch } from 'lucide-react';
import { BestMatch, BestMatchItems, WardrobeItem } from '../types';
import { TagBundle } from './TagBundle';
import type { BundleEntry } from './TagBundle';
import { getTagTheme } from '../lib/tagThemes';
import { toDateSafe } from '../lib/publicWardrobe';
import { sfx } from '../lib/sounds';
import { cn } from '../lib/utils';

/**
 * Best Match 详情的「唯一布局」——主人（BestMatchDetail）和访客（SharedBestMatchView）共用，
 * 杜绝两套 JSX 漂移导致访客视角和主人不一致。差异部分用 slot/prop 注入：
 *  - backSlot：返回控件（主人=动画关闭按钮，访客=回分享页的 Link）
 *  - actionsSlot：右上操作（主人=分享/编辑/删除，访客=无）
 *  - photoSlot：照片区域（主人=可换图，访客=只读图或无）
 *  - onItemClick：点单品的去向（主人=/item/:id，访客=/share/:uid/item/:id）
 * 变体切换 / 吊牌串 / 明细 / COMPOSITION 全在这里实现，两边完全一致。
 */

type SlotKey = keyof BestMatchItems;
const SLOT_LABELS: { key: SlotKey; label: string }[] = [
  { key: 'tops', label: '上装' },
  { key: 'bottoms', label: '下装' },
  { key: 'shoes', label: '鞋子' },
  { key: 'accessories', label: '配饰' },
];

const childVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

interface Props {
  match: BestMatch;
  itemMap: Map<string, WardrobeItem>;
  onItemClick: (itemId: string) => void;
  backSlot: ReactNode;
  actionsSlot?: ReactNode;
  /** 照片区域内容（已在外层包了 motion 子项，传入纯内容即可）；无照片传 null 即不渲染该块 */
  photoSlot?: ReactNode;
  /** 主人关闭动画用：收起吊牌串 */
  bundleCollapsed?: boolean;
  animateIn?: boolean;
}

export function BestMatchView({
  match,
  itemMap,
  onItemClick,
  backSlot,
  actionsSlot,
  photoSlot,
  bundleCollapsed = false,
  animateIn = true,
}: Props) {
  // 变体切换状态：切换会同时影响明细高亮与吊牌串展示（与主人视角一致）
  const [slotDisplay, setSlotDisplay] = useState<Record<string, string>>({});

  const entries = useMemo<BundleEntry[]>(() => {
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

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Top nav — full width */}
      <div className="flex items-center justify-between mb-6">
        {backSlot}
        {actionsSlot ? <div className="flex items-center gap-2">{actionsSlot}</div> : <div />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr] gap-8 lg:gap-10 items-start">
        {/* LEFT — sticky on desktop */}
        <aside className="lg:sticky lg:top-24">
          <div className="lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4 hide-scrollbar">
            {entries.length > 0 ? (
              <div className="flex lg:justify-start justify-center">
                <TagBundle
                  entries={entries}
                  size="detail"
                  variant="strung"
                  animateIn={animateIn}
                  collapsed={bundleCollapsed}
                  onItemClick={(it) => { sfx.cardClick(); onItemClick(it.id); }}
                />
              </div>
            ) : (
              <p className="font-story italic text-graphite/50 py-16 text-center">
                搭配里的衣物已被删除
              </p>
            )}
          </div>
        </aside>

        {/* RIGHT — stagger fade-in */}
        <motion.div
          className="space-y-6"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } } }}
        >
          {/* Name */}
          {match.name && (
            <motion.div variants={childVariants}>
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
            <motion.div className="flex flex-wrap gap-2" variants={childVariants}>
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
            <motion.div variants={childVariants}>
              <div className="w-6 h-[1.5px] mb-3 bg-stamp/60" />
              <p className="font-story text-[15px] leading-[1.9] text-ink/85 whitespace-pre-wrap">
                {match.story}
              </p>
            </motion.div>
          )}

          {/* Photo (injected — owner editable / public read-only / none) */}
          {photoSlot && <motion.div variants={childVariants}>{photoSlot}</motion.div>}

          {/* Constituent list */}
          <motion.div className="pt-3" variants={childVariants}>
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
                          setSlotDisplay((prev) => ({ ...prev, [slot.primary]: targetId }));
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
                                  {hasVariants && (
                                    <button
                                      onClick={() => switchTo(itemId)}
                                      title={isActive ? '当前展示中' : '切换到此版本'}
                                      className="shrink-0 w-4 h-4 flex items-center justify-center transition-colors"
                                    >
                                      <div className={cn(
                                        "rounded-full transition-all",
                                        isActive ? "w-2.5 h-2.5 border-2" : "w-2 h-2 border opacity-35 hover:opacity-70"
                                      )}
                                        style={{ borderColor: isActive ? theme.accentColor : undefined }}
                                      />
                                    </button>
                                  )}
                                  {!hasVariants && (
                                    <div className="w-1 h-7 shrink-0" style={{ backgroundColor: theme.accentColor }} />
                                  )}

                                  <button
                                    onClick={() => { sfx.cardClick(); onItemClick(item.id); }}
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
            variants={childVariants}
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
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
