import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronRight, Loader2, Palette, RefreshCw, ScanText, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBestMatches } from '../contexts/BestMatchContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import {
  authorizeKimiDecisionBrief,
  buildKimiDecisionBriefRequest,
  requestKimiDecisionBrief,
  type AnalysisRun,
  type ManualFeedback,
  type OutfitDecisionBrief,
  type OutfitCaseGraph,
  type SubstitutionContract,
} from '../lib/aestheticAnalysisV3';
import { buildLiveAestheticRun, listQuickWearRecords, liveAestheticSnapshot, saveDecisionBrief, saveQuickWearRecord, type QuickWearRecord } from '../lib/aestheticProduct';
import { listVisionAnalyses, type VisionAnalysis } from '../lib/aestheticVision';
import { resolveMediaUrl } from '../lib/media';

type View = 'principles' | 'cases' | 'substitutions' | 'calibration';

const VIEW_LABELS: Record<View, string> = {
  principles: '我的穿衣规律',
  cases: '搭配案例',
  substitutions: '替换关系',
  calibration: 'AI 与校准',
};

const PRINCIPLE_LABELS = {
  self_aware: '你明确写过',
  enacted: '常穿搭配中成立',
  emerging: '初步模式',
  frontier: '值得继续验证',
  case_only: '单套记录',
};

const OPERATION_LABELS: Record<string, string> = {
  color_echo: '色彩呼应', color_lighten: '明度提亮', color_ground: '低明度收束',
  volume_balance: '廓形平衡', line_continue: '线条延续', material_harmony: '材质协调',
  material_tension: '材质张力', formality_adjust: '正式度调节', focus_control: '设计焦点控制',
  identity_expression: '故事与身份表达',
};

const FEEDBACK_KEY = 'wearlog.local.aesthetic.manual-feedback.v3';

function percent(value: number) { return `${Math.round(value * 100)}%`; }

function readFeedback() {
  try { return JSON.parse(window.localStorage.getItem(FEEDBACK_KEY) || '[]') as ManualFeedback[]; } catch { return []; }
}

function CompactPalette({ outfit }: { outfit: OutfitCaseGraph }) {
  const representative = ['dominant', 'secondary', 'accent'].flatMap((role) => {
    const found = outfit.composition.colorPalette.find((entry) => entry.role === role);
    return found ? [found] : [];
  });
  return <div className="mt-3 flex flex-wrap gap-2">{representative.map((entry, index) => <div key={`${entry.itemId}:${entry.role}:${index}`} className="flex items-center gap-2 border border-graphite/15 bg-white/65 p-1.5 pr-2"><span className="h-7 w-7 border border-graphite/15" style={{ backgroundColor: entry.hex }} /><span className="text-xs text-graphite/70">{entry.role === 'dominant' ? '主色' : entry.role === 'secondary' ? '辅色' : '点缀色'} · {entry.family}</span></div>)}</div>;
}

