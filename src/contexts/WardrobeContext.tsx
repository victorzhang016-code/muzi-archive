import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WardrobeItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-errors';

interface WardrobeContextValue {
  items: WardrobeItem[];
  loading: boolean;
}

const WardrobeContext = createContext<WardrobeContextValue>({ items: [], loading: true });

export function WardrobeProvider({ children, uid }: { children: ReactNode; uid: string }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'wardrobe_items'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WardrobeItem[];
      setItems(newItems);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'wardrobe_items');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  return (
    <WardrobeContext.Provider value={{ items, loading }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  return useContext(WardrobeContext);
}
