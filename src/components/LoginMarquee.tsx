import { useEffect, useState } from 'react';
import { WardrobeItem } from '../types';
import { WardrobeItemCard } from './WardrobeItemCard';
import { fetchAuthorSampleItems } from '../lib/sampleItems';

/**
 * 登录页背景卡墙：拉取作者的公开卡片，分成几列做无缝纵向滚动，
 * 整体模糊 + 降透明度 + pointer-events-none，铺在登录内容下层。
 */

const COLUMN_COUNT = 3;

function MarqueeColumn({ items, direction, duration }: {
  items: WardrobeItem[];
  direction: 'up' | 'down';
  duration: number;
}) {
  if (items.length === 0) return null;
  // 复制两份内容实现 -50% 无缝循环
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div
        className="marquee-track"
        style={{
          animation: `marquee-${direction} ${duration}s linear infinite`,
        }}
      >
        {doubled.map((item, i) => (
          <WardrobeItemCard key={`${item.id}-${i}`} item={item} index={0} />
        ))}
      </div>
    </div>
  );
}

export function LoginMarquee() {
  const [items, setItems] = useState<WardrobeItem[]>([]);

  useEffect(() => {
    fetchAuthorSampleItems(8).then(setItems);
  }, []);

  if (items.length === 0) return null;

  // 轮询分配到各列
  const columns: WardrobeItem[][] = Array.from({ length: COLUMN_COUNT }, () => []);
  items.forEach((item, i) => columns[i % COLUMN_COUNT].push(item));

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
      style={{ filter: 'blur(7px)', opacity: 0.5 }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 px-6 max-w-5xl mx-auto -mt-24">
        {columns.map((col, i) => (
          <div key={i} className={i === 2 ? 'hidden sm:block' : ''}>
            <MarqueeColumn
              items={col}
              direction={i % 2 === 0 ? 'up' : 'down'}
              duration={48 + i * 8}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
