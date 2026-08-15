import { useNavigate } from 'react-router';
import { Shirt, Tags, Ruler } from 'lucide-react';
import { sfx } from '../lib/sounds';

/**
 * HeaderNavChips —— 桌面端页头交叉导航（每个页面放另外两个页面的入口）。
 * 与移动端底部 Tab 栏同一套图标语言（Shirt / Tags / Ruler）。
 * 移动端不渲染（底部 Tab 栏已承担导航），避免出现两套入口。
 */

const PAGES = [
  { to: '/', label: '衣柜', icon: Shirt, end: true },
  { to: '/best-match', label: 'Best Match', icon: Tags, end: false },
  { to: '/aesthetic', label: '我的穿衣规律', icon: Ruler, end: false },
] as const;

export type NavPage = (typeof PAGES)[number]['to'];

export function HeaderNavChips({ current }: { current: NavPage }) {
  const navigate = useNavigate();
  return (
    <>
      {PAGES.filter((p) => p.to !== current).map(({ to, label, icon: Icon }) => (
        <button
          key={to}
          type="button"
          className="entry-chip entry-chip--nav"
          onClick={() => { sfx.cardClick(); navigate(to); }}
        >
          <Icon className="h-4 w-4 text-graphite" strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </>
  );
}