function EvidenceDrawer({ run, ids }: { run: AnalysisRun; ids: string[] }) {
  const evidence = ids.map((id) => run.evidence.find((entry) => entry.id === id)).filter(Boolean).slice(0, 16);
  return <details className="mt-4 border-t border-dashed border-graphite/20 pt-3"><summary className="cursor-pointer text-xs text-graphite underline decoration-graphite/25 underline-offset-4">查看来源</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{evidence.map((entry) => <div key={entry!.id} className="border border-graphite/15 bg-kraft/45 p-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{entry!.label}</span><span className="text-[10px] text-graphite/50">{entry!.status === 'confirmed' ? '已确认' : entry!.status === 'direct_text' ? '你写过' : '记录推导'}</span></div>{entry!.quote && <p className="mt-1 text-xs leading-5 text-graphite/70">“{entry!.quote}”</p>}{entry!.detail && <p className="mt-1 text-xs leading-5 text-graphite/60">{entry!.detail}</p>}</div>)}</div>{!evidence.length && <p className="mt-2 text-xs text-graphite/55">当前没有足够来源，不会补写结论。</p>}</details>;
}

function OutfitDetail({ outfit, run, onRefresh }: { outfit: OutfitCaseGraph; run: AnalysisRun; onRefresh: () => void }) {
  const navigate = useNavigate();
  const [focus, setFocus] = useState(outfit.decisionBrief?.focus || '');
  const [problem, setProblem] = useState(outfit.decisionBrief?.problem || '');
  const [outcome, setOutcome] = useState(outfit.decisionBrief?.outcome || '');
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState('');
  const meaningful = outfit.decisionMechanisms.filter((entry) => entry.role !== 'structural').slice(0, 3);
  const focusHighlights = outfit.composition.designFocus.focusHighlights;

  const saveBrief = (brief: OutfitDecisionBrief) => {
    saveDecisionBrief(brief);
    setMessage('搭配意图已保存，会参与下一次规则计算。');
    onRefresh();
  };

  const draftWithKimi = async () => {
    const request = buildKimiDecisionBriefRequest(run, outfit.matchId);
    if (!request) { setMessage('这套搭配还缺少可供解析的确认字段。'); return; }
    setDrafting(true); setMessage('');
    try {
      const brief = authorizeKimiDecisionBrief(await requestKimiDecisionBrief(request));
      setFocus(brief.focus); setProblem(brief.problem); setOutcome(brief.outcome);
      saveBrief(brief);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Kimi 解析失败，请稍后重试');
    } finally { setDrafting(false); }
  };

  const manualSave = () => saveBrief({ matchId: outfit.matchId, focus: focus.trim(), problem: problem.trim(), outcome: outcome.trim(), source: 'user', confirmation: 'manual', confirmed: true, updatedAt: new Date().toISOString() });

  return <div className="border-t border-dashed border-graphite/20 p-4 sm:p-5">
    {outfit.story && <blockquote className="border-l-2 border-stamp/55 pl-4 text-sm leading-7 text-graphite/80">{outfit.story}</blockquote>}
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="border border-graphite/15 bg-kraft/45 p-3"><p className="text-sm font-medium">设计焦点</p><p className="mt-1 text-sm leading-6 text-graphite/75">{focusHighlights.length ? focusHighlights.join('、') : '这套搭配暂时没有足够的已确认设计亮点。'}</p></div>
      <div className="border border-stamp/25 bg-stamp/5 p-3"><p className="text-sm font-medium text-stamp">这套搭配的色卡</p><CompactPalette outfit={outfit} /></div>
    </div>
    <div className="mt-4">
      <p className="text-sm font-medium">关键处理</p>
      {meaningful.length ? <div className="mt-2 grid gap-2 md:grid-cols-3">{meaningful.map((decision) => <div key={decision.id} className={`border p-3 ${decision.role === 'dominant' ? 'border-stamp/40 bg-stamp/5' : 'border-graphite/15 bg-white/55'}`}><p className="text-xs text-stamp">{OPERATION_LABELS[decision.operation] || decision.operation}</p><p className="mt-2 text-sm leading-6">{decision.action}</p><p className="mt-2 text-xs leading-5 text-graphite/65">结果：{decision.effect}</p></div>)}</div> : <p className="mt-2 border border-dashed border-graphite/25 p-3 text-sm leading-6 text-graphite/65">当前还不能从字段确认具体处理。原始搭配说明仍被保留。</p>}
    </div>

    <div className="mt-5 border border-graphite/20 bg-tag/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-medium">这套搭配的意图</h4><p className="mt-1 text-xs leading-5 text-graphite/60">Kimi for coding 只读取这套搭配的说明、确认字段和现有机制。你可以直接修改。</p></div><button type="button" disabled={drafting} onClick={() => void draftWithKimi()} className="inline-flex min-h-10 items-center gap-2 border border-graphite/25 bg-white px-3 text-sm disabled:opacity-45">{drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Kimi 填写</button></div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">{[['想突出什么', focus, setFocus], ['想处理什么', problem, setProblem], ['最后效果', outcome, setOutcome]].map(([label, value, setter]) => <label key={label as string} className="text-xs text-graphite/60">{label as string}<textarea value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} rows={3} className="mt-1 block w-full resize-y border border-graphite/20 bg-white p-2 text-sm leading-5 text-ink outline-none focus:border-stamp" /></label>)}</div>
      {message && <p className="mt-2 text-xs leading-5 text-stamp">{message}</p>}
      <button type="button" onClick={manualSave} className="mt-3 min-h-10 bg-ink px-4 text-sm text-white">保存我的修改</button>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">{outfit.primaryItems.map((item) => <button type="button" key={`${item.slot}:${item.itemId}`} onClick={() => navigate(`/item/${item.itemId}`)} className="border border-graphite/20 bg-white/60 px-2.5 py-1.5 text-xs hover:border-stamp hover:text-stamp">{item.itemName}</button>)}</div>
    <EvidenceDrawer run={run} ids={[...outfit.relations.flatMap((entry) => entry.evidenceIds), ...meaningful.flatMap((entry) => entry.evidenceIds)]} />
  </div>;
}

function SubstitutionDetail({ contract, run }: { contract: SubstitutionContract; run: AnalysisRun }) {
  const navigate = useNavigate();
  return <div className="border-t border-dashed border-graphite/20 p-4 sm:p-5">
    <p className="text-sm leading-6"><strong>已记录：</strong>{contract.contextMatchIds.length} 套搭配，{contract.contextAnchorIds.length} 件核心外衣。</p>
    <div className="mt-4 grid gap-4 md:grid-cols-3"><div><p className="text-sm font-medium">必须保持</p><p className="mt-1 text-sm leading-6 text-graphite/70">{contract.invariants.join('；') || '暂时没有足够字段确认'}</p></div><div><p className="text-sm font-medium">可以变化</p><p className="mt-1 text-sm leading-6 text-graphite/70">{contract.allowedChanges.join('；') || '暂时没有明显差异'}</p></div><div><p className="text-sm font-medium">适用边界</p><p className="mt-1 text-sm leading-6 text-graphite/70">{contract.boundary}</p></div></div>
    {contract.effectChanges.length > 0 && <p className="mt-4 border-l-2 border-stamp/40 pl-3 text-sm leading-6 text-graphite/75">替换后：{contract.effectChanges.join('；')}</p>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => navigate(`/item/${contract.fromItemId}`)} className="border border-graphite/20 px-3 py-2 text-xs">查看 {contract.fromItemName}</button><button type="button" onClick={() => navigate(`/item/${contract.toItemId}`)} className="border border-graphite/20 px-3 py-2 text-xs">查看 {contract.toItemName}</button></div>
    <EvidenceDrawer run={run} ids={contract.evidenceIds} />
  </div>;
}

function WearFeedbackPanel({ records, run, onSaved }: { records: QuickWearRecord[]; run: AnalysisRun; onSaved: () => void }) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const pending = records.filter((entry) => entry.state === 'selected').slice(0, 5);
  const update = (record: QuickWearRecord, state: QuickWearRecord['state']) => {
    const reason = reasons[record.id]?.trim();
    if (state === 'unsatisfied' && !reason) return;
    saveQuickWearRecord({ ...record, state, reason, selectedAt: new Date().toISOString() });
    onSaved();
  };

  return <section>
    <h2 className="font-story text-2xl font-semibold">上次选的搭配，后来穿了吗</h2>
    <p className="mt-1 text-sm leading-6 text-graphite/65">真实穿着结果会成为规则证据。负面反馈先只约束这套具体搭配。</p>
    <div className="mt-3 space-y-3">
      {pending.map((record) => {
        const outfit = run.outfitCases.find((entry) => entry.matchId === record.matchId);
        return <article key={record.id} className="border border-graphite/20 bg-tag/65 p-4">
          <p className="text-sm font-medium">{outfit?.name || '已选择的搭配'}</p>
          <p className="mt-1 text-xs text-graphite/55">选择于 {new Date(record.selectedAt).toLocaleString('zh-CN')}</p>
          <input value={reasons[record.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [record.id]: event.target.value }))} placeholder="不满意时，请写下具体原因" className="mt-3 min-h-10 w-full border border-graphite/20 bg-white px-3 text-sm outline-none focus:border-stamp" />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button type="button" onClick={() => update(record, 'satisfied')} className="min-h-10 bg-ink px-2 text-xs text-white">穿了，很合适</button>
            <button type="button" onClick={() => update(record, 'unsatisfied')} disabled={!reasons[record.id]?.trim()} className="min-h-10 border border-stamp px-2 text-xs text-stamp disabled:opacity-40">穿了，不合适</button>
            <button type="button" onClick={() => update(record, 'not_worn')} className="min-h-10 border border-graphite/25 px-2 text-xs">最后没穿</button>
          </div>
        </article>;
      })}
      {!pending.length && <p className="border border-dashed border-graphite/25 p-5 text-sm text-graphite/65">最近没有等待确认的穿着记录。</p>}
    </div>
  </section>;
}

