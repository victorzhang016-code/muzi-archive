import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BestMatch, BestMatchItems, BestMatchSlot, WardrobeItem } from '../types';
import { fetchPublicWardrobe, SharingDisabledError } from '../lib/publicWardrobe';
import { BestMatchView } from './BestMatchView';
import { Loader2, Lock, ArrowLeft, ArrowRight } from 'lucide-react';

/** 公开接口返回的 items 是 Firestore 原样解码，可能是 v1 string[] 或 v2 对象 —— 统一成 v2。 */
function normalizeSlots(raw: unknown): BestMatchSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: BestMatchSlot[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      out.push({ primary: entry });
    } else if (entry && typeof entry === 'object' && typeof (entry as any).primary === 'string') {
      const variants = Array.isArray((entry as any).variants)
        ? ((entry as any).variants as unknown[]).filter((v): v is string => typeof v === 'string')
        : undefined;
      out.push(variants && variants.length > 0
        ? { primary: (entry as any).primary, variants }
        : { primary: (entry as any).primary });
    }
  }
  return out;
}

export function SharedBestMatchView() {
  const { userId, matchId } = useParams<{ userId: string; matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<BestMatch | null>(null);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [tempError, setTempError] = useState(false);

  useEffect(() => {
    if (!matchId || !userId) return;
    // 走边缘缓存接口：一次拿到整柜，本地找出这套搭配 + 解析引用单品（0 次 Firestore 读）
    fetchPublicWardrobe(userId)
      .then(({ items, matches }) => {
        const m = matches.find((x) => x.id === matchId);
        if (!m) { setDenied(true); return; }
        setMatch({
          ...m,
          items: {
            tops: normalizeSlots((m.items as any)?.tops),
            bottoms: normalizeSlots((m.items as any)?.bottoms),
            shoes: normalizeSlots((m.items as any)?.shoes),
            accessories: normalizeSlots((m.items as any)?.accessories),
          } as BestMatchItems,
        });
        setItems(items);
      })
      .catch((e) => {
        if (e instanceof SharingDisabledError) setDenied(true);
        else setTempError(true);
      })
      .finally(() => setLoading(false));
  }, [matchId, userId]);

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    items.forEach((i) => m.set(i.id, i));
    return m;
  }, [items]);

  if (loading) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-graphite/40" />
      </div>
    );
  }

  if (tempError) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Temporarily Unavailable</p>
          <p className="font-story text-ink/80 mb-2">暂时加载不出来</p>
          <p className="font-story text-graphite/55 text-sm mb-6">服务器有点忙，请稍后再刷新试试。</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 border border-graphite/30 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider">
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (denied || !match) {
    return (
      <div className="min-h-screen bg-kraft flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-10 h-10 text-graphite/25 mx-auto mb-5" />
          <p className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/40 mb-3">Not Available</p>
          <p className="font-story text-graphite/60">此搭配未公开或已删除</p>
        </div>
      </div>
    );
  }

  // 只读照片（与主人的 polaroid 同款，去掉「更换」按钮）
  const photoSlot = match.photoBase64 ? (
    <div className="border border-graphite/20 p-2 bg-white/40 max-w-[240px]">
      <img
        src={match.photoBase64}
        alt="outfit"
        className="w-full"
        style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
        loading="lazy"
      />
      <div className="mt-2 px-1">
        <span className="font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50">Polaroid</span>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-kraft text-ink font-sans selection:bg-stamp selection:text-white">
      <header className="sticky top-0 z-40 bg-kraft/90 backdrop-blur-md border-b border-dashed border-graphite/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-tag font-bold text-ink" style={{ fontSize: '1.05rem', letterSpacing: '0.06em' }}>
              衣LOG
            </h1>
            <span className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/50 border border-dashed border-graphite/25 px-2 py-0.5">
              Best Match · 只读
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <BestMatchView
          match={match}
          itemMap={itemMap}
          onItemClick={(itemId) => navigate(`/share/${userId}/item/${itemId}`)}
          photoSlot={photoSlot}
          backSlot={
            <Link
              to={`/share/${userId}`}
              state={{ view: 'matches' }}
              className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Best Match</span>
            </Link>
          }
        />

        <div className="max-w-6xl mx-auto">
          <Link
            to={`/share/${userId}`}
            className="mt-2 w-full flex items-center justify-center gap-2 px-5 py-3 border border-graphite/25 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider"
          >
            查看完整衣柜
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
