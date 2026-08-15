import { ArrowRight, Lock } from 'lucide-react';
import { ColorSwatchCard, ColorSwatchFan } from './ColorSwatchCard';

/**
 * DEV-only UI 方向稿预览页（/ui-preview）。
 * 每个区块是一个待 Victor 确认的候选方向，不进生产路由。
 */

const PAPER_TEX = {
  backgroundImage: "url('/textures/linen.jpg')",
  backgroundSize: 'cover' as const,
  backgroundPosition: 'center' as const,
  mixBlendMode: 'multiply' as const,
  opacity: 0.22,
};

function PaperLayer() {
  return <div className="absolute inset-0 pointer-events-none" style={PAPER_TEX} />;
}

function Hole({ size = 10 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="rounded-full block"
      style={{
        width: size,
        height: size,
        background: 'var(--color-kraft)',
        boxShadow: 'inset 0 1.5px 3px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.14)',
      }}
    />
  );
}

/* ── 方向 A：搭配扇 —— 一沓扇形展开的搭配小卡，前面压着标题吊牌 ── */
function EntryDraftA() {
  const fan = [
    { rot: '-10deg', tone: '#DAD3C2', z: 1 },
    { rot: '2deg', tone: '#C9C0AC', z: 2 },
    { rot: '12deg', tone: '#E7E1D3', z: 3 },
  ];
  return (
    <button className="group relative block w-[320px] text-left">
      {/* 扇形小卡（接入真实 look 照片的位置） */}
      <div className="relative h-[210px]" aria-hidden="true">
        {fan.map((f, i) => (
          <div
            key={i}
            className="absolute bottom-2 left-8 tag-shadow transition-transform duration-500 group-hover:-translate-y-1.5"
            style={{
              width: 120,
              height: 168,
              transform: `rotate(${f.rot})`,
              transformOrigin: 'bottom left',
              background: f.tone,
              border: '1px solid rgba(107,106,101,0.25)',
              zIndex: f.z,
              padding: 6,
            }}
          >
            <div className="w-full h-[118px] bg-white/45 border border-graphite/15" />
            <div className="mt-2 h-px bg-graphite/25 mx-1" />
            <div className="mt-1.5 h-px bg-graphite/15 mx-1 w-2/3" />
          </div>
        ))}
        {/* 标题吊牌（压在最前） */}
        <div
          className="absolute left-0 bottom-0 z-10 bg-tag tag-shadow px-5 pt-4 pb-4 border border-graphite/20"
          style={{ transform: 'rotate(-2deg)', width: 200 }}
        >
          <span className="absolute left-1/2 -translate-x-1/2 top-[6px]"><Hole size={7} /></span>
          <p className="font-tag text-[8px] uppercase tracking-[0.3em] text-stamp mt-1.5">Best Match · 43 Looks</p>
          <p className="font-story text-[19px] font-bold text-ink leading-tight mt-1">心中的最佳搭配</p>
          <p className="font-story text-[11.5px] text-graphite/70 mt-1">查看与继续添加搭配组合</p>
          <p className="font-story text-[12px] text-stamp mt-2.5 flex items-center gap-1">
            进入档案 <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>
      </div>
    </button>
  );
}

/* ── 方向 B：大吊牌 —— 一张竖吊牌，穿孔系绳，承载整个入口 ── */
function EntryDraftB() {
  return (
    <button className="group relative block w-[280px] text-left bg-tag tag-shadow border border-graphite/20 overflow-hidden" style={{ transform: 'rotate(-1deg)' }}>
      <PaperLayer />
      {/* 穿孔 + 绳 */}
      <div className="relative flex justify-center pt-3" aria-hidden="true">
        <Hole size={11} />
        <span className="absolute left-1/2 top-0 h-3 w-px bg-string/70" />
      </div>
      <div className="relative px-6 pt-5 pb-6 text-center">
        <p className="font-tag text-[8px] uppercase tracking-[0.34em] text-graphite/55">Best Match</p>
        <p className="mt-2 italic text-[40px] leading-none text-ink" style={{ fontFamily: 'var(--font-display)' }}>43</p>
        <p className="font-tag text-[8px] uppercase tracking-[0.3em] text-graphite/55 mt-1">Looks Archived</p>
        <div className="hairline-dark mt-4" style={{ '--hairline-color': 'rgba(107,106,101,0.4)' } as React.CSSProperties} />
        <p className="font-story text-[17px] font-bold text-ink mt-4">心中的最佳搭配</p>
        <p className="font-story text-[12px] text-graphite/70 mt-1 leading-relaxed">查看与继续添加你最认可的搭配组合。</p>
        <p className="mt-4 inline-flex items-center gap-1.5 border border-ink/70 px-4 py-2 font-story text-[12.5px] text-ink group-hover:bg-ink group-hover:text-white transition-colors">
          进入档案 <ArrowRight className="w-3.5 h-3.5" />
        </p>
      </div>
    </button>
  );
}

