import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Loader2, RotateCcw, Shirt } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useBestMatches } from '../contexts/BestMatchContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { buildLiveAestheticRun, liveAestheticSnapshot, quickOutfitOptions, saveQuickWearRecord, type QuickOutfitOption } from '../lib/aestheticProduct';
import type { AnalysisRun } from '../lib/aestheticAnalysisV3';
import { listVisionAnalyses, type VisionAnalysis } from '../lib/aestheticVision';
import { resolveMediaUrl } from '../lib/media';
import { loadSyncedAestheticRun } from '../lib/aestheticRunSync';

const SLOT_LABELS = { tops: '上装', bottoms: '下装', shoes: '鞋', accessories: '配饰' } as const;

export function QuickOutfitPage() {
  const { itemId = '' } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { items, loading: itemLoading } = useWardrobe();
  const { matches, loading: matchLoading } = useBestMatches();
  const [analyses, setAnalyses] = useState<VisionAnalysis[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<QuickOutfitOption | null>(null);
  const [syncedRun, setSyncedRun] = useState<AnalysisRun | null>(null);
  const [syncLoading, setSyncLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    listVisionAnalyses().then((next) => { if (alive) setAnalyses(next); }).catch(() => {
      if (alive) setError('审美解释暂时没能读取；已确认搭配仍然可以使用。');
    }).finally(() => { if (alive) setAnalysisLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    loadSyncedAestheticRun().then((next) => { if (alive) setSyncedRun(next); }).catch(() => {
      // Fall back to the live deterministic run if the optional snapshot is unavailable.
    }).finally(() => { if (alive) setSyncLoading(false); });
    return () => { alive = false; };
  }, []);

  const anchor = items.find((item) => item.id === itemId);
  const generatedRun = useMemo(() => {
    if (!items.length && !matches.length) return null;
    return buildLiveAestheticRun(liveAestheticSnapshot(items, matches, analyses));
  }, [items, matches, analyses]);
  const run = syncedRun || generatedRun;
  const options = useMemo(() => quickOutfitOptions(itemId, matches, items, run), [itemId, matches, items, run]);

  const choose = (option: QuickOutfitOption) => {
    const record = {
      id: `quick:${Date.now()}:${option.id}`,
      optionId: option.id,
      anchorItemId: itemId,
      matchId: option.sourceMatch.id,
      selectedAt: new Date().toISOString(),
      state: 'selected' as const,
      opportunityId: option.opportunityId,
    };
    saveQuickWearRecord(record);
    setSelected(option);
  };

  const loading = itemLoading || matchLoading || analysisLoading || syncLoading;
  if (loading) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center text-sm text-graphite/65"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />正在整理已确认搭配…</div></div>;

  if (!anchor) return <div className="mx-auto max-w-xl py-20 text-center"><h1 className="font-story text-3xl font-semibold">没有找到这件衣服</h1><button type="button" onClick={() => navigate('/')} className="mt-6 min-h-11 bg-ink px-5 text-sm text-white">返回衣橱</button></div>;

  return (
    <section className="mx-auto max-w-6xl pb-12">
      <button type="button" onClick={() => navigate(`/item/${anchor.id}`)} className="inline-flex min-h-10 items-center gap-2 text-sm text-graphite hover:text-ink"><ArrowLeft className="h-4 w-4" />返回单品</button>

      <header className="mt-3 grid gap-5 border-b border-dashed border-graphite/25 pb-6 md:grid-cols-[112px_minmax(0,1fr)] md:items-end">
        <div className="aspect-[3/4] overflow-hidden border border-graphite/15 bg-tag">
          {anchor.imageUrl ? <img src={resolveMediaUrl(anchor.imageUrl)} alt={anchor.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Shirt className="h-6 w-6 text-graphite/35" /></div>}
        </div>
        <div>
          <p className="font-tag text-[10px] uppercase tracking-[0.24em] text-stamp">Quick outfit</p>
          <h1 className="mt-2 font-story text-3xl font-semibold leading-tight sm:text-4xl">用「{anchor.name}」搭一套</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">这里先给你已经保存过的搭配和明确记录过的替换。每套都保留原 Best Match 的上下文。</p>
        </div>
      </header>

      {error && <p className="mt-5 border-l-2 border-stamp pl-3 text-sm leading-6 text-stamp">{error}</p>}

      {selected && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border border-emerald-800/25 bg-emerald-50/70 p-4 text-emerald-950">
          <div><p className="font-medium">已经记下：今天穿「{selected.sourceMatch.name || '这套 Best Match'}」</p><p className="mt-1 text-sm">之后可以在审美页补充实穿结果，它会成为这套搭配的真实证据。</p></div>
          <button type="button" onClick={() => setSelected(null)} className="inline-flex min-h-10 items-center gap-2 border border-emerald-800/30 px-3 text-sm"><RotateCcw className="h-4 w-4" />继续比较</button>
        </div>
      )}

      {options.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {options.map((option) => {
            const outfit = run?.outfitCases.find((entry) => entry.matchId === option.sourceMatch.id);
            const explanations = outfit?.decisionMechanisms.filter((entry) => entry.role !== 'structural' && entry.status !== 'pending').slice(0, 2) || [];
            const isSelected = selected?.id === option.id;
            return <article key={option.id} className={`flex min-w-0 flex-col border bg-tag/75 ${isSelected ? 'border-emerald-700' : 'border-graphite/20'}`}>
              <div className="grid grid-cols-4 gap-px bg-graphite/10 p-px">
                {option.selections.slice(0, 8).map((selection) => <button type="button" onClick={() => navigate(`/item/${selection.item.id}`)} key={`${selection.slot}:${selection.index}`} className="relative aspect-[3/4] overflow-hidden bg-kraft" title={selection.item.name}>
                  {selection.item.imageUrl ? <img src={resolveMediaUrl(selection.item.imageUrl)} alt={selection.item.name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[10px] text-graphite/50">{selection.item.name}</span>}
                  {selection.item.id === anchor.id && <span className="absolute bottom-1 left-1 bg-stamp px-1.5 py-0.5 text-[9px] text-white">当前单品</span>}
                </button>)}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3"><div><span className={`inline-block border px-2 py-1 text-[10px] ${option.kind === 'confirmed_match' ? 'border-emerald-700/35 bg-emerald-50 text-emerald-900' : option.kind === 'confirmed_variant' ? 'border-stamp/35 bg-stamp/5 text-stamp' : 'border-amber-700/35 bg-amber-50 text-amber-900'}`}>{option.kind === 'confirmed_match' ? '已确认搭配' : option.kind === 'confirmed_variant' ? '已确认替换' : '规则引擎建议 · 待尝试'}</span><h2 className="mt-2 font-story text-xl font-semibold">{option.sourceMatch.name || '未命名 Best Match'}</h2></div><span className="text-[10px] text-graphite/50">{option.selections.length} 件</span></div>
                <p className="mt-2 text-sm leading-6 text-graphite/75">{option.kind === 'suggested_candidate' ? `沿用「${option.sourceMatch.name || '这套搭配'}」的结构，把${option.replacedItem?.name || '原单品'}换成「${option.candidateItem?.name || '候选单品'}」。这是基于已记录规则生成的待尝试组合。` : `来自你的 Best Match。${option.kind === 'confirmed_variant' && option.replacedItem ? `当前单品在这套搭配中替换「${option.replacedItem.name}」。` : '这件单品本来就在这套搭配里。'}`}</p>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-y border-dashed border-graphite/20 py-3 text-xs">
                  {option.selections.map((selection) => <div key={`${selection.slot}:${selection.index}`} className="contents"><dt className="text-graphite/50">{SLOT_LABELS[selection.slot]}</dt><dd className="truncate text-right">{selection.item.name}</dd></div>)}
                </dl>

                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-graphite underline decoration-graphite/25 underline-offset-4">为什么这样搭</summary>
                  {explanations.length ? <div className="mt-3 space-y-2">{explanations.map((entry) => <div key={entry.id} className="border-l-2 border-stamp/40 pl-3"><p className="font-medium">{entry.action}</p><p className="mt-1 leading-6 text-graphite/70">{entry.effect}</p></div>)}</div> : <p className="mt-3 leading-6 text-graphite/70">你已经记录过这套搭配；当前还没有足够字段说明它的具体处理方式。</p>}
                </details>

                <div className="mt-auto pt-5"><button type="button" disabled={isSelected} onClick={() => choose(option)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 bg-ink px-4 text-sm text-white disabled:bg-emerald-800"><Check className="h-4 w-4" />{isSelected ? '今天就穿这套' : '今天穿这套'}</button></div>
              </div>
            </article>;
          })}
        </div>
      ) : (
        <div className="mt-8 border border-dashed border-graphite/30 bg-tag/55 px-5 py-10 text-center">
          <h2 className="font-story text-2xl font-semibold">这件衣服还没有已确认的搭配</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-graphite/70">先记录一套 Best Match，之后它会直接出现在这里。</p>
          <button type="button" onClick={() => navigate('/best-match/new')} className="mt-5 min-h-11 bg-ink px-5 text-sm text-white">建立 Best Match</button>
        </div>
      )}
    </section>
  );
}
