import type { BestMatch } from '../types';
import { supabase } from './supabase';
import { getCachedUser } from '../components/Auth';
import { notifyDataChanged } from './supabaseData';

const db = () => { if (!supabase) throw new Error('Supabase 未配置'); return supabase; };
export async function isWardrobePublic(): Promise<boolean> {
  const user = getCachedUser();
  if (!user) throw new Error('未登录');
  const { data, error } = await db()
    .from('profiles')
    .select('wardrobe_public')
    .eq('id', user.uid)
    .single();
  if (error) throw error;
  return !!data.wardrobe_public;
}
export async function setWardrobePublic(enabled: boolean) {
  const user = getCachedUser();
  if (!user) throw new Error('未登录');
  const { error } = await db()
    .from('profiles')
    .update({ wardrobe_public: enabled, updated_at: new Date().toISOString() })
    .eq('id', user.uid);
  if (error) throw error;
}
export async function isItemShared(itemId: string) { const { data, error } = await db().from('wardrobe_items').select('shared').eq('id', itemId).single(); if (error) throw error; return !!data.shared; }
export async function setItemShared(itemId: string, shared: boolean) { const { error } = await db().from('wardrobe_items').update({ shared }).eq('id', itemId); if (error) throw error; notifyDataChanged('wardrobe_items'); }
export async function isItemReferencedByOtherSharedMatches(itemId: string, excludeMatchId?: string) { const { data, error } = await db().from('best_matches').select('id').eq('shared', true).contains('all_item_ids', [itemId]); if (error) throw error; return (data ?? []).some((x) => x.id !== excludeMatchId); }
export async function isMatchShared(matchId: string) { const { data, error } = await db().from('best_matches').select('shared').eq('id', matchId).single(); if (error) throw error; return !!data.shared; }
export async function setMatchShared(match: BestMatch, shared: boolean, otherSharedMatches: BestMatch[] = []) {
  const ids = [...new Set(match.allItemIds ?? [])]; let itemIds = ids;
  if (!shared) { const needed = new Set(otherSharedMatches.filter((m) => m.id !== match.id && m.shared).flatMap((m) => m.allItemIds ?? [])); itemIds = ids.filter((id) => !needed.has(id)); }
  const { error } = await db().from('best_matches').update({ shared }).eq('id', match.id); if (error) throw error;
  if (itemIds.length) { const result = await db().from('wardrobe_items').update({ shared }).in('id', itemIds); if (result.error) throw result.error; }
  notifyDataChanged('best_matches'); notifyDataChanged('wardrobe_items');
}
export const buildItemShareUrl = (uid: string, itemId: string) => `${window.location.origin}/share/${uid}/item/${itemId}`;
export const buildBestMatchShareUrl = (uid: string, matchId: string) => `${window.location.origin}/share/${uid}/best-match/${matchId}`;
export const buildWardrobeShareUrl = (uid: string) => `${window.location.origin}/share/${uid}`;
