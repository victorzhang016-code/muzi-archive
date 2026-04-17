import { useMemo } from 'react';
import type { WardrobeItem } from '../types';
import { getTagTheme, hashId } from '../lib/tagThemes';

type BundleSize = 'mini' | 'detail';
type BundleVariant = 'stacked' | 'strung';

/** A single hung tag in the bundle. May represent a slot with variants. */
export interface BundleEntry {
  item: WardrobeItem;
  /** how many alternate variants this slot has — drawn as a small badge */
  variantCount?: number;
}

interface MiniTagProps {
  entry: BundleEntry;
  width: number;
  height: number;
  rotation: number;
  lateralOffset: number;
  size: BundleSize;
  onClick?: (item: WardrobeItem) => void;
}

function MiniTag({ entry, width, height, rotation, lateralOffset, size, onClick }: MiniTagProps) {
  const { item, variantCount } = entry;
  const theme = getTagTheme(item.id);
  const isDetail = size === 'detail';
  const interactive = !!onClick;

  return (
    <div
      className={`relative shrink-0 ${interactive ? 'cursor-pointer' : ''}`}
      style={{
        width,
        height,
        transform: `translateX(${lateralOffset}px) rotate(${rotation}deg)`,
        transformOrigin: 'top center',
      }}
      onClick={interactive ? (e) => { e.stopPropagation(); onClick!(item); } : undefined}
    >
      <div
        className="relative w-full h-full overflow-hidden tag-shadow"
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
        {/* Texture */}
        {theme.texture !== 'none' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: theme.texture,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.3,
              mixBlendMode: 'multiply',
              zIndex: 0,
            }}
          />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: theme.overlayColor, zIndex: 1 }}
        />

        {/* Punch hole at top center (anchors the string) */}
        <div
          className="tag-hole absolute left-1/2 -translate-x-1/2"
          style={{
            top: isDetail ? 10 : 7,
            backgroundColor: theme.holeColor,
            zIndex: 5,
          }}
        />

        {/* ID strip */}
        <div className="relative z-10 flex items-start justify-between px-2.5 pt-2">
          <span
            className="font-tag uppercase leading-none"
            style={{
              color: theme.textMuted,
              fontSize: isDetail ? 7 : 6,
              letterSpacing: '0.1em',
            }}
          >
            {item.id.slice(-5).toUpperCase()}
          </span>
          <span
            className="font-tag uppercase leading-none"
            style={{
              color: theme.textMuted,
              fontSize: isDetail ? 7 : 6,
              letterSpacing: '0.1em',
            }}
          >
            {item.category}
          </span>
        </div>

        {/* Image or placeholder */}
        <div
          className="relative z-10 mx-2"
          style={{ marginTop: isDetail ? 16 : 12 }}
        >
          <div
            className="w-full overflow-hidden"
            style={{
              aspectRatio: '3 / 4',
              background: theme.isLight ? '#EDE9E0' : 'rgba(255,255,255,0.05)',
              boxShadow: theme.isLight
                ? 'inset 0 0 0 1px rgba(0,0,0,0.06)'
                : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
            }}
          >
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span
                  className="font-tag uppercase"
                  style={{
                    color: theme.textMuted,
                    fontSize: isDetail ? 8 : 7,
                    letterSpacing: '0.3em',
                    writingMode: 'vertical-rl',
                    textOrientation: 'upright',
                  }}
                >
                  NO IMG
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Name — now bigger and bolder so it's the dominant tag element */}
        <div
          className="relative z-10 px-2.5"
          style={{ marginTop: isDetail ? 10 : 7 }}
        >
          <p
            className="font-story font-bold leading-tight line-clamp-2"
            style={{
              color: theme.textPrimary,
              fontSize: isDetail ? 14 : 11.5,
              letterSpacing: '-0.005em',
            }}
          >
            {item.name || '未命名'}
          </p>
          {item.brand && (
            <p
              className="font-tag uppercase mt-1 truncate"
              style={{
                color: theme.textMuted,
                fontSize: isDetail ? 7 : 6,
                letterSpacing: '0.15em',
              }}
            >
              {item.brand}
            </p>
          )}
        </div>

        {/* Variant badge — bottom-right corner */}
        {variantCount && variantCount > 0 && (
          <div
            className="absolute z-20 flex items-center gap-0.5 px-1.5 py-0.5 font-tag font-bold"
            style={{
              bottom: 6,
              right: 6,
              fontSize: isDetail ? 9 : 8,
              letterSpacing: '0.05em',
              backgroundColor: theme.accentColor,
              color: theme.isLight ? '#FFFFFF' : '#1A1A1A',
              boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
            }}
            title={`${variantCount} 个变体`}
          >
            +{variantCount}
          </div>
        )}
      </div>
    </div>
  );
}

