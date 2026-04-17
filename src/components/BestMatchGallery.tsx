import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Plus, Loader2, Sparkles } from 'lucide-react';
import { useBestMatches, bundleEntriesFromMatch } from '../contexts/BestMatchContext';
import { useWardrobe } from '../contexts/WardrobeContext';
import { sfx } from '../lib/sounds';
import { TagBundle } from './TagBundle';
import { BestMatch, WardrobeItem } from '../types';

const AESTHETIC_THRESHOLD = 10;

export function BestMatchGallery() {
  const navigate = useNavigate();
  const { matches, loading } = useBestMatches();
  const [exitingId, setExitingId] = useState<string | null>(null);
  const { items: wardrobe, loading: wardrobeLoading } = useWardrobe();

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    wardrobe.forEach((i) => m.set(i.id, i));
    return m;
  }, [wardrobe]);

  if (loading || wardrobeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-graphite/40" />
      </div>
    );
  }

  const remaining = Math.max(0, AESTHETIC_THRESHOLD - matches.length);
  const unlocked = remaining === 0;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-5">
        <div className="border-b border-dashed border-graphite/25 pb-5">
          <button
            onClick={() => { sfx.filterClick(); navigate(-1); }}
            className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors mb-4"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Archive</span>
          </button>
          <p className="font-tag text-[10px] uppercase tracking-[0.3em] text-graphite/55 mb-2">
            Best Match · {matches.length} Looks
          </p>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2
                className="text-[3.5rem] leading-none text-ink"
                style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300, letterSpacing: '0.04em' }}
              >
                Best Match
              </h2>
              <p className="font-story text-[14px] text-graphite/70 mt-2 italic">
                心中的最佳搭配
              </p>
            </div>
            <button
              onClick={() => { sfx.modalOpen(); navigate('/best-match/new'); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-ink text-white font-tag text-[12px] uppercase tracking-wider font-bold hover:bg-ink/85 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>建立 Best Match</span>
            </button>
          </div>
        </div>

        <div className="border border-dashed border-graphite/30 bg-tag/40 px-5 py-5 flex items-center gap-4">
          <div className="w-10 h-10 border border-graphite/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-graphite" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-tag text-[10px] uppercase tracking-[0.25em] text-graphite/60 mb-1">
              Aesthetic Profile
            </p>
            {unlocked ? (
              <>
                <p className="font-story text-sm text-ink mb-1">
                  审美档案已解锁，AI 分析即将上线
                </p>
                <p className="font-story italic text-xs text-graphite/60">
                  基于 {matches.length} 套 best match 的风格倾向 / 色板 / 探索建议
                </p>
              </>
            ) : (
              <>
                <p className="font-story text-sm text-ink mb-2">
                  再积累 <strong>{remaining}</strong> 套解锁审美分析
                </p>
                <div className="h-1 bg-graphite/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ink transition-all"
                    style={{ width: `${(matches.length / AESTHETIC_THRESHOLD) * 100}%` }}
                  />
                </div>
                <p className="font-tag text-[10px] tracking-[0.15em] text-graphite/45 mt-1.5">
                  {matches.length} / {AESTHETIC_THRESHOLD}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-32">
          <p className="font-tag text-[9px] uppercase tracking-[0.3em] text-graphite/35 mb-6">— No Looks Yet —</p>
          <h3 className="text-2xl font-story font-bold text-ink mb-4">还没有 best match</h3>
          <p className="text-graphite mb-8 font-story">把心中那些"绝对没错"的搭配记下来吧</p>
          <button
            onClick={() => { sfx.modalOpen(); navigate('/best-match/new'); }}
            className="px-8 py-3 bg-ink text-white font-tag text-[10px] uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            建立第一套
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12 pt-2">
          {matches.map((match, idx) => (
            <MatchCard
              key={match.id}
              match={match}
              index={idx}
              itemMap={itemMap}
              exiting={exitingId !== null && exitingId !== match.id}
              onOpen={() => {
                sfx.cardClick();
                setExitingId(match.id);
                window.setTimeout(() => navigate(`/best-match/${match.id}`), 180);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MatchCardProps {
  match: BestMatch;
  index: number;
  itemMap: Map<string, WardrobeItem>;
  exiting: boolean;
  onOpen: () => void;
}

function MatchCard({ match, index, itemMap, exiting, onOpen }: MatchCardProps) {
  const entries = useMemo(() => bundleEntriesFromMatch(match, itemMap), [match, itemMap]);
  const totalCount = entries.length + entries.reduce((sum, e) => sum + (e.variantCount ?? 0), 0);

  return (
    <motion.button
      onClick={onOpen}
      onMouseEnter={() => sfx.cardHover()}
      className="flex flex-col items-start gap-3 group text-left"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: exiting ? 0 : 1, y: 0 }}
      transition={{
        opacity: { duration: exiting ? 0.15 : 0.35, ease: 'easeOut' },
        y: { duration: 0.4, delay: Math.min(index * 0.05, 0.22), ease: [0.22, 1, 0.36, 1] },
      }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div
        className="w-full rounded-xl bg-white/30 border border-dashed border-graphite/20 p-5 group-hover:border-graphite/45 transition-colors"
        whileHover={{ y: -4 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {entries.length > 0 ? (
          <TagBundle entries={entries} size="mini" variant="stacked" />
        ) : (
          <p className="font-tag text-xs text-graphite/45 py-12">No items</p>
        )}
      </motion.div>
      {match.name && (
        <h3 className="font-story font-bold text-base text-ink max-w-[220px] line-clamp-2">
          {match.name}
        </h3>
      )}
      <p className="font-tag text-[10px] uppercase tracking-[0.2em] text-graphite/50">
        {entries.length} 主件 · {totalCount} 件含变体
      </p>
      {(match.sceneTags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 max-w-full">
          {match.sceneTags!.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 font-tag text-[10px] uppercase tracking-wider text-graphite border border-graphite/25 bg-tag/40"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {match.story && (
        <p className="font-story italic text-[12px] text-graphite/70 max-w-[240px] line-clamp-2">
          {match.story}
        </p>
      )}
    </motion.button>
  );
}
