import { WardrobeItem } from '../types';
import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router';
import { MargielaRating } from './MargielaRating';
import { getTagTheme, getTagRotation } from '../lib/tagThemes';
import { sfx } from '../lib/sounds';

interface Props {
  item: WardrobeItem;
  index: number;
  onEdit?: (item: WardrobeItem) => void;
  onDelete?: (item: WardrobeItem) => void;
  onCardClick?: (item: WardrobeItem) => void;
}

export function WardrobeItemCard({ item, index, onEdit, onDelete, onCardClick }: Props) {
  const navigate = useNavigate();
  const theme = getTagTheme(item.id);
  const rotation = getTagRotation(item.id);

  const polaroidInner = theme.isLight
    ? { background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.09)' }
    : { background: 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 1px 4px rgba(0,0,0,0.30)' };

  return (
    /* Wrapper: straight default, tilts on hover via CSS */
    <div
      className="animate-tag-in tag-card-wrapper cursor-pointer group relative"
      style={{
        '--tag-rotation': `${rotation}deg`,
        animationDelay: `${Math.min(index * 28, 220)}ms`,
      } as React.CSSProperties}
      onMouseEnter={() => sfx.cardHover()}
      onClick={() => { sfx.cardClick(); onCardClick ? onCardClick(item) : navigate(`/item/${item.id}`); }}
    >
      {/* Physical card */}
      <div
        className="tag-inner relative overflow-hidden tag-shadow"
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
        {/* Texture layer */}
        {theme.texture !== 'none' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: theme.texture,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.30,
              mixBlendMode: 'multiply',
              zIndex: 0,
            }}
          />
        )}

        {/* Colour tint over texture — keeps text readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: theme.overlayColor, zIndex: 1 }}
        />

        {/* Content sits above textures */}
        <div className="relative z-10">

          {/* CERTIFIED stamp */}
          {item.rating >= 9 && (
            <div
              className="absolute -top-3 -right-3 z-30 stamp-certified rotate-[18deg]"
              style={{ borderColor: theme.accentColor, mixBlendMode: 'normal' }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-tag text-[6.5px] uppercase tracking-[0.08em] font-bold text-center leading-[1.3]"
                style={{ color: theme.accentColor }}>
                CERT<br/>IFIED
              </span>
            </div>
          )}

          {/* Edit / Delete — only in owner mode */}
          {(onEdit || onDelete) && (
            <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-30">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); sfx.modalOpen(); onEdit(item); }}
                  className="p-2 transition-colors shadow-sm"
                  style={{ background: 'rgba(128,128,128,0.25)', border: '1px solid rgba(128,128,128,0.25)', color: theme.textPrimary, backdropFilter: 'blur(4px)' }}
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); sfx.deleteItem(); onDelete(item); }}
                  className="p-2 transition-colors shadow-sm"
                  style={{ background: 'rgba(128,128,128,0.25)', border: '1px solid rgba(128,128,128,0.25)', color: '#E05C40', backdropFilter: 'blur(4px)' }}
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Top bar: ID · hole · season / year */}
          <div className="relative flex items-center justify-between px-3 pt-3 pb-2">
            <span className="font-tag text-[7px] uppercase tracking-[0.1em] leading-none" style={{ color: theme.textMuted }}>
              {item.id.slice(-6).toUpperCase()}
            </span>
            <div className="absolute left-1/2 top-3 -translate-x-1/2 tag-hole" style={{ backgroundColor: theme.holeColor }} />
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-tag text-[7px] uppercase tracking-[0.1em] leading-none" style={{ color: theme.textMuted }}>
                {item.season}
              </span>
              {item.length && (
                <span className="font-tag text-[7px] uppercase tracking-[0.1em] leading-none" style={{ color: theme.textMuted }}>
                  {item.length}
                </span>
              )}
              {item.purchaseYear && (
                <span className="font-tag text-[7px] tracking-[0.05em] leading-none" style={{ color: theme.accentColor, opacity: 0.8 }}>
                  {item.purchaseYear}
                </span>
              )}
            </div>
          </div>

          {/* Polaroid photo */}
          <div className="mx-3 mb-3">
            <div style={{ padding: '5px 5px 16px 5px', ...polaroidInner }}>
              <div className="aspect-[3/4] overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
                    loading="eager"
                  />
                ) : (
                  <div
                    onClick={(e) => { e.stopPropagation(); if (onEdit) onEdit(item); }}
                    className={`w-full h-full flex items-center justify-center ${onEdit ? 'cursor-pointer' : ''}`}
                    style={{ background: theme.isLight ? '#EDE9E0' : 'rgba(255,255,255,0.05)' }}
                  >
                    <span
                      className="font-tag text-[10px] tracking-[0.4em] uppercase"
                      style={{ writingMode: 'vertical-rl', textOrientation: 'upright', color: theme.textMuted }}
                    >
                      NO IMG
                    </span>
                  </div>
                )}
              </div>
              <div className="h-[16px] flex items-center justify-center">
                <span className="font-tag text-[7px] uppercase tracking-[0.15em]"
                  style={{ color: theme.isLight ? 'rgba(107,106,101,0.45)' : 'rgba(255,255,255,0.30)' }}>
                  {item.category}
                </span>
              </div>
            </div>
          </div>

          {/* Text content */}
          <div className="px-3.5 pb-4">
            <div className="mb-2.5 h-px" style={{ background: theme.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }} />

            <h3
              onClick={(e) => { if (onEdit && (!item.name || item.name === '未命名')) { e.stopPropagation(); onEdit(item); } }}
              className="font-story text-[17px] font-bold leading-snug mb-1 line-clamp-2"
              style={{ color: (!item.name || item.name === '未命名') ? theme.textMuted : theme.textPrimary }}
            >
              {item.name && item.name !== '未命名' ? item.name : '+ 添加名称...'}
            </h3>
            {item.brand && (
              <p className="font-tag text-[9px] uppercase tracking-[0.15em] mb-2" style={{ color: theme.textMuted }}>
                {item.brand}
              </p>
            )}

            {item.story ? (
              <p className="text-[12px] leading-[1.75] line-clamp-2 font-story mb-3" style={{ color: theme.textSecondary }}>
                {item.story}
              </p>
            ) : onEdit ? (
              <p
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                className="text-[12px] leading-[1.75] font-story italic cursor-pointer mb-3"
                style={{ color: theme.textMuted }}
              >
                + 添加故事...
              </p>
            ) : null}

            <MargielaRating rating={item.rating} size="sm" accentColor={theme.accentColor} dimColor={theme.textMuted} />
          </div>
        </div>
      </div>
    </div>
  );
}
