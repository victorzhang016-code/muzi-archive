import { useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Loader2, Sparkles, X } from 'lucide-react';
import { Category } from '../types';
import { auth } from '../lib/authCompat';
import { createWardrobeItem } from '../lib/supabaseData';
import { compressToBase64, normalizeImageFile } from '../lib/cropImage';
import { uploadImageToBlob } from '../lib/blobUpload';

const CATEGORIES: Category[] = ['上装', '下装', '鞋子', '配饰'];
const VISION_ENABLED = import.meta.env.VITE_ONBOARDING_VISION_ENABLED === 'true';

type Status = 'idle' | 'recognizing' | 'saving' | 'success';

function extractModelText(data: any): string {
  const content = data?.choices?.[0]?.message?.content ?? data?.content;
  if (Array.isArray(content)) return content.map((part: any) => typeof part === 'string' ? part : part?.text || '').join('').trim();
  return typeof content === 'string' ? content.trim() : '';
}

function parseDraft(raw: string): { name?: string; brand?: string; category?: Category } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const data = JSON.parse(match[0].replace(/,\s*([}])/g, '$1'));
    const aliases: Record<string, Category> = { 上衣: '上装', 裤子: '下装', 鞋: '鞋子', 饰品: '配饰' };
    const category = CATEGORIES.includes(data.category) ? data.category : aliases[data.category];
    return {
      name: typeof data.name === 'string' ? data.name.trim().slice(0, 80) : undefined,
      brand: typeof data.brand === 'string' ? data.brand.trim().slice(0, 40) : undefined,
      category,
    };
  } catch {
    return {};
  }
}

