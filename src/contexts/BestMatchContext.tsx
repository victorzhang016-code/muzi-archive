import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BestMatch, BestMatchItems, BestMatchSlot, WardrobeItem } from '../types';
import type { BundleEntry } from '../components/TagBundle';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';

interface BestMatchContextValue {
  matches: BestMatch[];
  loading: boolean;
}

const BestMatchContext = createContext<BestMatchContextValue>({ matches: [], loading: true });

const EMPTY_ITEMS: BestMatchItems = { tops: [], bottoms: [], shoes: [], accessories: [] };

/** Coerce a v1 string[] slot or v2 BestMatchSlot[] into v2 shape. */
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

function normalizeMatch(id: string, raw: any): BestMatch {
  const rawItems = raw?.items ?? {};
  const items: BestMatchItems = {
    tops: normalizeSlots(rawItems.tops),
    bottoms: normalizeSlots(rawItems.bottoms),
    shoes: normalizeSlots(rawItems.shoes),
    accessories: normalizeSlots(rawItems.accessories),
  };

  // Trust the persisted allItemIds when present; recompute for legacy docs.
  const allItemIds: string[] = Array.isArray(raw.allItemIds) && raw.allItemIds.length > 0
    ? raw.allItemIds
    : flattenItems(items);

  return {
    id,
    userId: raw.userId,
    items,
    allItemIds,
    name: raw.name ?? undefined,
    // v1 compat: single-line `note` migrates into `story`.
    story: raw.story ?? raw.note ?? undefined,
    sceneTags: raw.sceneTags,
    photoBase64: raw.photoBase64,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function BestMatchProvider({ children, uid }: { children: ReactNode; uid: string }) {
  const [matches, setMatches] = useState<BestMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'best_matches'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((d) => normalizeMatch(d.id, d.data()));
        setMatches(next);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'best_matches');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return (
    <BestMatchContext.Provider value={{ matches, loading }}>
      {children}
    </BestMatchContext.Provider>
  );
}

export function useBestMatches() {
  return useContext(BestMatchContext);
}

/** Flatten primary + variants across all 4 slots into a single string[] (preserves order). */
export function flattenItems(items: BestMatchItems): string[] {
  const out: string[] = [];
  (['tops', 'bottoms', 'shoes', 'accessories'] as (keyof BestMatchItems)[]).forEach((k) => {
    items[k].forEach((slot) => {
      out.push(slot.primary);
      slot.variants?.forEach((v) => out.push(v));
    });
  });
  return out;
}

/** Just the primaries — for the visual TagBundle which renders one tag per slot. */
export function primaryItemIds(match: BestMatch): string[] {
  const out: string[] = [];
  (['tops', 'bottoms', 'shoes', 'accessories'] as (keyof BestMatchItems)[]).forEach((k) => {
    match.items[k].forEach((slot) => out.push(slot.primary));
  });
  return out;
}

/** All wardrobe item IDs referenced by a best match (flattened across primaries + variants). */
export function bestMatchItemIds(match: BestMatch): string[] {
  return match.allItemIds && match.allItemIds.length > 0
    ? match.allItemIds
    : flattenItems(match.items);
}

/** Best matches that reference a given wardrobe item (counts variants too). */
export function matchesContainingItem(matches: BestMatch[], itemId: string): BestMatch[] {
  return matches.filter((m) => bestMatchItemIds(m).includes(itemId));
}

/**
 * Build the BundleEntry[] that <TagBundle /> consumes. Each entry is one slot's
 * primary garment + the count of its variants — variants are NOT drawn as their
 * own tags (that would crowd the bundle); they show up as a "+N" badge instead.
 */
export function bundleEntriesFromMatch(
  match: BestMatch,
  wardrobeMap: Map<string, WardrobeItem>
): BundleEntry[] {
  const entries: BundleEntry[] = [];
  (['tops', 'bottoms', 'shoes', 'accessories'] as (keyof BestMatchItems)[]).forEach((k) => {
    match.items[k].forEach((slot) => {
      const item = wardrobeMap.get(slot.primary);
      if (!item) return;
      entries.push({
        item,
        variantCount: slot.variants?.length ?? 0,
      });
    });
  });
  return entries;
}

/** Empty items helper for builders. */
export const emptyBestMatchItems = (): BestMatchItems => ({
  tops: [],
  bottoms: [],
  shoes: [],
  accessories: [],
});

export { EMPTY_ITEMS };