interface TagBundleProps {
  entries: BundleEntry[];
  size?: BundleSize;
  variant?: BundleVariant;
  className?: string;
  /** When provided, every tag becomes clickable and routes to that item. */
  onItemClick?: (item: WardrobeItem) => void;
}

const DIMS: Record<BundleSize, {
  tagWidth: number;
  tagHeight: number;
  gap: number;
  lateralRange: number;
  rotationRange: number;
  holeInset: number;
  hookTopPadding: number;
  peek: number;
  stackRotationRange: number;
}> = {
  mini: {
    tagWidth: 124,
    tagHeight: 168,
    gap: 14,
    lateralRange: 10,
    rotationRange: 2.5,
    holeInset: 7,
    hookTopPadding: 26,
    peek: 28,
    stackRotationRange: 1.5,
  },
  detail: {
    tagWidth: 200,
    tagHeight: 264,
    gap: 18,
    lateralRange: 14,
    rotationRange: 3,
    holeInset: 10,
    hookTopPadding: 36,
    peek: 42,
    stackRotationRange: 2,
  },
};

function pseudoRandom(id: string, range: number, salt = 0): number {
  const h = hashId(id);
  const norm = ((h >> (salt * 3)) % 1000) / 1000;
  return (norm * 2 - 1) * range;
}

/**
 * 吊牌串 —
 *  - `stacked` (默认 mini)：一叠吊牌，第一张在最上面（前）盖住下面的，后面的只露出顶部 peek px
 *  - `strung` (默认 detail)：几个吊牌用手绘感棉线连接起来，像挂在衣架上的样品串
 * Slots with variants get a "+N" badge.
 */
export function TagBundle({
  entries,
  size = 'mini',
  variant,
  className,
  onItemClick,
}: TagBundleProps) {
  const dims = DIMS[size];
  const resolvedVariant: BundleVariant = variant ?? (size === 'mini' ? 'stacked' : 'strung');

  if (entries.length === 0) {
    return (
      <div className={className} style={{ height: dims.tagHeight + dims.hookTopPadding }}>
        <p className="text-center font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/50 mt-6">
          Empty bundle
        </p>
      </div>
    );
  }

  if (resolvedVariant === 'stacked') {
    return <StackedBundle entries={entries} size={size} dims={dims} className={className} onItemClick={onItemClick} />;
  }

  return <StrungBundle entries={entries} size={size} dims={dims} className={className} onItemClick={onItemClick} />;
}

interface VariantProps {
  entries: BundleEntry[];
  size: BundleSize;
  dims: (typeof DIMS)[BundleSize];
  className?: string;
  onItemClick?: (item: WardrobeItem) => void;
}

/**
 * 叠起来的吊牌——像一摞样品卡。第一张完全露出（在前），后面每张向上偏移 peek px 露出顶端一条。
 * 不画棉线/挂钩。左对齐（转换发生在 gallery 容器）。
 */