interface QuickAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function QuickAddItemModal({ isOpen, onClose, onSaved }: QuickAddItemModalProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<Category>('上装');
  const [imageData, setImageData] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setName(''); setBrand(''); setCategory('上装'); setImageData(null);
    setStatus('idle'); setError(null); setHint(null);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(null); setHint(null); setStatus('recognizing');
    try {
      const normalized = await normalizeImageFile(file);
      const compressed = await compressToBase64(normalized, 900, 0.82);
      setImageData(compressed);

      if (VISION_ENABLED && auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/ai-import', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: 'vision', task: 'wardrobe_item_draft', image: compressed }),
        });
        if (response.ok) {
          const draft = parseDraft(extractModelText(await response.json()));
          if (draft.name) setName(draft.name);
          if (draft.brand) setBrand(draft.brand);
          if (draft.category) setCategory(draft.category);
          if (draft.name || draft.category) setHint('已根据照片填好基础信息，你可以直接修改。');
        } else {
          setHint('照片已添加，可以手动补充名称和品类。');
        }
      } else {
        setHint('照片已添加，可以手动补充名称和品类。');
      }
    } catch {
      setError('照片处理失败，可以继续手动登记。');
    } finally {
      setStatus('idle');
    }
  };

  const save = async () => {
    if (!auth.currentUser) { setError('登录状态已失效，请重新登录。'); return; }
    if (!name.trim()) { setError('先给这件衣物取个名字吧。'); return; }
    setError(null); setStatus('saving');
    try {
      let imageUrl: string | undefined;
      if (imageData) {
        try { imageUrl = await uploadImageToBlob(imageData); } catch { setHint('图片暂时未上传成功，但文字信息仍会保存。'); }
      }
      await createWardrobeItem(auth.currentUser.uid, {
        userId: auth.currentUser.uid,
        name: name.trim(), brand: brand.trim(), category, season: '四季', rating: 5,
        story: '', imageUrl, orderIndex: Date.now(),
      });
      setStatus('success');
      onSaved?.();
    } catch {
      setError('保存失败，请稍后重试。'); setStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/35 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-kraft border border-graphite/15 shadow-2xl overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-graphite/10">
          <div><p className="font-tag text-[11px] tracking-[0.22em] text-graphite/60 uppercase">First garment</p><h2 className="font-story text-xl text-ink">记录第一件衣物</h2></div>
          <button type="button" aria-label="关闭" onClick={onClose} className="min-h-11 min-w-11 inline-flex items-center justify-center text-graphite hover:text-ink"><X className="w-5 h-5" /></button>
        </div>

        {status === 'success' ? (
          <div className="px-6 py-10 text-center"><div className="mx-auto mb-5 w-14 h-14 rounded-full bg-stamp text-white flex items-center justify-center"><Check className="w-7 h-7" /></div><h3 className="font-story text-2xl text-ink">第一件已进入衣柜</h3><p className="mt-2 text-sm text-graphite/70">再记录两件，就可以开始建立你的 Best Match。</p><div className="mt-7 flex gap-3"><button type="button" onClick={reset} className="flex-1 min-h-12 border border-graphite/25 text-ink text-sm">继续添加</button><button type="button" onClick={onClose} className="flex-1 min-h-12 bg-ink text-white text-sm">看看我的衣柜 →</button></div></div>
        ) : (
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <div className="rounded-xl border border-dashed border-graphite/25 bg-white/35 p-4">
              {imageData ? <div className="flex items-center gap-4"><img src={imageData} alt="待登记衣物" className="w-24 h-24 rounded-lg object-cover bg-white" /><button type="button" onClick={() => galleryRef.current?.click()} className="min-h-11 px-3 border border-graphite/20 text-sm">更换图片</button></div> : <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => galleryRef.current?.click()} className="min-h-14 inline-flex items-center justify-center gap-2 border border-graphite/20 bg-white/55 text-sm"><ImagePlus className="w-5 h-5" />从相册选</button><button type="button" onClick={() => cameraRef.current?.click()} className="min-h-14 inline-flex items-center justify-center gap-2 border border-graphite/20 bg-white/55 text-sm"><Camera className="w-5 h-5" />现在拍一张</button></div>}
              <input ref={galleryRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ''; }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ''; }} />
              <p className="mt-3 text-xs text-graphite/55">建议优先从相册选择已有照片；拍照入口只在你手边有衣物时使用。</p>
            </div>
            {status === 'recognizing' && <p className="mt-3 inline-flex items-center gap-2 text-sm text-graphite/70"><Loader2 className="w-4 h-4 animate-spin" />正在整理照片信息…</p>}
            {hint && <p className="mt-3 inline-flex items-center gap-2 text-sm text-stamp"><Sparkles className="w-4 h-4" />{hint}</p>}
            <label className="block mt-5 text-sm text-ink">名称 <span className="text-stamp">*</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：灰色针织衫" className="mt-2 w-full min-h-12 rounded-lg border border-graphite/20 bg-white/60 px-3 text-base outline-none focus:border-stamp" /></label>
            <div className="mt-4"><p className="text-sm text-ink mb-2">品类 <span className="text-stamp">*</span></p><div className="grid grid-cols-4 gap-2">{CATEGORIES.map((value) => <button type="button" key={value} onClick={() => setCategory(value)} className={`min-h-11 border text-sm ${category === value ? 'border-ink bg-ink text-white' : 'border-graphite/20 bg-white/45 text-graphite'}`}>{value}</button>)}</div></div>
            <label className="block mt-4 text-sm text-ink">品牌 <span className="text-xs text-graphite/45">选填</span><input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="例如：Margiela" className="mt-2 w-full min-h-12 rounded-lg border border-graphite/20 bg-white/60 px-3 text-base outline-none focus:border-stamp" /></label>
            {error && <p role="alert" className="mt-3 text-sm text-stamp">{error}</p>}
            <button type="button" disabled={status !== 'idle'} onClick={() => void save()} className="mt-6 w-full min-h-12 bg-stamp text-white text-base disabled:opacity-50">{status === 'saving' ? '保存中…' : '保存这件衣物 →'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
