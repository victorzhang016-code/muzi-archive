import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { WardrobeItem } from '../types';
import { classifyLoadError, LoadErrorKind } from '../lib/firebase-errors';

interface WardrobeContextValue {
  items: WardrobeItem[];
  loading: boolean;
  /** 加载失败类别（null=正常）。'busy'=额度用尽/不可用，可重试。 */
  error: LoadErrorKind | null;
}

const WardrobeContext = createContext<WardrobeContextValue>({ items: [], loading: true, error: null });

export function WardrobeProvider({ children, uid }: { children: ReactNode; uid: string }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadErrorKind | null>(null);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
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
      setError(null);
      setLoading(false);
    }, (err) => {
      // 不能在监听回调里 throw —— 会被吞掉且卡住 loading，把额度限流伪装成空账号
      setError(classifyLoadError(err, 'wardrobe_items'));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  return (
    <WardrobeContext.Provider value={{ items, loading, error }}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe() {
  return useContext(WardrobeContext);
}
