import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  Image as ImageIcon,
  Loader2,
  Palette,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useBestMatches } from '../contexts/BestMatchContext';
import { resolveMediaUrl } from '../lib/media';
import {
  analyzeVision,
  getVisionConsent,
  grantVisionConsent,
  initialVisionPayload,
  listVisionAnalyses,
  listVisionRevisions,
  revokeVisionConsent,
  updateVisionReview,
  type VisionAnalysis,
  type VisionColor,
  type VisionPayload,
  type VisionStatus,
  type VisionTag,
} from '../lib/aestheticVision';
import type { WardrobeItem } from '../types';

type LabStage = 'snapshot' | 'vision' | 'text' | 'relations' | 'metrics' | 'insights' | 'review';

const stages: { id: LabStage; label: string; note: string }[] = [
  { id: 'snapshot', label: '数据快照', note: '当前衣橱输入' },
  { id: 'vision', label: '图片识别', note: '廓形、颜色、材质' },
  { id: 'text', label: '文本语义', note: 'Sprint 2' },
  { id: 'relations', label: '搭配关系', note: 'Sprint 3' },
  { id: 'metrics', label: '统计指标', note: 'Sprint 3' },
  { id: 'insights', label: '洞察结论', note: 'Sprint 4' },
  { id: 'review', label: '待人工处理', note: '当前队列' },
];

const statusLabel: Record<VisionStatus, string> = {
  pending: '待处理',
  processing: '分析中',
  proposed: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
  failed: '失败',
};

const statusClass: Record<VisionStatus, string> = {
  pending: 'bg-graphite/10 text-graphite',
  processing: 'bg-stamp/10 text-stamp',
  proposed: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
  failed: 'bg-rose-100 text-rose-800',
};

function clonePayload(payload: VisionPayload): VisionPayload {
  return JSON.parse(JSON.stringify(payload)) as VisionPayload;
}

