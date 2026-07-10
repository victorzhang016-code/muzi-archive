import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { WardrobeItem } from '../types';
import { classifyLoadError, type LoadErrorKind } from '../lib/firebase-errors';
import { listWardrobeItems, onDataChanged } from '../lib/supabaseData';

interface WardrobeContextValue { items: WardrobeItem[]; loading: boolean; error: LoadErrorKind | null }
const WardrobeContext = createContext<WardrobeContextValue>({ items: [], loading: true, error: null });

export function WardrobeProvider({ children, uid }: { children: ReactNode; uid: string }) {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadErrorKind | null>(null);
  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    let active = true;
    const load = () => listWardrobeItems().then((next) => { if (active) { setItems(next); setError(null); setLoading(false); } }).catch((err) => { if (active) { setError(classifyLoadError(err, 'wardrobe_items')); setLoading(false); } });
    setLoading(true); load();
    const unsubscribe = onDataChanged('wardrobe_items', load);
    return () => { active = false; unsubscribe(); };
  }, [uid]);
  return <WardrobeContext.Provider value={{ items, loading, error }}>{children}</WardrobeContext.Provider>;
}
export const useWardrobe = () => useContext(WardrobeContext);
