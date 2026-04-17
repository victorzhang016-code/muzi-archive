import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { BestMatch } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';

interface BestMatchContextValue {
  matches: BestMatch[];
  loading: boolean;
}

const BestMatchContext = createContext<BestMatchContextValue>({ matches: [], loading: true });

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
        const next = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as BestMatch[];
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

/** All wardrobe item IDs referenced by a best match (flattened across all category slots). */
export function bestMatchItemIds(match: BestMatch): string[] {
  return [
    ...match.items.tops,
    ...match.items.bottoms,
    ...match.items.shoes,
    ...match.items.accessories,
  ];
}

/** Best matches that reference a given wardrobe item — seed data for v2 辐射图 (radiation graph). */
export function matchesContainingItem(matches: BestMatch[], itemId: string): BestMatch[] {
  return matches.filter((m) => bestMatchItemIds(m).includes(itemId));
}