export function AestheticProfilePage() {
  const navigate = useNavigate();
  const { items, loading: itemsLoading } = useWardrobe();
  const { matches, loading: matchesLoading } = useBestMatches();
  const [analyses, setAnalyses] = useState<VisionAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('principles');
  const [expanded, setExpanded] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const [quickRecords, setQuickRecords] = useState<QuickWearRecord[]>(() => listQuickWearRecords());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listVisionAnalyses().then((next) => { if (alive) setAnalyses(next); }).catch(() => { if (alive) setNotice('视觉字段暂时没能读取；搭配结构仍然可以查看。'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const snapshot = useMemo(() => liveAestheticSnapshot(items, matches, analyses), [items, matches, analyses]);
  const run = useMemo(() => buildLiveAestheticRun(snapshot), [snapshot, refresh]);
  const confirmedCount = analyses.filter((entry) => entry.status === 'confirmed').length;
  const proposed = analyses.filter((entry) => entry.status === 'proposed');
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const saveReview = (questionId: string, choice: string) => {
    const current = readFeedback();
    const next = [...current.filter((entry) => !(entry.targetType === 'review' && entry.targetId === questionId)), { id: `feedback:review:${questionId}`, targetType: 'review' as const, targetId: questionId, choice, updatedAt: new Date().toISOString() }];
    window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
    setNotice('已经记下。下一次计算会读取这条人工判断。');
    setRefresh((value) => value + 1);
  };

  if (loading || itemsLoading || matchesLoading) return <div className="grid min-h-[55vh] place-items-center"><div className="text-center text-sm text-graphite/60"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />正在把衣橱记录整理成穿衣规律…</div></div>;

  return <section className="mx-auto max-w-6xl pb-14">
    <header className="grid gap-5 border-b border-dashed border-graphite/25 pb-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
      <div><p className="font-tag text-[10px] uppercase tracking-[0.24em] text-stamp">Aesthetic profile</p><h1 className="mt-2 font-story text-4xl font-semibold leading-tight">你的穿衣方法</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-graphite/75">从你确认过的单品字段、Best Match、变体和文字说明里整理。每条规律都能回到具体搭配。</p></div>
      <dl className="grid grid-cols-3 border border-graphite/20 bg-tag/65 text-center"><div className="p-3"><dt className="text-[10px] text-graphite/50">确认字段</dt><dd className="mt-1 text-xl font-semibold">{confirmedCount}</dd></div><div className="border-x border-graphite/15 p-3"><dt className="text-[10px] text-graphite/50">Best Match</dt><dd className="mt-1 text-xl font-semibold">{run.outfitCases.length}</dd></div><div className="p-3"><dt className="text-[10px] text-graphite/50">可追溯规律</dt><dd className="mt-1 text-xl font-semibold">{run.principles.length}</dd></div></dl>
    </header>

    <nav className="sticky top-0 z-20 -mx-3.5 mt-4 border-y border-graphite/15 bg-kraft/95 px-3.5 py-2 backdrop-blur sm:mx-0 sm:px-0" aria-label="审美档案导航"><div className="flex flex-wrap gap-1">{(Object.keys(VIEW_LABELS) as View[]).map((key) => <button type="button" key={key} onClick={() => { setView(key); setExpanded(''); }} className={`min-h-10 border px-3 text-sm ${view === key ? 'border-ink bg-ink text-white' : 'border-transparent text-graphite hover:border-graphite/25 hover:text-ink'}`}>{VIEW_LABELS[key]}</button>)}</div></nav>
    {notice && <p className="mt-4 border-l-2 border-stamp pl-3 text-sm leading-6 text-stamp">{notice}</p>}

    {view === 'principles' && <div className="mt-5 space-y-6">
      <div className="grid gap-3 lg:grid-cols-2">{run.principles.slice(0, 7).map((principle) => <article key={principle.id} className={`border bg-tag/65 ${expanded === principle.id ? 'border-stamp lg:col-span-2' : 'border-graphite/20'}`}>
        <button type="button" onClick={() => setExpanded((value) => value === principle.id ? '' : principle.id)} className="flex w-full items-start justify-between gap-4 p-4 text-left sm:p-5"><div><div className="flex flex-wrap items-center gap-2"><span className="border border-stamp/25 bg-stamp/5 px-2 py-1 text-[10px] text-stamp">{PRINCIPLE_LABELS[principle.kind]}</span><span className="text-[10px] text-graphite/50">{principle.supportMatchIds.length} 套案例 · 确认 {percent(principle.confirmedCoverage)}</span></div><h2 className="mt-3 font-story text-xl font-semibold">{principle.title}</h2><p className="mt-2 text-sm leading-7 text-graphite/80">{principle.statement}</p></div>{expanded === principle.id ? <ChevronDown className="mt-1 h-4 w-4 shrink-0" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0" />}</button>
        {expanded === principle.id && <div className="grid gap-4 border-t border-dashed border-graphite/20 p-4 md:grid-cols-3 sm:p-5"><div><p className="text-xs text-stamp">适用条件</p><p className="mt-1 text-sm leading-6">{principle.condition}</p></div><div><p className="text-xs text-stamp">常用处理</p><p className="mt-1 text-sm leading-6">{principle.mechanism}</p></div><div><p className="text-xs text-stamp">形成的效果</p><p className="mt-1 text-sm leading-6">{principle.effect}</p></div><div className="md:col-span-3"><p className="text-xs text-graphite/55">对应搭配</p><div className="mt-2 flex flex-wrap gap-2">{principle.representativeMatchIds.map((id) => <button type="button" key={id} onClick={() => { setView('cases'); setExpanded(id); }} className="border border-graphite/20 bg-white px-3 py-2 text-xs hover:border-stamp hover:text-stamp">{run.outfitCases.find((entry) => entry.matchId === id)?.name || '查看搭配'}</button>)}</div><EvidenceDrawer run={run} ids={principle.evidenceIds} /></div></div>}
      </article>)}</div>
      {!run.principles.length && <div className="border border-dashed border-graphite/25 p-8 text-center"><h2 className="font-story text-2xl font-semibold">还没有形成稳定规律</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-graphite/65">先确认更多单品字段并保存 Best Match。数据不足时，这里不会用词频补结论。</p></div>}

      <div className="grid gap-4 xl:grid-cols-2"><section className="border border-graphite/20 bg-tag/60 p-4 sm:p-5"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-stamp" /><h2 className="font-story text-xl font-semibold">设计亮点怎么分配</h2></div><div className="mt-3 space-y-2">{run.designHighlights.slice(0, 5).map((insight) => <button type="button" key={insight.id} onClick={() => { const id = insight.matchIds[0]; if (id) { setView('cases'); setExpanded(id); } }} className="block w-full border border-graphite/15 bg-white/60 p-3 text-left"><p className="text-sm font-medium">{insight.title}</p><p className="mt-1 text-sm leading-6 text-graphite/70">{insight.statement}</p></button>)}</div></section><section className="border border-stamp/25 bg-stamp/5 p-4 sm:p-5"><div className="flex items-center gap-2 text-stamp"><Palette className="h-4 w-4" /><h2 className="font-story text-xl font-semibold">你已经用过的配色</h2></div><div className="mt-3 space-y-2">{run.colorInsights.slice(0, 5).map((insight) => <button type="button" key={insight.id} onClick={() => { const id = insight.matchIds[0]; if (id) { setView('cases'); setExpanded(id); } }} className="block w-full border border-stamp/15 bg-white/60 p-3 text-left"><p className="text-sm font-medium">{insight.title}</p><p className="mt-1 text-sm leading-6 text-graphite/70">{insight.statement}</p><div className="mt-2 flex gap-1">{insight.evidenceIds.map((id) => run.evidence.find((entry) => entry.id === id)).filter((entry) => entry?.kind === 'color').slice(0, 6).map((entry) => <span key={entry!.id} className="h-5 w-8 border border-graphite/15" style={{ backgroundColor: entry!.label.match(/#[0-9a-fA-F]{6}/)?.[0] || '#ddd8cc' }} />)}</div></button>)}</div></section></div>
    </div>}

    {view === 'cases' && <div className="mt-5 grid gap-3 md:grid-cols-2">{run.outfitCases.map((outfit) => <article key={outfit.matchId} className={`border bg-tag/65 ${expanded === outfit.matchId ? 'border-stamp md:col-span-2' : 'border-graphite/20'}`}><button type="button" onClick={() => setExpanded((value) => value === outfit.matchId ? '' : outfit.matchId)} className="flex w-full items-center justify-between gap-3 p-3 text-left"><div className="min-w-0"><h2 className="truncate font-story text-lg font-semibold">{outfit.name}</h2><p className="mt-1 truncate text-xs text-graphite/55">核心外衣 · {outfit.anchorItemName} · 确认 {percent(outfit.evidenceCoverage)}</p></div>{expanded === outfit.matchId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>{expanded === outfit.matchId && <OutfitDetail outfit={outfit} run={run} onRefresh={() => setRefresh((value) => value + 1)} />}</article>)}</div>}

    {view === 'substitutions' && <div className="mt-5 grid gap-3 md:grid-cols-2">{run.substitutions.map((contract) => <article key={contract.id} className={`border bg-tag/65 ${expanded === contract.id ? 'border-stamp md:col-span-2' : 'border-graphite/20'}`}><button type="button" onClick={() => setExpanded((value) => value === contract.id ? '' : contract.id)} className="flex w-full items-center justify-between gap-3 p-3 text-left"><div className="min-w-0"><h2 className="truncate text-sm font-medium">{contract.fromItemName} <ArrowRight className="mx-1 inline h-3.5 w-3.5" /> {contract.toItemName}</h2><p className="mt-1 text-xs text-graphite/55">{contract.slot} · {contract.contextMatchIds.length} 套搭配{contract.repeated ? ' · 重复出现' : ''}</p></div>{expanded === contract.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>{expanded === contract.id && <SubstitutionDetail contract={contract} run={run} />}</article>)}</div>}

    {view === 'calibration' && <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <WearFeedbackPanel records={quickRecords} run={run} onSaved={() => { setQuickRecords(listQuickWearRecords()); setNotice('实穿结果已经记下，并进入下一次规则计算。'); setRefresh((value) => value + 1); }} />
      <section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-story text-2xl font-semibold">需要你确认的字段</h2><p className="mt-1 text-sm leading-6 text-graphite/65">AI 解析只生成候选。进入单品后可以修改颜色、材质、廓形、风格和设计亮点。</p></div><span className="text-sm text-stamp">{proposed.length} 件待确认</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{proposed.map((analysis) => { const item = itemMap.get(analysis.itemId); return <button type="button" key={analysis.id} onClick={() => navigate(`/item/${analysis.itemId}`)} className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 border border-graphite/20 bg-tag/65 p-2 text-left">{item?.imageUrl ? <img src={resolveMediaUrl(item.imageUrl)} alt="" className="h-16 w-14 object-cover" /> : <span className="grid h-16 w-14 place-items-center bg-kraft text-xs text-graphite/40">无图</span>}<span className="min-w-0"><span className="block truncate text-sm font-medium">{item?.name || analysis.itemId}</span><span className="mt-1 block text-xs text-graphite/55">{analysis.payload.designHighlights.length} 个设计亮点 · {analysis.payload.dominantColors.length} 个颜色</span></span><ArrowRight className="h-4 w-4 text-stamp" /></button>; })}</div>{!proposed.length && <p className="mt-3 border border-dashed border-graphite/25 p-5 text-sm text-graphite/65">当前没有待确认字段。你仍可在任意单品详情重新解析或修改。</p>}</section>
      <section><h2 className="font-story text-2xl font-semibold">帮系统弄清楚</h2><p className="mt-1 text-sm leading-6 text-graphite/65">每次只问会改变规则边界的问题。你的选择会作为人工判断保留。</p><div className="mt-3 space-y-3">{run.reviewQuestions.slice(0, 5).map((question) => <article key={question.id} className="border border-graphite/20 bg-tag/65 p-4"><p className="text-sm font-medium leading-6">{question.question}</p><p className="mt-1 text-xs leading-5 text-graphite/60">{question.context}</p><div className="mt-3 grid gap-2">{question.options.map((option) => <button type="button" key={option} onClick={() => saveReview(question.id, option)} className="min-h-10 border border-graphite/20 bg-white px-3 text-left text-xs hover:border-stamp hover:text-stamp"><Check className="mr-1 inline h-3 w-3" />{option}</button>)}</div></article>)}</div></section>
      <section className="border-t border-dashed border-graphite/25 pt-5 lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-story text-xl font-semibold">模型与规则边界</h2><p className="mt-1 text-sm leading-6 text-graphite/65">图片和搭配意图使用 Kimi for coding。正式规律仍由本地规则引擎根据确认字段、Best Match、变体与人工判断计算。</p></div><button type="button" onClick={() => setRefresh((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 border border-graphite/25 bg-white px-3 text-sm"><RefreshCw className="h-4 w-4" />重新计算</button></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><div className="border border-graphite/15 bg-tag/55 p-3"><ScanText className="h-4 w-4 text-stamp" /><p className="mt-2 text-sm font-medium">AI 提取</p><p className="mt-1 text-xs leading-5 text-graphite/60">只给出候选字段或搭配意图，保留来源。</p></div><div className="border border-graphite/15 bg-tag/55 p-3"><Check className="h-4 w-4 text-stamp" /><p className="mt-2 text-sm font-medium">人工确认</p><p className="mt-1 text-xs leading-5 text-graphite/60">修改后的内容以用户来源写入，AI 不反向覆盖。</p></div><div className="border border-graphite/15 bg-tag/55 p-3"><Sparkles className="h-4 w-4 text-stamp" /><p className="mt-2 text-sm font-medium">规则计算</p><p className="mt-1 text-xs leading-5 text-graphite/60">直接复用 {run.engineVersion} 的 DecisionMechanism。</p></div></div></section>
    </div>}
  </section>;
}
