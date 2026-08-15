/**
 * ColorSwatchCard —— 潘通色卡语言（参照真实 Pantone solid chip / fan deck）。
 * 条形卡：上方大色块（左上角印 WEARLOG 字标，如同 PANTONE® 印在色面上），
 * 下方白色信息带 = 编号（font-tag 粗体）+ 角色/色系名。
 * 微圆角（2px）来自实物色卡的倒角，是母题的一部分，不是装饰。
 * ColorSwatchFan 把多张色卡绕左下角铆钉扇形展开（组合成串）。
 */
import { useEffect, useState } from 'react';

export interface SwatchRGB {
  r: number;
  g: number;
  b: number;
}

interface Props {
  color: SwatchRGB;
  /** 角色标签：主色 / 辅色 / 点缀色，或色系名（黑色 / 白色…） */
  role: string;
  /** 编号行，默认 `WL {r}-{g}-{b}` */
  code?: string;
  /** 第三行元信息（件数、平均评分等），仅 lg 展示 */
  meta?: string;
  size?: 'lg' | 'sm';
  className?: string;
  style?: React.CSSProperties;
}

function luminance({ r, g, b }: SwatchRGB) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function ColorSwatchCard({ color, role, code, meta, size = 'lg', className, style }: Props) {
  const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
  const codeText = code ?? `WL ${color.r}-${color.g}-${color.b}`;
  const isLg = size === 'lg';
  // 深色面上印浅字、浅色面上印墨字——如同 PANTONE 字标印在色面顶端
  const markColor = luminance(color) > 0.62 ? 'rgba(28,28,26,0.55)' : 'rgba(253,252,245,0.85)';

  return (
    <div
      className={`inline-flex flex-col bg-tag select-none rounded-[2px] ${className ?? ''}`}
      style={{
        width: isLg ? 116 : 76,
        padding: isLg ? '6px 6px 0' : '4px 4px 0',
        boxShadow:
          '1px 1px 0 rgba(0,0,0,0.04), 2px 3px 8px rgba(0,0,0,0.13), 4px 8px 20px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      {/* 色面 */}
      <div className="relative rounded-[1px]" style={{ height: isLg ? 118 : 76, background: rgb }}>
        <span
          aria-hidden="true"
          className="absolute top-1 left-1.5 font-tag font-bold"
          style={{ fontSize: isLg ? 7 : 5.5, letterSpacing: '0.14em', color: markColor }}
        >
          WEARLOG®
        </span>
      </div>
      {/* 信息带 */}
      <div className={isLg ? 'px-0.5 py-2' : 'px-0.5 py-1.5'}>
        <p
          className="font-tag font-bold leading-none text-ink"
          style={{ fontSize: isLg ? 9.5 : 7.5, letterSpacing: '0.04em' }}
        >
          {codeText}
        </p>
        <p
          className="font-story leading-none text-graphite truncate"
          title={role}
          style={{ fontSize: isLg ? 11 : 9, marginTop: 4 }}
        >
          {role}
        </p>
        {isLg && meta && (
          <p className="font-tag text-[8px] leading-snug text-graphite/60 mt-1.5">{meta}</p>
        )}
      </div>
    </div>
  );
}

/** 扇形色卡串：绕左下铆钉展开；入场依次绽放，hover 时展开角加大 */
export function ColorSwatchFan({
  colors,
  size = 'sm',
  spread = 9,
}: {
  colors: Array<{ color: SwatchRGB; role: string }>;
  size?: 'lg' | 'sm';
  /** 相邻卡片的旋转间隔（度） */
  spread?: number;
}) {
  const [bloomed, setBloomed] = useState(false);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setBloomed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const n = colors.length;
  const mid = (n - 1) / 2;
  const cardW = size === 'lg' ? 116 : 76;
  const cardH = size === 'lg' ? 166 : 110;
  // 张数多时收敛每张摆角，保持扇子紧凑
  const maxSpread = n > 1 ? Math.min(spread, 64 / (n - 1)) : spread;
  const effectiveSpread = bloomed ? (hover ? maxSpread * 1.4 : maxSpread) : 0;
  const maxRot = Math.abs(mid) * maxSpread * 1.4;
  const xSwing = Math.sin((maxRot * Math.PI) / 180) * cardH;
  const containerH = cardH + Math.sin((maxRot * Math.PI) / 360) * cardW + 28;

  return (
    <div
      className="relative"
      style={{ height: containerH, width: cardW + xSwing * 2 + 16 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {colors.map((entry, i) => {
        const rot = (i - mid) * effectiveSpread;
        return (
          <div
            key={i}
            className="absolute bottom-[16px] origin-bottom-left"
            style={{
              left: xSwing + 8,
              transform: `rotate(${rot}deg)`,
              zIndex: i + 1,
              transition: `transform 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 55}ms`,
            }}
          >
            <ColorSwatchCard color={entry.color} role={entry.role} size={size} />
          </div>
        );
      })}
      {/* 铆钉 */}
      <span
        aria-hidden="true"
        className="absolute rounded-full bg-tag"
        style={{
          left: xSwing + 10,
          bottom: 2,
          width: 10,
          height: 10,
          zIndex: n + 2,
          boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.15)',
        }}
      />
    </div>
  );
}
