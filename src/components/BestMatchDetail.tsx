import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Edit2, Trash2, Loader2, Image as ImageIcon, Share2 } from 'lucide-react';
import { ShareCardModal } from './ShareCardModal';
import { buildBestMatchShareUrl } from '../lib/sharing';
import { auth } from '../lib/authCompat';
import { deleteBestMatch, updateBestMatch } from '../lib/supabaseData';
import { BestMatch, WardrobeItem } from '../types';
import { useWardrobe } from '../contexts/WardrobeContext';
import { handleFirestoreError, OperationType, LoadErrorKind } from '../lib/firebase-errors';
import { sfx } from '../lib/sounds';
import { bundleEntriesFromMatch, useBestMatches } from '../contexts/BestMatchContext';
import { compressToBase64 } from '../lib/cropImage';
import { uploadImageToBlob } from '../lib/blobUpload';
import { BestMatchView } from './BestMatchView';
import { resolveMediaUrl } from '../lib/media';

export function BestMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items: wardrobe, loading: wardrobeLoading } = useWardrobe();
  const { matches: allMatches, loading: matchesLoading } = useBestMatches();
  const [match, setMatch] = useState<BestMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadErrorKind | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [bundleVisible, setBundleVisible] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeWithAnimation = () => {
    sfx.filterClick();
    setBundleVisible(false);
    window.setTimeout(() => navigate('/best-match'), 420);
  };

  useEffect(() => {
    if (!id || matchesLoading) return;
    setMatch(allMatches.find((candidate) => candidate.id === id) ?? null);
    setLoadError(null);
    setLoading(false);
    /* legacy Firestore listener removed
      ref,
      (snap) => {
        if (snap.exists()) {
          // Defer normalization to context's helpers — but we read raw here.
          // Use bundleEntriesFromMatch downstream which handles slot shape.
          const data = snap.data() as any;
          const rawItems = data.items ?? {};
          const normalizeSlots = (raw: any) => {
            if (!Array.isArray(raw)) return [];
            return raw.map((entry: any) => {
              if (typeof entry === 'string') return { primary: entry };
              if (entry && typeof entry === 'object' && typeof entry.primary === 'string') {
                const variants = Array.isArray(entry.variants)
                  ? entry.variants.filter((v: unknown) => typeof v === 'string')
                  : undefined;
                return variants && variants.length > 0
                  ? { primary: entry.primary, variants }
                  : { primary: entry.primary };
              }
              return null;
            }).filter(Boolean);
          };
          setMatch({
            id: snap.id,
            userId: data.userId,
            items: {
              tops: normalizeSlots(rawItems.tops),
              bottoms: normalizeSlots(rawItems.bottoms),
              shoes: normalizeSlots(rawItems.shoes),
              accessories: normalizeSlots(rawItems.accessories),
            },
            allItemIds: data.allItemIds ?? [],
            name: data.name ?? undefined,
            story: data.story ?? data.note ?? undefined,
            sceneTags: data.sceneTags,
            photoBase64: data.photoBase64,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          } as BestMatch);
        } else {
          setMatch(null);
        }
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        // 不再 throw —— 归类后展示「繁忙」而非无限转圈
        setLoadError(handleFirestoreError(err, OperationType.GET, `best_matches/${id}`));
        setLoading(false);
      }
    );
    return () => unsub(); */
  }, [id, allMatches, matchesLoading]);

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    wardrobe.forEach((i) => m.set(i.id, i));
    return m;
  }, [wardrobe]);

  // 分享卡用默认主件组合（不随明细里的变体切换变）
  const shareEntries = useMemo(
    () => (match ? bundleEntriesFromMatch(match, itemMap) : []),
    [match, itemMap]
  );

  const handleDelete = async () => {
    if (!match) return;
    if (!confirm('删除这套搭配？此操作不可恢复。')) return;
    sfx.deleteItem();
    try {
      await deleteBestMatch(match.id);
      navigate('/best-match');
    } catch (err) {
      const kind = handleFirestoreError(err, OperationType.DELETE, `best_matches/${match.id}`);
      alert(kind === 'busy' ? '服务器繁忙，删除未成功，请稍后重试。' : '删除失败，请稍后重试。');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !match) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('图片不能超过 5MB');
      e.target.value = '';
      return;
    }
    setPhotoUploading(true);
    try {
      const base64 = await compressToBase64(file, 720, 0.78);
      const url = await uploadImageToBlob(base64);
      await updateBestMatch(match.id, { ...match, photoBase64: url });
    } catch (err) {
      const kind = handleFirestoreError(err, OperationType.WRITE, `best_matches/${match.id}`);
      alert(kind === 'busy' ? '服务器繁忙，照片未保存，请稍后重试。' : '照片保存失败，请重试或换一张更小的图片。');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  if (loading || wardrobeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (loadError) {
    const busy = loadError === 'busy';
    return (
      <div className="text-center py-32">
        <h2 className="text-2xl font-story font-bold text-ink mb-4">
          {busy ? '服务器繁忙' : '加载失败'}
        </h2>
        <p className="text-sm text-graphite mb-6 font-story">
          {busy ? '当前访问较多，稍后再试即可（不是数据丢失）。' : '没能加载这套搭配。'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => window.location.reload()} className="font-tag text-[10px] uppercase tracking-widest text-graphite hover:text-ink transition-colors font-bold">
            重试
          </button>
          <button onClick={() => navigate('/best-match')} className="font-tag text-[10px] uppercase tracking-widest text-graphite hover:text-ink transition-colors font-bold">
            Return to Gallery
          </button>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-32">
        <h2 className="text-2xl font-story font-bold text-ink mb-4">Match Not Found</h2>
        <button
          onClick={() => navigate('/best-match')}
          className="font-tag text-[10px] uppercase tracking-widest text-graphite hover:text-ink transition-colors font-bold"
        >
          Return to Gallery
        </button>
      </div>
    );
  }

  const photoSlot = match.photoBase64 ? (
    <div className="border border-graphite/20 p-2 bg-white/40 max-w-[240px]">
      <img
        src={resolveMediaUrl(match.photoBase64)}
        alt="outfit"
        className="w-full"
        style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
      />
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50">Polaroid</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={photoUploading}
          className="font-tag text-[9px] uppercase tracking-wider text-graphite hover:text-ink disabled:opacity-40 transition-colors"
        >
          {photoUploading ? '上传中…' : '更换'}
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={photoUploading}
      className="flex flex-col items-center gap-2 px-6 py-5 border border-dashed border-graphite/30 hover:border-graphite/60 transition-colors text-graphite/55 hover:text-ink disabled:opacity-40"
    >
      {photoUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
      <span className="font-tag text-[10px] uppercase tracking-wider">
        {photoUploading ? '上传中…' : '上传整套 Look 照片'}
      </span>
    </button>
  );

  return (
    <>
      <BestMatchView
        match={match}
        itemMap={itemMap}
        onItemClick={(itemId) => navigate(`/item/${itemId}`)}
        bundleCollapsed={!bundleVisible}
        backSlot={
          <button
            onClick={() => closeWithAnimation()}
            className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Best Match</span>
          </button>
        }
        actionsSlot={
          <>
            <button
              onClick={() => { sfx.modalOpen(); setShareOpen(true); }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-stamp text-white font-tag text-[10px] uppercase tracking-wider font-bold hover:bg-stamp/90 transition-colors shadow-sm"
              title="分享"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>分享</span>
            </button>
            <button
              onClick={() => { sfx.modalOpen(); navigate(`/best-match/new?edit=${match.id}`); }}
              className="p-2 text-graphite hover:text-ink transition-colors border border-graphite/15 bg-tag/60 hover:bg-tag shadow-sm"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 text-graphite hover:text-stamp transition-colors border border-graphite/15 bg-tag/60 hover:bg-tag shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        }
        photoSlot={
          <>
            {photoSlot}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </>
        }
      />

      {shareOpen && auth.currentUser && (
        <ShareCardModal
          target={{ kind: 'bestMatch', match, entries: shareEntries }}
          shareUrl={buildBestMatchShareUrl(auth.currentUser.publicId, match.id)}
          allMatches={allMatches}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
