import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { WardrobeItem } from '../types';
import {
  analyzeVision,
  getVisionConsent,
  grantVisionConsent,
  initialVisionPayload,
  listVisionAnalyses,
  updateVisionReview,
  type VisionAnalysis,
  type VisionColor,
  type VisionPayload,
  type VisionTag,
} from '../lib/aestheticVision';
import { AestheticColorField } from './AestheticColorField';

const TAG_FIELDS: Array<{ key: keyof Pick<VisionPayload, 'silhouetteTags' | 'materialTags' | 'patternTags' | 'styleTags' | 'designHighlights'>; label: string; hint: string }> = [
  { key: 'silhouetteTags', label: '廓形', hint: '宽松、短款、收腰等' },
  { key: 'materialTags', label: '材质', hint: '棉、机能面料、粗花呢等' },
  { key: 'patternTags', label: '图案', hint: '纯色、条纹、印花等' },
  { key: 'styleTags', label: '风格', hint: '机能、学院、复古等' },
  { key: 'designHighlights', label: '设计亮点', hint: '特殊口袋、拼接、裁片、五金等' },
];

const ROLE_LABELS: Record<VisionColor['role'], string> = {
  dominant: '主色',
  secondary: '辅色',
  accent: '点缀色',
};

function clonePayload(payload?: VisionPayload): VisionPayload {
  return JSON.parse(JSON.stringify(payload || initialVisionPayload())) as VisionPayload;
}

function tagsToText(tags: VisionTag[]) {
  return tags.map((tag) => tag.value).join('，');
}

function textToTags(value: string): VisionTag[] {
  return value.split(/[，,]/).map((entry) => entry.trim()).filter(Boolean).map((entry) => ({
    value: entry,
    confidence: 1,
    evidence: '用户修正',
    source: 'user' as const,
  }));
}

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

