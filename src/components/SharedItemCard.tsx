import { WardrobeItem } from '../types';
import { MargielaRating } from './MargielaRating';
import { getTagTheme } from '../lib/tagThemes';
import { toDateSafe } from '../lib/publicWardrobe';

/**
 * 只读单品大卡（吊牌 + CARE LABEL），无 modal 外壳、无交互。
 * 复用于：ShareView 的只读弹窗、单品公开深链页、分享图模板。
 */
export function SharedItemCard({ item }: { item: WardrobeItem }) {
  const theme = getTagTheme(item.id);

  const createdDate = toDateSafe(item.createdAt);
  const dateStr = createdDate
    ? `${createdDate.getFullYear()}.${String(createdDate.getMonth() + 1).padStart(2, '0')}.${String(createdDate.getDate()).padStart(2, '0')}`
    : '—';

  const polaroidInner = theme.isLight
    ? { background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.10)' }
    : { background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 2px 6px rgba(0,0,0,0.35)' };

  return (
    <div>
      <div
        className="tag-shadow relative overflow-hidden"
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
        {theme.texture !== 'none' && (
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: theme.texture,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.28,
            mixBlendMode: 'multiply',
            zIndex: 0,
          }} />
        )}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: theme.overlayColor, zIndex: 1 }} />

        <div className="relative z-10">
          {item.rating >= 9 && (
            <div className="absolute -top-4 -right-4 z-20 stamp-certified rotate-[15deg]"
              style={{ borderColor: theme.accentColor, mixBlendMode: 'normal', opacity: 0.85 }}>
              <span className="font-tag text-[7px] uppercase tracking-[0.08em] font-bold text-center leading-[1.3]"
                style={{ color: theme.accentColor }}>
                CERT<br/>IFIED
              </span>
            </div>
          )}

          <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
            <span className="font-tag text-[7px] uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>
              {item.id.slice(-8).toUpperCase()}
            </span>
            <div className="absolute left-1/2 top-4 -translate-x-1/2 tag-hole" style={{ backgroundColor: theme.holeColor }} />
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-tag text-[7px] uppercase tracking-[0.1em]" style={{ color: theme.textMuted }}>
                {item.season}
              </span>
              {item.purchaseYear && (
                <span className="font-tag text-[8px] tracking-[0.05em]" style={{ color: theme.accentColor, opacity: 0.85 }}>
                  {item.purchaseYear}
                </span>
              )}
            </div>
          </div>

          <div className="mx-4 mb-4">
            <div style={{ padding: '8px 8px 28px 8px', ...polaroidInner }}>
              {item.imageUrl ? (
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
                    loading="eager"
                  />
                </div>
              ) : (
                <div
                  className="aspect-[3/4] flex items-center justify-center"
                  style={{ background: theme.isLight ? '#EDE9E0' : 'rgba(255,255,255,0.05)' }}
                >
                  <span className="font-tag text-[11px] tracking-[0.3em] uppercase" style={{ color: theme.textMuted }}>
                    No Image
                  </span>
                </div>
              )}
              <div className="h-[28px] flex items-center justify-center">
                <span className="font-tag text-[8px] uppercase tracking-[0.15em]"
                  style={{ color: theme.isLight ? 'rgba(107,106,101,0.45)' : 'rgba(255,255,255,0.35)' }}>
                  {item.category}
                </span>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="h-px mb-5" style={{ background: theme.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }} />
            <h1 className="font-story font-bold text-3xl sm:text-4xl leading-tight tracking-tight mb-5"
              style={{ color: theme.textPrimary }}>
              {item.name && item.name !== '未命名' ? item.name : '未命名'}
            </h1>
            <div className="mb-7">
              <div className="w-6 h-[1.5px] mb-5" style={{ background: theme.accentColor }} />
              {item.story ? (
                <p className="leading-[2] whitespace-pre-wrap text-[15px] font-story" style={{ color: theme.textSecondary }}>
                  {item.story}
                </p>
              ) : (
                <p className="leading-[2] text-[15px] font-story italic" style={{ color: theme.textMuted }}>
                  暂无故事
                </p>
              )}
            </div>
            <MargielaRating rating={item.rating} size="lg" accentColor={theme.accentColor} dimColor={theme.textMuted} />
          </div>
        </div>
      </div>

      <div
        className="wash-label px-6 py-5"
        style={{
          background: theme.isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.25)',
          borderStyle: 'solid',
          borderWidth: '0 1px 1px 1px',
          borderColor: theme.borderEdge,
          color: theme.textSecondary,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-px" style={{ background: theme.textMuted }} />
          <span className="text-[7px] tracking-[0.3em] font-bold" style={{ color: theme.textMuted }}>CARE LABEL</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
          <p><span style={{ color: theme.textMuted }}>CAT. </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.category}</span></p>
          <p><span style={{ color: theme.textMuted }}>SEASON </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.season}</span></p>
          <p><span style={{ color: theme.textMuted }}>RATING </span><span style={{ color: theme.textSecondary }} className="font-medium">{item.rating}/10</span></p>
          <p><span style={{ color: theme.textMuted }}>DATE </span><span style={{ color: theme.textSecondary }} className="font-medium">{dateStr}</span></p>
          {item.purchaseYear && (
            <p><span style={{ color: theme.textMuted }}>YEAR </span><span style={{ color: theme.accentColor }} className="font-bold">{item.purchaseYear}</span></p>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3 pt-2.5" style={{ borderTop: `1px dashed ${theme.textMuted}`, opacity: 0.5 }}>
          {['◯', '△', '☐', '◇', '⬡'].map((sym, i) => (
            <span key={i} className="text-[15px]">{sym}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
