import { NavLink } from 'react-router';
import { Shirt, Tags, Ruler } from 'lucide-react';

const TABS = [
  { to: '/', label: '衣柜', icon: Shirt, end: true },
  { to: '/best-match', label: 'Best Match', icon: Tags, end: false },
  { to: '/aesthetic', label: '我的穿衣规律', icon: Ruler, end: false },
] as const;

/**
 * 移动端底部 Tab 栏（<640px）。
 * 激活指示 = 细绳穿孔：一枚打孔圆点 + 一根穿过的渐细麻绳线（见 index.css .mobile-tabbar）。
 */
export default function MobileTabBar() {
  return (
    <nav className="mobile-tabbar sm:hidden" aria-label="主导航">
      <div className="mobile-tabbar__inner">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="mobile-tabbar__item">
            <span className="mobile-tabbar__thread" aria-hidden="true" />
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
            <span className="mobile-tabbar__label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
