import { useEffect, useRef, useState } from 'react';
import type { LocalColor } from '../lib/aestheticContracts';

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((part) => part.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function rgbToHsv([red, green, blue]: [number, number, number]): [number, number, number] {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta) hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [Math.round((hue * 60 + 360) % 360), max ? delta / max : 0, max];
}

function hsvToRgb(hue: number, saturation: number, value: number): [number, number, number] {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  const [r, g, b] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return [Math.round((r + match) * 255), Math.round((g + match) * 255), Math.round((b + match) * 255)];
}

export function AestheticColorField({ color, onChange, onRemove }: { color: LocalColor; onChange: (color: LocalColor) => void; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState(() => rgbToHsv(color.rgb)[0]);
  const [saturation, setSaturation] = useState(() => rgbToHsv(color.rgb)[1]);
  const [value, setValue] = useState(() => rgbToHsv(color.rgb)[2]);
  const surfaceDragging = useRef(false);

  useEffect(() => {
    const [nextHue, nextSaturation, nextValue] = rgbToHsv(color.rgb);
    setHue(nextHue);
    setSaturation(nextSaturation);
    setValue(nextValue);
  }, [color.rgb]);

  const updateHsv = (nextHue: number, nextSaturation: number, nextValue: number) => {
    setHue(nextHue);
    setSaturation(nextSaturation);
    setValue(nextValue);
    const rgb = hsvToRgb(nextHue, nextSaturation, nextValue);
    onChange({ ...color, rgb, hex: rgbToHex(rgb), source: 'user' });
  };

  const pickSurface = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateHsv(hue, Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)));
  };

  const updateRgb = (rgb: [number, number, number]) => {
    const next = rgbToHsv(rgb);
    setHue(next[0]); setSaturation(next[1]); setValue(next[2]);
    onChange({ ...color, rgb, hex: rgbToHex(rgb), source: 'user' });
  };

  return <div className="grid grid-cols-[42px_minmax(0,1fr)_88px_28px] items-center gap-2 border border-graphite/15 bg-white/55 p-2">
    <button type="button" aria-label="打开自由色盘" onClick={() => setOpen(true)} className="h-9 w-10 border border-graphite/30 shadow-inner" style={{ backgroundColor: color.hex }} />
    <div className="min-w-0"><input aria-label="RGB 数值" value={color.rgb.join(',')} onChange={(event) => { const values = event.target.value.split(',').map((part) => Math.max(0, Math.min(255, Number(part.trim()) || 0))); if (values.length === 3) updateRgb(values as [number, number, number]); }} className="w-full min-w-0 border border-graphite/20 bg-white px-2 py-2 font-mono text-xs" /><span className="mt-1 hidden font-mono text-[10px] text-graphite/55 sm:block">{color.hex}</span></div>
    <select aria-label="颜色角色" value={color.role} onChange={(event) => onChange({ ...color, role: event.target.value as LocalColor['role'], source: 'user' })} className="min-h-9 border border-graphite/20 bg-white px-1.5 text-xs"><option value="dominant">主色</option><option value="secondary">辅色</option><option value="accent">点缀色</option></select>
    {onRemove ? <button type="button" aria-label="删除颜色" onClick={onRemove} className="h-9 text-graphite/55 hover:text-stamp">×</button> : <span />}
    {open && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/35 p-4" onPointerDown={() => setOpen(false)}><div role="dialog" aria-modal="true" aria-label="自由选色盘" className="w-full max-w-sm border border-graphite/30 bg-kraft p-4 shadow-2xl" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="h-7 w-7 border border-graphite/30" style={{ backgroundColor: color.hex }} /><div><p className="text-sm font-medium">自由选色</p><p className="font-mono text-[11px] text-graphite/60">{color.rgb.join(', ')} · {color.hex}</p></div></div><button type="button" onClick={() => setOpen(false)} className="border border-graphite/25 bg-white/60 px-2 py-1 text-xs">完成</button></div>
      <div role="application" aria-label="饱和度和明度选色区域" onPointerDown={(event) => { surfaceDragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); pickSurface(event); }} onPointerMove={(event) => { if (surfaceDragging.current) pickSurface(event); }} onPointerUp={() => { surfaceDragging.current = false; }} onPointerCancel={() => { surfaceDragging.current = false; }} onLostPointerCapture={() => { surfaceDragging.current = false; }} className="relative mt-4 h-56 touch-none cursor-crosshair overflow-hidden border border-graphite/20" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))` }}><span className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%` }} /></div>
      <label className="mt-4 block text-xs text-graphite/70">色相<input aria-label="色相滑条" type="range" min="0" max="360" value={hue} onChange={(event) => updateHsv(Number(event.target.value), saturation, value)} className="mt-2 h-3 w-full cursor-pointer accent-stamp" style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }} /></label>
      <p className="mt-3 text-[11px] leading-relaxed text-graphite/60">在色块中选择饱和度和明度。点击遮罩空白处即可关闭。</p>
    </div></div>}
  </div>;
}
