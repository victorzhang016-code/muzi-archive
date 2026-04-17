import { useMemo } from 'react';
import type { WardrobeItem } from '../types';
import { getTagTheme, hashId } from '../lib/tagThemes';

type BundleSize = 'mini' | 'detail';

interface MiniTagProps {
  item: WardrobeItem;
  width: number;
  height: number;
  rotation: number;
  lateralOffset: number;
  size: BundleSize;
}

function MiniTag({ item, width, height, rotation, lateralOffset, size }: MiniTagProps) {
  const theme = getTagTheme(item.id);
  const isDetail = size === 'detail';

  return (
    <div
      className="relative shrink-0"
      style={{
        width,
        height,
        transform: `translateX(${lateralOffset}px) rotate(${rotation}deg)`,
        transformOrigin: 'top center',
      }}
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

        {/* Name */}
        <div
          className="relative z-10 px-2.5"
          style={{ marginTop: isDetail ? 8 : 6 }}
        >
          <p
            className="font-story font-bold leading-tight line-clamp-2"
            style={{
              color: theme.textPrimary,
              fontSize: isDetail ? 12 : 10,
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
      </div>
    </div>
  );
}

interface TagBundleProps {
  items: WardrobeItem[];
  size?: BundleSize;
  className?: string;
}

const DIMS: Record<BundleSize, {
  tagWidth: number;
  tagHeight: number;
  gap: number;
  lateralRange: number;
  rotationRange: number;
  holeInset: number;
  hookTopPadding: number;
}> = {
  mini: {
    tagWidth: 112,
    tagHeight: 148,
    gap: 14,
    lateralRange: 10,
    rotationRange: 2.5,
    holeInset: 7,
    hookTopPadding: 26,
  },
  detail: {
    tagWidth: 180,
    tagHeight: 232,
    gap: 18,
    lateralRange: 14,
    rotationRange: 3,
    holeInset: 10,
    hookTopPadding: 36,
  },
};

function pseudoRandom(id: string, range: number, salt = 0): number {
  const h = hashId(id);
  const norm = ((h >> (salt * 3)) % 1000) / 1000; // 0..1
  return (norm * 2 - 1) * range; // -range..+range
}

/**
 * 棉线成串吊牌 — 几个吊牌用手绘感棉线连接起来的视觉，像挂在衣架上的样品串。
 * Victor 的 Margiela 风审美隐喻。
 */
export function TagBundle({ items, size = 'mini', className }: TagBundleProps) {
  const dims = DIMS[size];

  const layout = useMemo(() => {
    if (items.length === 0) return null;

    const perTagPlacement = items.map((item, idx) => {
      const lateralOffset = pseudoRandom(item.id, dims.lateralRange, idx);
      const rotation = pseudoRandom(item.id, dims.rotationRange, idx + 1);
      const tagTop = dims.hookTopPadding + idx * (dims.tagHeight + dims.gap);
      return { item, lateralOffset, rotation, tagTop };
    });

    // Container bounding
    const containerWidth = dims.tagWidth + dims.lateralRange * 2 + 20;
    const lastPlacement = perTagPlacement[perTagPlacement.length - 1];
    const containerHeight = lastPlacement.tagTop + dims.tagHeight + 10;

    // Hook point at top center
    const hookX = containerWidth / 2;
    const hookY = 6;

    // Hole absolute coordinates (within container)
    const holes = perTagPlacement.map((p) => ({
      x: containerWidth / 2 + p.lateralOffset,
      y: p.tagTop + dims.holeInset,
    }));

    // Build SVG path: hook → hole0 → hole1 → ... with quadratic bezier for hand-drawn wobble
    let path = `M ${hookX.toFixed(2)} ${hookY.toFixed(2)}`;
    let prev = { x: hookX, y: hookY };
    holes.forEach((hole, i) => {
      // Control point: midpoint with offset for wobble
      const midX = (prev.x + hole.x) / 2;
      const midY = (prev.y + hole.y) / 2;
      const wobble = pseudoRandom(items[i].id, 8, i + 2);
      const ctrlX = midX + wobble;
      const ctrlY = midY;
      path += ` Q ${ctrlX.toFixed(2)} ${ctrlY.toFixed(2)} ${hole.x.toFixed(2)} ${hole.y.toFixed(2)}`;
      prev = hole;
    });

    return {
      perTagPlacement,
      containerWidth,
      containerHeight,
      hookX,
      hookY,
      path,
    };
  }, [items, dims]);

  if (!layout) {
    return (
      <div className={className} style={{ height: dims.tagHeight + dims.hookTopPadding }}>
        <p className="text-center font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/50 mt-6">
          Empty bundle
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative ${className ?? ''}`}
      style={{
        width: layout.containerWidth,
        height: layout.containerHeight,
        margin: '0 auto',
      }}
    >
      {/* String (SVG) — behind tags so it emerges from holes */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={layout.containerWidth}
        height={layout.containerHeight}
        viewBox={`0 0 ${layout.containerWidth} ${layout.containerHeight}`}
        style={{ zIndex: 2 }}
      >
        {/* Hook anchor — small ring at top */}
        <circle
          cx={layout.hookX}
          cy={layout.hookY}
          r={2.5}
          fill="none"
          stroke="#6B6A65"
          strokeWidth={1.2}
        />
        {/* The cotton string */}
        <path
          d={layout.path}
          fill="none"
          stroke="#8B7355"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
        {/* Soft shadow beneath string for depth */}
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

      {/* Tags — positioned absolute so SVG can thread through them */}
      {layout.perTagPlacement.map((p) => (
        <div
          key={p.item.id}
          className="absolute left-1/2"
          style={{
            top: p.tagTop,
            transform: `translateX(-50%)`,
            zIndex: 3,
          }}
        >
          <MiniTag
            item={p.item}
            width={dims.tagWidth}
            height={dims.tagHeight}
            rotation={p.rotation}
            lateralOffset={p.lateralOffset}
            size={size}
          />
        </div>
      ))}
    </div>
  );
}