function asNumber(value: string, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function TagEditor({
  title,
  tags,
  onChange,
}: {
  title: string;
  tags: VisionTag[];
  onChange: (next: VisionTag[]) => void;
}) {
  return (
    <section className="border-t border-dashed border-graphite/20 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-tag text-[10px] uppercase tracking-[0.18em] text-graphite/70">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...tags, { value: '', confidence: 0.5, evidence: '', source: 'user' }])}
          className="text-xs text-stamp hover:underline"
        >
          + 添加
        </button>
      </div>
      {tags.length === 0 ? (
        <p className="text-xs text-graphite/55">暂无候选</p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag, index) => (
            <div key={`${title}-${index}`} className="grid grid-cols-[1fr_70px_28px] gap-2 items-center">
              <input
                value={tag.value}
                onChange={(event) => {
                  const next = tags.slice();
                  next[index] = { ...tag, value: event.target.value, source: 'user' };
                  onChange(next);
                }}
                placeholder="标签"
                className="min-h-9 border border-graphite/20 bg-white/60 px-2 text-sm outline-none focus:border-stamp"
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={tag.confidence}
                onChange={(event) => {
                  const next = tags.slice();
                  next[index] = { ...tag, confidence: Math.min(1, Math.max(0, asNumber(event.target.value, 0.5))), source: 'user' };
                  onChange(next);
                }}
                className="min-h-9 border border-graphite/20 bg-white/60 px-2 text-xs outline-none focus:border-stamp"
                aria-label={`${title}置信度`}
              />
              <button
                type="button"
                onClick={() => onChange(tags.filter((_, tagIndex) => tagIndex !== index))}
                className="flex h-9 w-7 items-center justify-center text-graphite/55 hover:text-stamp"
                aria-label="删除标签"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ColorEditor({ colors, onChange }: { colors: VisionColor[]; onChange: (next: VisionColor[]) => void }) {
  const updateColor = (index: number, patch: Partial<VisionColor>) => {
    const next = colors.slice();
    next[index] = { ...next[index], ...patch, source: 'user' };
    if (patch.rgb) {
      next[index].hex = `#${patch.rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }
    onChange(next);
  };
  return (
    <section className="border-t border-dashed border-graphite/20 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-tag text-[10px] uppercase tracking-[0.18em] text-graphite/70">颜色 / RGB</h3>
        <button
          type="button"
          onClick={() => onChange([...colors, { rgb: [128, 128, 128], hex: '#808080', role: 'accent', areaRatio: 0, region: 'unknown', confidence: 0.5, source: 'user' }])}
          className="text-xs text-stamp hover:underline"
        >
          + 添加颜色
        </button>
      </div>
      {colors.length === 0 ? <p className="text-xs text-graphite/55">暂无颜色候选</p> : (
        <div className="space-y-3">
          {colors.map((color, index) => (
            <div key={`${color.hex}-${index}`} className="border border-graphite/15 bg-white/45 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 border border-black/10" style={{ backgroundColor: color.hex }} />
                  <code className="text-xs text-graphite">{color.hex}</code>
                </div>
                <button type="button" onClick={() => onChange(colors.filter((_, colorIndex) => colorIndex !== index))} className="text-graphite/55 hover:text-stamp" aria-label="删除颜色">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['R', 'G', 'B'] as const).map((channel, channelIndex) => (
                  <label key={channel} className="text-[10px] text-graphite/65">
                    {channel}
                    <input
                      type="number"
                      min="0"
                      max="255"
                      value={color.rgb[channelIndex]}
                      onChange={(event) => {
                        const rgb = color.rgb.slice() as [number, number, number];
                        rgb[channelIndex] = Math.min(255, Math.max(0, Math.round(asNumber(event.target.value))));
                        updateColor(index, { rgb });
                      }}
                      className="mt-1 min-h-8 w-full border border-graphite/20 bg-white/60 px-2 text-xs outline-none focus:border-stamp"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-[10px] text-graphite/65">角色
                  <select value={color.role} onChange={(event) => updateColor(index, { role: event.target.value as VisionColor['role'] })} className="mt-1 min-h-8 w-full border border-graphite/20 bg-white/60 px-1 text-xs">
                    <option value="dominant">主色</option><option value="secondary">辅色</option><option value="accent">点缀</option>
                  </select>
                </label>
                <label className="text-[10px] text-graphite/65">区域
                  <select value={color.region} onChange={(event) => updateColor(index, { region: event.target.value as VisionColor['region'] })} className="mt-1 min-h-8 w-full border border-graphite/20 bg-white/60 px-1 text-xs">
                    <option value="garment">服装</option><option value="trim">装饰</option><option value="pattern">图案</option><option value="unknown">未知</option>
                  </select>
                </label>
                <label className="text-[10px] text-graphite/65">面积占比
                  <input type="number" min="0" max="1" step="0.01" value={color.areaRatio} onChange={(event) => updateColor(index, { areaRatio: Math.min(1, Math.max(0, asNumber(event.target.value))) })} className="mt-1 min-h-8 w-full border border-graphite/20 bg-white/60 px-2 text-xs outline-none focus:border-stamp" />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: VisionStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] ${statusClass[status]}`}>{statusLabel[status]}</span>;
}

export function AestheticLabPage() {
  const { items, loading: wardrobeLoading } = useWardrobe();
  const { matches } = useBestMatches();
  const [consent, setConsent] = useState<{ revoked_at: string | null } | null>(null);
  const [analyses, setAnalyses] = useState<VisionAnalysis[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VisionPayload>(initialVisionPayload());
  const [revisions, setRevisions] = useState<Record<string, any[]>>({});
  const [stage, setStage] = useState<LabStage>('vision');
  const [filter, setFilter] = useState<'all' | VisionStatus>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const analysisByItem = useMemo(() => {
    const map = new Map<string, VisionAnalysis>();
    analyses.forEach((analysis) => { if (!map.has(analysis.itemId)) map.set(analysis.itemId, analysis); });
    return map;
  }, [analyses]);
  const selectedItem = selectedItemId ? itemMap.get(selectedItemId) : undefined;
  const selectedAnalysis = selectedAnalysisId ? analyses.find((analysis) => analysis.id === selectedAnalysisId) : undefined;
  const reviewQueue = analyses.filter((analysis) => analysis.status === 'proposed' || analysis.status === 'failed');
  const visibleItems = items.filter((item) => filter === 'all' || analysisByItem.get(item.id)?.status === filter);

  const refresh = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [nextConsent, nextAnalyses] = await Promise.all([getVisionConsent(), listVisionAnalyses()]);
      setConsent(nextConsent);
      setAnalyses(nextAnalyses);
      if (!selectedItemId) setSelectedItemId(items.find((item) => item.imageUrl)?.id ?? items[0]?.id ?? null);
      if (!selectedAnalysisId && nextAnalyses[0]) {
        setSelectedAnalysisId(nextAnalyses[0].id);
        setDraft(clonePayload(nextAnalyses[0].payload));
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法读取审美实验台数据；请先执行 Sprint 1 migration。');
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => { void refresh(true); }, [items.length]);

  const selectItem = (item: WardrobeItem) => {
    setSelectedItemId(item.id);
    const next = analysisByItem.get(item.id);
    setSelectedAnalysisId(next?.id ?? null);
    setDraft(next ? clonePayload(next.payload) : initialVisionPayload());
    setNotice(null);
  };

  const selectAnalysis = async (analysis: VisionAnalysis) => {
    setSelectedItemId(analysis.itemId);
    setSelectedAnalysisId(analysis.id);
    setDraft(clonePayload(analysis.payload));
    if (!revisions[analysis.id]) {
      try {
        const next = await listVisionRevisions(analysis.id);
        setRevisions((current) => ({ ...current, [analysis.id]: next }));
      } catch { /* Keep the review surface usable if history is temporarily unavailable. */ }
    }
  };

  const handleGrantConsent = async () => {
    setBusy('consent'); setError(null);
    try { setConsent(await grantVisionConsent()); setNotice('已同意图片识别。分析结果会先进入待确认，不会直接成为你的审美事实。'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '同意状态保存失败'); }
    finally { setBusy(null); }
  };

  const handleRevokeConsent = async () => {
    setBusy('revoke'); setError(null);
    try { await revokeVisionConsent(); setConsent((current) => current ? { ...current, revoked_at: new Date().toISOString() } : current); setNotice('已撤回未来图片识别同意；已有候选仍保留，便于你查看和删除。'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '撤回失败'); }
    finally { setBusy(null); }
  };

  const handleAnalyze = async (item: WardrobeItem) => {
    setBusy(`analyze:${item.id}`); setError(null); setNotice(null);
    try {
      const next = await analyzeVision(item);
      await refresh();
      await selectAnalysis(next);
      setNotice('图片分析完成，候选属性已进入待确认。');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '图片识别失败'); }
    finally { setBusy(null); }
  };

  const handleReview = async (status: 'confirmed' | 'rejected') => {
    if (!selectedAnalysis) return;
    setBusy(`review:${selectedAnalysis.id}`); setError(null); setNotice(null);
    try {
      const next = await updateVisionReview(selectedAnalysis, draft, status);
      setAnalyses((current) => current.map((analysis) => analysis.id === next.id ? next : analysis));
      setSelectedAnalysisId(next.id); setDraft(clonePayload(next.payload));
      setNotice(status === 'confirmed' ? '已确认：这些视觉字段现在可以进入审美基座。' : '已拒绝：这组视觉候选不会参与画像或推荐。');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存人工确认失败'); }
    finally { setBusy(null); }
  };

  const activeConsent = !!consent && !consent.revoked_at;
  const selectedRelatedMatches = selectedItemId ? matches.filter((match) => match.allItemIds.includes(selectedItemId)) : [];
  const relatedItemCounts = selectedItemId ? matches.reduce((counts, match) => {
    if (!match.allItemIds.includes(selectedItemId)) return counts;
    match.allItemIds.filter((itemId) => itemId !== selectedItemId).forEach((itemId) => counts.set(itemId, (counts.get(itemId) ?? 0) + 1));
    return counts;
  }, new Map<string, number>()) : new Map<string, number>();
  const strongestRelatedItems = [...relatedItemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const downloadSnapshot = () => {
    const payload = {
      schemaVersion: 'aesthetic-lab-snapshot-v1',
      exportedAt: new Date().toISOString(),
      ownerScope: 'current-authenticated-user',
      wardrobeItems: items.map((item) => ({ ...item, imageUrl: item.imageUrl?.startsWith('data:') ? '[data-url omitted]' : item.imageUrl })),
      bestMatches: matches,
      visionAnalyses: analyses,
      visionConsent: consent,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wearlog-aesthetic-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('数据快照已下载到本地。');
  };

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-col gap-4 border-b border-dashed border-graphite/25 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-tag text-[10px] uppercase tracking-[0.28em] text-stamp">AESTHETIC LAB / SPRINT 1</p>
          <h1 className="mt-2 font-story text-3xl font-bold tracking-tight text-ink sm:text-4xl">审美关系基座</h1>
          <p className="mt-2 max-w-2xl font-story text-sm leading-relaxed text-graphite">先看见，再确认。这里展示图片识别候选、RGB 颜色、数据状态和人工介入点；未经 Victor 确认的内容不会进入正式画像。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={downloadSnapshot} className="inline-flex min-h-10 items-center gap-2 border border-graphite/25 bg-white/45 px-3 py-2 text-xs text-graphite hover:border-graphite/50 hover:text-ink"><Download className="h-3.5 w-3.5" />下载数据快照</button><span className="inline-flex items-center gap-2 text-xs text-graphite/70"><Eye className="h-4 w-4" /> 仅本人可见的工作台</span></div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="space-y-1">
          {stages.map((current, index) => (
            <button
              type="button"
              key={current.id}
              onClick={() => setStage(current.id)}
              className={`group flex w-full items-start gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${stage === current.id ? 'border-stamp bg-stamp/5 text-ink' : 'border-graphite/15 text-graphite/65 hover:border-graphite/40 hover:text-ink'}`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${stage === current.id ? 'bg-stamp text-white' : 'bg-graphite/10 text-graphite/70'}`}>{index + 1}</span>
              <span><span className="block text-sm font-medium">{current.label}</span><span className="mt-0.5 block text-[10px] text-graphite/50">{current.note}</span></span>
            </button>
          ))}
          <div className="mt-5 border-t border-dashed border-graphite/20 pt-4 text-[11px] leading-relaxed text-graphite/60">
            <p className="font-medium text-ink">当前闸门</p>
            <p className="mt-1">图片字段先形成候选，必须经过人工确认。</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {!activeConsent ? (
            <div className="flex flex-col gap-4 border border-stamp/30 bg-stamp/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-stamp" /><div><h2 className="font-story text-lg font-semibold text-ink">启用图片识别前，请先确认</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-graphite">图片会发送到衣LOG配置的视觉模型服务，只用于生成服装视觉候选。每个结果都会先进入“待确认”，你可以逐字段修改或拒绝。</p></div></div>
              <button type="button" onClick={handleGrantConsent} disabled={busy === 'consent'} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-ink px-5 py-2.5 text-sm text-white disabled:opacity-50">{busy === 'consent' && <Loader2 className="h-4 w-4 animate-spin" />}同意并开始</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-700/20 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> 图片识别已启用；候选结果仍需人工确认。</span><button type="button" onClick={handleRevokeConsent} disabled={busy === 'revoke'} className="text-emerald-900/70 underline hover:text-emerald-900">撤回未来识别</button></div>
          )}

          {notice && <div className="flex items-center gap-2 border border-graphite/15 bg-white/45 px-4 py-3 text-sm text-graphite"><Check className="h-4 w-4 text-emerald-700" />{notice}</div>}
          {error && <div className="flex items-start gap-2 border border-stamp/30 bg-stamp/5 px-4 py-3 text-sm text-stamp"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <div className="grid gap-3 md:grid-cols-3">
            <div className="border border-graphite/20 bg-white/35 p-4"><p className="font-tag text-[10px] uppercase tracking-[0.18em] text-graphite/55">当前数据</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-2xl font-semibold text-ink">{items.length}</p><p className="text-xs text-graphite/60">单品</p></div><div><p className="text-2xl font-semibold text-ink">{matches.length}</p><p className="text-xs text-graphite/60">Best Match</p></div><div><p className="text-2xl font-semibold text-ink">{items.filter((item) => item.imageUrl).length}</p><p className="text-xs text-graphite/60">有图片</p></div><div><p className="text-2xl font-semibold text-ink">{analyses.filter((analysis) => analysis.status === 'confirmed').length}</p><p className="text-xs text-graphite/60">已确认视觉</p></div></div></div>
            <div className="border border-graphite/20 bg-white/35 p-4"><p className="font-tag text-[10px] uppercase tracking-[0.18em] text-graphite/55">当前关联</p><p className="mt-3 font-story text-lg font-semibold text-ink">{selectedItem ? `「${selectedItem.name || '未命名'}」` : '请选择单品'}</p><p className="mt-1 text-xs text-graphite/65">出现在 {selectedRelatedMatches.length} 套 Best Match</p>{strongestRelatedItems.length > 0 && <div className="mt-3 space-y-1">{strongestRelatedItems.map(([itemId, count]) => <p key={itemId} className="flex justify-between gap-2 text-xs text-graphite"><span className="truncate">{itemMap.get(itemId)?.name || '未知单品'}</span><span className="shrink-0">共现 {count}</span></p>)}</div>}</div>
            <div className="border border-graphite/20 bg-white/35 p-4"><p className="font-tag text-[10px] uppercase tracking-[0.18em] text-graphite/55">当前结论</p><p className="mt-3 font-story text-sm leading-relaxed text-ink">{selectedAnalysis?.status === 'confirmed' ? '这件单品已有 Victor 确认的视觉字段，可以进入后续统计和关系推导。' : selectedAnalysis ? '系统已经提出视觉候选，等待 Victor 确认；当前不会把它当作审美事实。' : '还没有视觉候选。先读取图片，才能进入审美关系基座。'}</p></div>
          </div>

          {stage !== 'vision' && stage !== 'review' ? (
            <div className="border border-dashed border-graphite/25 bg-white/35 px-6 py-16 text-center"><p className="font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/45">{stages.find((current) => current.id === stage)?.label}</p><h2 className="mt-3 font-story text-2xl font-semibold text-ink">这一节点将在后续 Sprint 开放</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-graphite">当前先完成图片视觉事实和 Victor 的确认闭环。搭配关系、统计和洞察会使用确认后的字段。</p></div>
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <section className="min-w-0 border border-graphite/20 bg-white/35">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-graphite/20 px-4 py-3"><div><p className="font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/55">Input / wardrobe items</p><h2 className="mt-1 font-story text-lg font-semibold text-ink">单品视觉样本</h2></div><select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | VisionStatus)} className="min-h-9 border border-graphite/20 bg-white/70 px-2 text-xs"><option value="all">全部状态</option>{Object.keys(statusLabel).map((status) => <option key={status} value={status}>{statusLabel[status as VisionStatus]}</option>)}</select></div>
                  <div className="max-h-[620px] overflow-y-auto">
                    {wardrobeLoading || loading ? <div className="flex items-center justify-center py-16 text-graphite/60"><Loader2 className="mr-2 h-4 w-4 animate-spin" />加载数据</div> : visibleItems.length === 0 ? <div className="px-5 py-16 text-center text-sm text-graphite/60">没有符合筛选条件的单品。</div> : visibleItems.map((item) => {
                      const analysis = analysisByItem.get(item.id);
                      const active = selectedItemId === item.id;
                      return <button key={item.id} type="button" onClick={() => selectItem(item)} className={`flex w-full items-center gap-3 border-b border-dashed border-graphite/15 px-4 py-3 text-left transition-colors ${active ? 'bg-stamp/5' : 'hover:bg-white/40'}`}><div className="h-14 w-11 shrink-0 overflow-hidden border border-graphite/15 bg-graphite/5">{item.imageUrl ? <img src={resolveMediaUrl(item.imageUrl)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-4 w-4 text-graphite/35" /></div>}</div><div className="min-w-0 flex-1"><p className="truncate font-story text-sm font-semibold text-ink">{item.name || '未命名单品'}</p><p className="mt-1 truncate text-xs text-graphite/60">{item.category}{item.brand ? ` · ${item.brand}` : ''}</p></div><div className="flex shrink-0 items-center gap-2">{analysis ? <StatusBadge status={analysis.status} /> : <span className="text-[10px] text-graphite/45">未分析</span>}<ChevronRight className="h-3.5 w-3.5 text-graphite/35" /></div></button>;
                    })}
                  </div>
                </section>

                <section className="min-w-0 border border-graphite/20 bg-white/35">
                  <div className="border-b border-dashed border-graphite/20 px-4 py-3"><p className="font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/55">Selected item</p><h2 className="mt-1 truncate font-story text-lg font-semibold text-ink">{selectedItem?.name || '选择一个有图片的单品'}</h2></div>
                  <div className="space-y-4 p-4">
                    {selectedItem?.imageUrl && <div className="flex gap-3 border border-graphite/15 bg-white/50 p-2"><img src={resolveMediaUrl(selectedItem.imageUrl)} alt={selectedItem.name} className="h-28 w-24 object-cover" /><div className="min-w-0 text-xs leading-relaxed text-graphite"><p className="font-medium text-ink">原始输入</p><p className="mt-1">{selectedItem.category}{selectedItem.brand ? ` · ${selectedItem.brand}` : ''}</p><p className="mt-2 line-clamp-4">{selectedItem.story || '没有单品故事。'}</p></div></div>}
                    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-graphite/70"><Palette className="h-4 w-4" />视觉候选</div><button type="button" disabled={!activeConsent || !selectedItem?.imageUrl || !!busy} onClick={() => selectedItem && void handleAnalyze(selectedItem)} className="inline-flex min-h-10 items-center gap-2 border border-ink bg-ink px-4 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40">{busy === `analyze:${selectedItem?.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{selectedAnalysis ? '重新识别' : '读取图片'}</button></div>
                    {!selectedAnalysis && <div className="border border-dashed border-graphite/20 px-4 py-8 text-center text-sm text-graphite/60">点击“读取图片”，生成第一版廓形、颜色、材质和风格候选。</div>}
                    {selectedAnalysis && <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-graphite/20 pb-3"><div className="flex items-center gap-2"><StatusBadge status={selectedAnalysis.status} /><span className="text-[10px] text-graphite/50">模型 {selectedAnalysis.modelVersion}</span></div><span className="text-[10px] text-graphite/50">{new Date(selectedAnalysis.updatedAt).toLocaleString()}</span></div><TagEditor title="廓形" tags={draft.silhouetteTags} onChange={(next) => setDraft((current) => ({ ...current, silhouetteTags: next }))} /><TagEditor title="材质" tags={draft.materialTags} onChange={(next) => setDraft((current) => ({ ...current, materialTags: next }))} /><TagEditor title="图案" tags={draft.patternTags} onChange={(next) => setDraft((current) => ({ ...current, patternTags: next }))} /><TagEditor title="风格候选" tags={draft.styleTags} onChange={(next) => setDraft((current) => ({ ...current, styleTags: next }))} /><TagEditor title="设计亮点" tags={draft.designHighlights} onChange={(next) => setDraft((current) => ({ ...current, designHighlights: next }))} /><ColorEditor colors={draft.dominantColors} onChange={(next) => setDraft((current) => ({ ...current, dominantColors: next }))} /><div className="grid gap-3 border-t border-dashed border-graphite/20 pt-4 sm:grid-cols-2"><ScalarEditor title="视觉重量" value={draft.visualWeight} onChange={(next) => setDraft((current) => ({ ...current, visualWeight: next }))} /><ScalarEditor title="正式度" value={draft.formality} onChange={(next) => setDraft((current) => ({ ...current, formality: next }))} /></div><div className="flex flex-wrap gap-2 border-t border-dashed border-graphite/20 pt-4"><button type="button" disabled={!!busy} onClick={() => void handleReview('confirmed')} className="inline-flex min-h-10 items-center gap-2 bg-emerald-700 px-4 py-2 text-xs text-white disabled:opacity-40"><Check className="h-3.5 w-3.5" />确认字段</button><button type="button" disabled={!!busy} onClick={() => void handleReview('rejected')} className="inline-flex min-h-10 items-center gap-2 border border-stamp/40 px-4 py-2 text-xs text-stamp disabled:opacity-40"><X className="h-3.5 w-3.5" />拒绝候选</button></div></div>}
                  </div>
                </section>
              </div>

              <section className="border border-graphite/20 bg-white/35">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-graphite/20 px-4 py-3"><div><p className="font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/55">Human review queue</p><h2 className="mt-1 font-story text-lg font-semibold text-ink">需要 Victor 介入的地方</h2></div><span className="rounded-full bg-stamp/10 px-2 py-1 text-[10px] text-stamp">{reviewQueue.length} 条待处理</span></div>
                <div className="divide-y divide-dashed divide-graphite/15">{reviewQueue.length === 0 ? <div className="px-4 py-6 text-sm text-graphite/60">当前没有待确认候选。识别一件有图片的单品后，它会出现在这里。</div> : reviewQueue.map((analysis) => { const item = itemMap.get(analysis.itemId); return <button type="button" key={analysis.id} onClick={() => void selectAnalysis(analysis)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/45"><span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{item?.name || '未知单品'}</span><span className="mt-1 block text-xs text-graphite/60">{analysis.payload.dominantColors.length} 个颜色候选 · {analysis.payload.styleTags.length} 个风格候选</span></span><StatusBadge status={analysis.status} /></button>; })}</div>
              </section>
            </>
          )}
        </section>
      </div>

      {selectedAnalysis && revisions[selectedAnalysis.id] && <details className="border border-dashed border-graphite/20 bg-white/25 px-4 py-3 text-xs text-graphite"><summary className="cursor-pointer font-medium text-ink">查看修订历史（{revisions[selectedAnalysis.id].length}）</summary><div className="mt-3 space-y-2">{revisions[selectedAnalysis.id].map((revision) => <div key={revision.id} className="flex justify-between gap-3 border-t border-graphite/10 pt-2"><span>{revision.action}</span><span>{new Date(revision.created_at).toLocaleString()}</span></div>)}</div></details>}
    </div>
  );
}

function ScalarEditor({ title, value, onChange }: { title: string; value: VisionPayload['visualWeight']; onChange: (next: VisionPayload['visualWeight']) => void }) {
  return <label className="text-[10px] text-graphite/65">{title}<input value={value?.value ?? ''} onChange={(event) => onChange(event.target.value ? { value: event.target.value, confidence: value?.confidence ?? 0.5, evidence: value?.evidence ?? '', source: 'user' } : null)} placeholder="待确认" className="mt-1 min-h-9 w-full border border-graphite/20 bg-white/60 px-2 text-sm outline-none focus:border-stamp" /></label>;
}