export function ItemAestheticPanel({ item }: { item: WardrobeItem }) {
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [draft, setDraft] = useState<VisionPayload>(() => initialVisionPayload());
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getVisionConsent(), listVisionAnalyses()]).then(([consent, analyses]) => {
      if (!alive) return;
      const current = analyses.find((entry) => entry.itemId === item.id) || null;
      setConsented(Boolean(consent && !consent.revoked_at));
      setAnalysis(current);
      setDraft(clonePayload(current?.payload));
    }).catch((reason) => {
      if (alive) setError(reason instanceof Error ? reason.message : '没能读取这件衣服的设计信息');
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [item.id]);

  const confirmed = analysis?.status === 'confirmed';
  const hasFields = useMemo(() => TAG_FIELDS.some(({ key }) => draft[key].length > 0)
    || draft.dominantColors.length > 0 || Boolean(draft.visualWeight || draft.formality), [draft]);

  const runAnalysis = async () => {
    if (!item.imageUrl) { setError('先给这件衣服添加图片，再让 AI 识别。'); return; }
    setWorking(true);
    setError('');
    setNotice('');
    try {
      if (!consented) {
        await grantVisionConsent();
        setConsented(true);
      }
      const next = await analyzeVision(item);
      setAnalysis(next);
      setDraft(clonePayload(next.payload));
      setEditing(true);
      setNotice('AI 已整理出一版设计信息，请检查后确认。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI 识别失败，请稍后重试');
    } finally {
      setWorking(false);
    }
  };

  const save = async (status: 'confirmed' | 'rejected') => {
    if (!analysis) return;
    setWorking(true);
    setError('');
    try {
      const next = await updateVisionReview(analysis, draft, status);
      setAnalysis(next);
      setDraft(clonePayload(next.payload));
      setEditing(status !== 'confirmed');
      setNotice(status === 'confirmed' ? '这些设计信息已经记在这件衣服上，并会用于整理你的搭配规律。' : '已拒绝本次结果，它不会进入正式搭配规律。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试');
    } finally {
      setWorking(false);
    }
  };

  const updateTagField = (key: typeof TAG_FIELDS[number]['key'], value: string) => {
    setDraft((current) => ({ ...current, [key]: textToTags(value) }));
  };

  const updateColor = (index: number, patch: Partial<VisionColor>) => {
    setDraft((current) => ({ ...current, dominantColors: current.dominantColors.map((color, colorIndex) => colorIndex === index ? { ...color, ...patch } : color) }));
  };

  const addColor = () => setDraft((current) => ({
    ...current,
    dominantColors: [...current.dominantColors, {
      rgb: [128, 128, 128], hex: '#808080', role: 'secondary', areaRatio: 0, region: 'garment', confidence: 1, source: 'user',
    }],
  }));

  if (loading) return <div className="mt-8 border-t border-dashed border-graphite/25 pt-6 text-sm text-graphite/60"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />正在读取这件衣服的设计信息…</div>;

  return (
    <section id="item-aesthetic-panel" className="mt-8 scroll-mt-20 border-t border-dashed border-graphite/25 pt-6" aria-labelledby="item-aesthetic-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-tag text-[10px] uppercase tracking-[0.2em] text-stamp">Aesthetic fields</p>
          <h2 id="item-aesthetic-title" className="mt-1 font-story text-xl font-semibold text-ink">这件衣服的设计档案</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-graphite/70">廓形、材质、颜色和设计亮点会参与搭配规律。AI 先整理一版，你确认或修改后才会正式用于分析。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {analysis && <button type="button" onClick={() => setEditing((value) => !value)} className="min-h-10 border border-graphite/25 bg-tag px-3 text-sm text-ink">{editing ? '收起修改' : '修改设计信息'}</button>}
          <details className="relative">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 border border-graphite/20 bg-white/70 px-3 text-sm text-graphite">设计信息来源与管理</summary>
            <div className="absolute right-0 z-10 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-graphite/20 bg-kraft p-3 shadow-lg">
              <p className="text-xs leading-5 text-graphite/70">AI 在后台只整理待确认内容；这里可以查看来源、重新请求或处理授权。确认后的内容才会进入搭配规律。</p>
              {!consented && !analysis && <p className="mt-2 border-l-2 border-stamp/50 pl-2 text-xs leading-5 text-stamp">发送图片前需要你的同意；不会发送故事、评分或完整衣橱。</p>}
              <button type="button" disabled={working || !item.imageUrl} onClick={() => void runAnalysis()} className="mt-3 inline-flex min-h-10 items-center gap-2 bg-ink px-3 text-sm text-white disabled:opacity-45">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : analysis ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {analysis ? '重新整理设计信息' : '让 AI 整理一版'}
              </button>
            </div>
          </details>
        </div>
      </div>

      {notice && <p className="mt-4 border-l-2 border-emerald-700 pl-3 text-sm leading-6 text-emerald-900">{notice}</p>}
      {error && <p className="mt-4 border-l-2 border-stamp pl-3 text-sm leading-6 text-stamp">{error}</p>}

      {analysis && !editing && hasFields && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="border border-graphite/15 bg-tag/70 p-4">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">结构与风格</h3><span className={`text-xs ${confirmed ? 'text-emerald-800' : 'text-stamp'}`}>{confirmed ? '已确认' : '待确认'}</span></div>
            <dl className="mt-3 space-y-2 text-sm leading-6">
              {TAG_FIELDS.map(({ key, label }) => draft[key].length > 0 && <div key={key} className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-graphite/55">{label}</dt><dd>{draft[key].map((tag) => tag.value).join('、')}</dd></div>)}
              {draft.visualWeight && <div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-graphite/55">视觉重量</dt><dd>{draft.visualWeight.value}</dd></div>}
              {draft.formality && <div className="grid grid-cols-[72px_1fr] gap-2"><dt className="text-graphite/55">正式度</dt><dd>{draft.formality.value}</dd></div>}
            </dl>
          </div>
          <div className="border border-stamp/25 bg-stamp/5 p-4">
            <h3 className="text-sm font-medium text-stamp">单品色卡</h3>
            <div className="mt-3 flex flex-wrap gap-3">{draft.dominantColors.map((color, index) => <div key={`${color.hex}:${index}`} className="min-w-20"><span className="block h-10 border border-graphite/15" style={{ backgroundColor: color.hex || rgbToHex(color.rgb) }} /><span className="mt-1 block text-xs text-graphite/65">{ROLE_LABELS[color.role]} · {color.rgb.join(', ')}</span></div>)}</div>
          </div>
        </div>
      )}

      {analysis && editing && (
        <div className="mt-5 border border-graphite/20 bg-tag/75 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {TAG_FIELDS.map(({ key, label, hint }) => <label key={key} className="text-sm text-graphite/70"><span className="font-medium text-ink">{label}</span><input value={tagsToText(draft[key])} onChange={(event) => updateTagField(key, event.target.value)} placeholder={hint} className="mt-1 block min-h-11 w-full border border-graphite/20 bg-white px-3 text-sm text-ink outline-none focus:border-stamp" /></label>)}
            <label className="text-sm text-graphite/70"><span className="font-medium text-ink">视觉重量</span><input value={draft.visualWeight?.value || ''} onChange={(event) => setDraft((current) => ({ ...current, visualWeight: event.target.value ? { value: event.target.value, confidence: 1, evidence: '用户修正', source: 'user' } : null }))} placeholder="轻盈、中等、厚重，或你的描述" className="mt-1 block min-h-11 w-full border border-graphite/20 bg-white px-3 text-sm text-ink outline-none focus:border-stamp" /></label>
            <label className="text-sm text-graphite/70"><span className="font-medium text-ink">正式度</span><input value={draft.formality?.value || ''} onChange={(event) => setDraft((current) => ({ ...current, formality: event.target.value ? { value: event.target.value, confidence: 1, evidence: '用户修正', source: 'user' } : null }))} placeholder="休闲、日常、正式，或你的描述" className="mt-1 block min-h-11 w-full border border-graphite/20 bg-white px-3 text-sm text-ink outline-none focus:border-stamp" /></label>
          </div>

          <div className="mt-5 border-t border-dashed border-graphite/20 pt-4">
            <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium">颜色</h3><p className="mt-1 text-xs text-graphite/60">可自由选色、调整主辅关系，也可以添加或删除。</p></div><button type="button" onClick={addColor} className="inline-flex min-h-10 items-center gap-1 border border-graphite/25 bg-white px-3 text-sm"><Plus className="h-4 w-4" />添加颜色</button></div>
            <div className="mt-3 grid gap-2">{draft.dominantColors.map((color, index) => <AestheticColorField key={index} color={color} onChange={(next) => updateColor(index, next)} onRemove={() => setDraft((current) => ({ ...current, dominantColors: current.dominantColors.filter((_, colorIndex) => colorIndex !== index) }))} />)}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" disabled={working} onClick={() => void save('confirmed')} className="inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm text-white disabled:opacity-50"><Check className="h-4 w-4" />确认并用于搭配规律</button>
            <button type="button" disabled={working} onClick={() => void save('rejected')} className="min-h-11 border border-stamp px-4 text-sm text-stamp disabled:opacity-50">拒绝本次结果</button>
          </div>
        </div>
      )}
    </section>
  );
}
