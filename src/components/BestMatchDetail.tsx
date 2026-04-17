import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Edit2, Trash2, Loader2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { BestMatch, WardrobeItem } from '../types';
import { useWardrobe } from '../contexts/WardrobeContext';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';
import { sfx } from '../lib/sounds';
import { TagBundle } from './TagBundle';
import { bestMatchItemIds } from '../contexts/BestMatchContext';

export function BestMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { items: wardrobe, loading: wardrobeLoading } = useWardrobe();
  const [match, setMatch] = useState<BestMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !auth.currentUser) return;
    const ref = doc(db, 'best_matches', id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setMatch({ id: snap.id, ...snap.data() } as BestMatch);
        } else {
          setMatch(null);
        }
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `best_matches/${id}`);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  const itemMap = useMemo(() => {
    const m = new Map<string, WardrobeItem>();
    wardrobe.forEach((i) => m.set(i.id, i));
    return m;
  }, [wardrobe]);

  const orderedItems = useMemo(() => {
    if (!match) return [];
    return bestMatchItemIds(match)
      .map((iid) => itemMap.get(iid))
      .filter((i): i is WardrobeItem => !!i);
  }, [match, itemMap]);

  const handleDelete = async () => {
    if (!match) return;
    if (!confirm('删除这套搭配？此操作不可恢复。')) return;
    sfx.deleteItem();
    try {
      await deleteDoc(doc(db, 'best_matches', match.id));
      navigate('/best-match');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `best_matches/${match.id}`);
    }
  };

  if (loading || wardrobeLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-graphite/40" />
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

  const created = match.createdAt?.toDate?.();
  const dateStr = created
    ? `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, '0')}.${String(created.getDate()).padStart(2, '0')}`
    : '—';

  const counts = {
    tops: match.items.tops.length,
    bottoms: match.items.bottoms.length,
    shoes: match.items.shoes.length,
    accessories: match.items.accessories.length,
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Top nav */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => { sfx.filterClick(); navigate('/best-match'); }}
          className="flex items-center gap-2 font-tag text-[10px] uppercase tracking-[0.2em] text-graphite hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Best Match</span>
        </button>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* The bundle */}
      <div className="flex justify-center mb-10">
        {orderedItems.length > 0 ? (
          <TagBundle items={orderedItems} size="detail" />
        ) : (
          <p className="font-story italic text-graphite/50 py-16">
            搭配里的衣物已被删除
          </p>
        )}
      </div>

      {/* Scene tags */}
      {(match.sceneTags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {match.sceneTags!.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 font-tag text-[11px] uppercase tracking-wider text-ink border border-ink/30 bg-ink/5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Note */}
      {match.note && (
        <div className="text-center mb-8">
          <p className="font-story italic text-[15px] text-ink/85 leading-relaxed">
            "{match.note}"
          </p>
        </div>
      )}

      {/* Photo */}
      {match.photoBase64 && (
        <div className="mt-8 mb-8 flex justify-center">
          <div className="border border-graphite/20 p-2 bg-white/40 max-w-xs">
            <img
              src={match.photoBase64}
              alt="outfit photo"
              className="w-full"
              style={{ filter: 'contrast(0.97) saturate(0.92) brightness(1.02)' }}
            />
            <p className="text-center font-tag text-[9px] uppercase tracking-[0.25em] text-graphite/50 mt-2 mb-1">
              Polaroid · Reference
            </p>
          </div>
        </div>
      )}

      {/* Care label style summary */}
      <div
        className="px-6 py-5 mt-10"
        style={{
          background: 'rgba(0,0,0,0.04)',
          borderStyle: 'solid',
          borderWidth: '1px',
          borderColor: 'rgba(0,0,0,0.10)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-px bg-graphite/60" />
          <span className="font-tag text-[7px] tracking-[0.3em] font-bold text-graphite/60">
            COMPOSITION
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 font-tag text-[11px] tracking-[0.06em]">
          <p><span className="text-graphite/55">TOPS </span><span className="text-ink font-medium">{counts.tops}</span></p>
          <p><span className="text-graphite/55">BOTTOMS </span><span className="text-ink font-medium">{counts.bottoms}</span></p>
          <p><span className="text-graphite/55">SHOES </span><span className="text-ink font-medium">{counts.shoes}</span></p>
          <p><span className="text-graphite/55">ACCESSORIES </span><span className="text-ink font-medium">{counts.accessories}</span></p>
          <p className="col-span-2"><span className="text-graphite/55">DATE </span><span className="text-ink font-medium">{dateStr}</span></p>
        </div>
      </div>
    </div>
  );
}