/* ── 规律卡：色卡扇 + 原则数（已解锁 / 未解锁两态） ── */
function RulesCard({ unlocked }: { unlocked: boolean }) {
  return (
    <button className="group relative block w-[320px] text-left bg-tag tag-shadow border border-graphite/20 overflow-hidden">
      <PaperLayer />
      <div className="relative px-5 pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-tag text-[8px] uppercase tracking-[0.3em] text-graphite/55">Style Rules</p>
            <p className="font-story text-[18px] font-bold text-ink mt-1">我的穿衣规律</p>
          </div>
          {!unlocked && <Lock className="w-4 h-4 text-graphite/45 mt-1" />}
        </div>
        <div className="mt-4" style={unlocked ? undefined : { filter: 'grayscale(1)', opacity: 0.45 }}>
          <ColorSwatchFan
            colors={[
              { color: { r: 32, g: 32, b: 34 }, role: '黑' },
              { color: { r: 245, g: 243, b: 238 }, role: '白' },
              { color: { r: 38, g: 58, b: 96 }, role: '蓝' },
              { color: { r: 176, g: 58, b: 38 }, role: '红' },
            ]}
            spread={10}
          />
        </div>
        {unlocked ? (
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="font-story text-[12.5px] text-graphite/75 leading-relaxed">
              已生成 <strong className="text-ink">7 条原则</strong> · 12 个待尝试组合
            </p>
            <span className="font-story text-[12.5px] text-stamp flex items-center gap-1 shrink-0">
              查看 <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        ) : (
          <div className="mt-4">
            <p className="font-story text-[12.5px] text-ink">再积累 <strong>4</strong> 套 Best Match 解锁</p>
            <div className="mt-2 h-px bg-graphite/20 relative">
              <span className="absolute left-0 top-0 h-px bg-ink" style={{ width: '60%' }} />
            </div>
            <p className="font-tag text-[8px] tracking-[0.15em] text-graphite/45 mt-1.5">6 / 10</p>
          </div>
        )}
      </div>
    </button>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <p className="font-tag text-[10px] uppercase tracking-[0.3em] text-stamp mb-1">{title}</p>
      {note && <p className="font-story text-[13px] text-graphite/70">{note}</p>}
      <div className="mt-4 flex flex-wrap items-start gap-8">{children}</div>
    </section>
  );
}

export default function UiPreviewPage() {
  return (
    <div className="min-h-screen max-w-5xl mx-auto px-5 py-10">
      <h1 className="italic text-4xl mb-1" style={{ fontFamily: 'var(--font-display)' }}>UI 方向稿 v2</h1>
      <p className="font-story text-[13px] text-graphite/70 mb-10">DEV 预览 · 色卡按真实潘通扇卡重做；入口卡全部改为「物件」形态，不再是大横条</p>

      <Section title="01 · 潘通色卡 v2" note="色面顶端印 WEARLOG® 字标（如 PANTONE®），信息带 = 编号 + 角色名；微圆角来自实物倒角。">
        <ColorSwatchCard color={{ r: 192, g: 222, b: 202 }} role="主色 · 水绿" />
        <ColorSwatchCard color={{ r: 28, g: 28, b: 30 }} role="点缀色" size="sm" />
        <ColorSwatchCard color={{ r: 32, g: 32, b: 34 }} role="黑色" meta="60 件 · 平均 7.0 分" />
        <ColorSwatchCard color={{ r: 245, g: 243, b: 238 }} role="白色" meta="52 件 · 平均 6.9 分" />
      </Section>

      <Section title="02 · 潘通色卡串（扇形展开）" note="绕左下铆钉展开，用于「你已经用过的配色」和规律卡。">
        <ColorSwatchFan
          size="lg"
          colors={[
            { color: { r: 32, g: 32, b: 34 }, role: '黑色' },
            { color: { r: 245, g: 243, b: 238 }, role: '白色' },
            { color: { r: 128, g: 128, b: 126 }, role: '灰色' },
            { color: { r: 38, g: 58, b: 96 }, role: '蓝色' },
            { color: { r: 176, g: 58, b: 38 }, role: '红色' },
          ]}
        />
      </Section>

      <Section title="03 · Best Match 入口卡 · 方向 A（搭配扇）" note="一沓扇形搭配小卡 + 前景标题吊牌。接入后小卡用真实 look 照片。">
        <EntryDraftA />
      </Section>

      <Section title="04 · Best Match 入口卡 · 方向 B（大吊牌）" note="一张竖吊牌承载入口：穿孔系绳、43 大字、细线框 CTA。">
        <EntryDraftB />
      </Section>

      <Section title="05 · 我的穿衣规律卡（色卡扇 + 原则）" note="已解锁 = 彩扇 + 真实数据；未解锁 = 灰扇 + 细线进度。">
        <RulesCard unlocked />
        <RulesCard unlocked={false} />
      </Section>
    </div>
  );
}
