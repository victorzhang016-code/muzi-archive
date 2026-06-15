import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BestMatch, WardrobeItem } from '../types';
import { TagBundle } from './TagBundle';
import type { BundleEntry } from './TagBundle';
import { bundleEntriesFromMatch } from '../contexts/BestMatchContext';
import { fetchPublicWardrobe, SharingDisabledError } from '../lib/publicWardrobe';
import { Loader2, Lock, ArrowRight } from 'lucide-react';

export function SharedBestMatchView() {
  const { userId, matchId } = useParams<{ userId: string; matchId: string }>();
  const [match, setMatch] = useState<BestMatch | null>(null);
  const [entries, setEntries] = useState<BundleEntry[]>([]);
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
        setMatch(m);
        const map = new Map<string, WardrobeItem>(items.map((i) => [i.id, i]));
        setEntries(bundleEntriesFromMatch(m, map));
      })
      .catch((e) => {
        if (e instanceof SharingDisabledError) setDenied(true);
        else setTempError(true);
      })
      .finally(() => setLoading(false));
  }, [matchId, userId]);

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

  return (
    <div className="min-h-screen bg-kraft text-ink font-sans selection:bg-stamp selection:text-white">
      <header className="sticky top-0 z-40 bg-kraft/90 backdrop-blur-md border-b border-dashed border-graphite/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-tag font-bold text-ink" style={{ fontSize: '1.05rem', letterSpacing: '0.06em' }}>
              模子の衣柜
            </h1>
            <span className="font-tag text-[8px] uppercase tracking-[0.2em] text-graphite/50 border border-dashed border-graphite/25 px-2 py-0.5">
              Best Match · 只读
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center">
        {entries.length > 0 ? (
          <TagBundle entries={entries} size="detail" variant="strung" />
        ) : match.photoBase64 ? (
          <div className="border border-graphite/20 p-2 bg-white/40 max-w-[280px]">
            <img src={match.photoBase64} alt={match.name || 'outfit'} className="w-full" loading="lazy" />
          </div>
        ) : (
          <p className="font-story italic text-graphite/50 py-16">搭配里的衣物已被删除</p>
        )}

        {match.name && (
          <h2
            className="text-center text-ink mt-6 leading-tight"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, fontSize: '2rem' }}
          >
            {match.name}
          </h2>
        )}

        {(match.sceneTags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {match.sceneTags!.map((tag) => (
              <span key={tag} className="px-3 py-1 font-tag text-[11px] uppercase tracking-wider text-ink border border-ink/30 bg-ink/5">
                {tag}
              </span>
            ))}
          </div>
        )}

        {match.story && (
          <p className="font-story text-[15px] leading-[1.9] text-ink/85 mt-5 whitespace-pre-wrap text-center max-w-md">
            {match.story}
          </p>
        )}

        <Link
          to={`/share/${userId}`}
          className="mt-10 w-full flex items-center justify-center gap-2 px-5 py-3 border border-graphite/25 bg-tag/60 hover:bg-tag text-ink/75 hover:text-ink transition-colors font-tag text-[11px] uppercase tracking-wider"
        >
          查看完整衣柜
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </main>
    </div>
  );
}