function StackedBundle({ entries, size, dims, className, onItemClick }: VariantProps) {
  const layout = useMemo(() => {
    const n = entries.length;
    const placements = entries.map((entry, idx) => {
      const rotation = pseudoRandom(entry.item.id, dims.stackRotationRange, idx + 3);
      const top = (n - 1 - idx) * dims.peek;
      const zIndex = 100 + (n - idx);
      return { entry, rotation, top, zIndex };
    });
    const containerWidth = dims.tagWidth + 10;
    const containerHeight = (n - 1) * dims.peek + dims.tagHeight + 6;
    return { placements, containerWidth, containerHeight };
  }, [entries, dims]);

  return (
    <div
      className={`relative ${className ?? ''}`}
      style={{ width: layout.containerWidth, height: layout.containerHeight }}
    >
      {layout.placements.map((p) => (
        <div
          key={p.entry.item.id}
          className="absolute left-0"
          style={{ top: p.top, zIndex: p.zIndex }}
        >
          <MiniTag
            entry={p.entry}
            width={dims.tagWidth}
            height={dims.tagHeight}
            rotation={p.rotation}
            lateralOffset={0}
            size={size}
            onClick={onItemClick}
          />
        </div>
      ))}
    </div>
  );
}

function StrungBundle({ entries, size, dims, className, onItemClick }: VariantProps) {
  const layout = useMemo(() => {
    const perTagPlacement = entries.map((entry, idx) => {
      const lateralOffset = pseudoRandom(entry.item.id, dims.lateralRange, idx);
      const rotation = pseudoRandom(entry.item.id, dims.rotationRange, idx + 1);
      const tagTop = dims.hookTopPadding + idx * (dims.tagHeight + dims.gap);
      return { entry, lateralOffset, rotation, tagTop };
    });

    const containerWidth = dims.tagWidth + dims.lateralRange * 2 + 20;
    const lastPlacement = perTagPlacement[perTagPlacement.length - 1];
    const containerHeight = lastPlacement.tagTop + dims.tagHeight + 10;

    const hookX = containerWidth / 2;
    const hookY = 6;

    const holes = perTagPlacement.map((p) => ({
      x: containerWidth / 2 + p.lateralOffset,
      y: p.tagTop + dims.holeInset,
    }));

    let path = `M ${hookX.toFixed(2)} ${hookY.toFixed(2)}`;
    let prev = { x: hookX, y: hookY };
    holes.forEach((hole, i) => {
      const midX = (prev.x + hole.x) / 2;
      const midY = (prev.y + hole.y) / 2;
      const wobble = pseudoRandom(entries[i].item.id, 8, i + 2);
      const ctrlX = midX + wobble;
      const ctrlY = midY;
      path += ` Q ${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${hole.x.toFixed(2)} ${hole.y.toFixed(2)}`;
      prev = hole;
    });

    return { perTagPlacement, containerWidth, containerHeight, hookX, hookY, path };
  }, [entries, dims]);

  return (
    <div
      className={`relative ${className ?? ''}`}
      style={{
        width: layout.containerWidth,
        height: layout.containerHeight,
        margin: '0 auto',
      }}
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        width={layout.containerWidth}
        height={layout.containerHeight}
        viewBox={`0 0 ${layout.containerWidth} ${layout.containerHeight}`}
        style={{ zIndex: 2 }}
      >
        <circle
          cx={layout.hookX}
          cy={layout.hookY}
          r={2.5}
          fill="none"
          stroke="#6B6A65"
          strokeWidth={1.2}
        />
        <path
          d={layout.path}
          fill="none"
          stroke="#8B7355"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        <path
          d={layout.path}
          fill="none"
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: 'translateY(1px)' }}
          opacity={0.4}
        />
      </svg>

      {layout.perTagPlacement.map((p) => (
        <div
          key={p.entry.item.id}
          className="absolute left-1/2"
          style={{
            top: p.tagTop,
            transform: `translateX(-50%)`,
            zIndex: 3,
          }}
        >
          <MiniTag
            entry={p.entry}
            width={dims.tagWidth}
            height={dims.tagHeight}
            rotation={p.rotation}
            lateralOffset={p.lateralOffset}
            size={size}
            onClick={onItemClick}
          />
        </div>
      ))}
    </div>
  );
}
