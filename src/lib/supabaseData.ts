import { Timestamp } from 'firebase/firestore';
import type { BestMatch, WardrobeItem } from '../types';
import { supabase } from './supabase';

const changed = 'wearlog:data-changed';
export const notifyDataChanged = (table: 'wardrobe_items' | 'best_matches') => window.dispatchEvent(new CustomEvent(changed, { detail: table }));
export const onDataChanged = (table: string, fn: () => void) => {
  const handler = (event: Event) => { if ((event as CustomEvent).detail === table) fn(); };
  window.addEventListener(changed, handler);
  return () => window.removeEventListener(changed, handler);
};

const client = () => {
  if (!supabase) throw new Error('Supabase 未配置');
  return supabase;
};

const ts = (value: string) => Timestamp.fromDate(new Date(value));

export function mapWardrobeItem(row: Record<string, any>): WardrobeItem {
  return {
    id: row.id, userId: row.owner_id, name: row.name, brand: row.brand ?? undefined,
    category: row.category, season: row.season, length: row.length ?? undefined,
    topType: row.top_type ?? undefined, accessoryType: row.accessory_type ?? undefined,
    rating: Number(row.rating ?? 0), story: row.story ?? '', purchaseYear: row.purchase_year ?? undefined,
    imageUrl: row.image_url ?? undefined, orderIndex: row.order_index ?? undefined, shared: !!row.shared,
    createdAt: ts(row.created_at), updatedAt: ts(row.updated_at),
  } as WardrobeItem;
}

export function mapBestMatch(row: Record<string, any>): BestMatch {
  return {
    id: row.id, userId: row.owner_id, items: row.items, allItemIds: row.all_item_ids ?? [],
    name: row.name ?? undefined, story: row.story ?? undefined, sceneTags: row.scene_tags ?? undefined,
    photoBase64: row.photo_url ?? undefined, shared: !!row.shared,
    createdAt: ts(row.created_at), updatedAt: ts(row.updated_at),
  } as BestMatch;
}

export const itemWrite = (item: Record<string, any>) => ({
  name: item.name, brand: item.brand ?? null, category: item.category, season: item.season,
  length: item.length ?? null, top_type: item.topType ?? null, accessory_type: item.accessoryType ?? null,
  rating: item.rating ?? 0, story: item.story ?? '', purchase_year: item.purchaseYear ?? null,
  image_url: item.imageUrl ?? null, order_index: item.orderIndex ?? null, shared: item.shared ?? false,
});

export const matchWrite = (match: Record<string, any>) => ({
  items: match.items, all_item_ids: match.allItemIds ?? [], name: match.name ?? null,
  story: match.story ?? null, scene_tags: match.sceneTags ?? null,
  photo_url: match.photoBase64 ?? null, shared: match.shared ?? false,
});

export async function listWardrobeItems() {
  const { data, error } = await client().from('wardrobe_items').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapWardrobeItem);
}
export async function getWardrobeItem(id: string) { const { data, error } = await client().from('wardrobe_items').select('*').eq('id', id).single(); if (error) throw error; return mapWardrobeItem(data); }
export async function createWardrobeItem(ownerId: string, item: Record<string, any>) { const id = crypto.randomUUID(); const now = new Date().toISOString(); const { error } = await client().from('wardrobe_items').insert({ id, owner_id: ownerId, ...itemWrite(item), created_at: now, updated_at: now }); if (error) throw error; notifyDataChanged('wardrobe_items'); return id; }
export async function updateWardrobeItem(id: string, item: Record<string, any>) { const { error } = await client().from('wardrobe_items').update({ ...itemWrite(item), updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; notifyDataChanged('wardrobe_items'); }
export async function deleteWardrobeItem(id: string) { const { error } = await client().from('wardrobe_items').delete().eq('id', id); if (error) throw error; notifyDataChanged('wardrobe_items'); }
export async function insertWardrobeItems(ownerId: string, items: Record<string, any>[]) { const now = new Date().toISOString(); const rows = items.map((x, i) => ({ id: crypto.randomUUID(), owner_id: ownerId, ...itemWrite(x), order_index: x.orderIndex ?? Date.now() + i, created_at: now, updated_at: now })); const { error } = await client().from('wardrobe_items').insert(rows); if (error) throw error; notifyDataChanged('wardrobe_items'); }
export async function deleteWardrobeItems(ids: string[]) { if (!ids.length) return; const { error } = await client().from('wardrobe_items').delete().in('id', ids); if (error) throw error; notifyDataChanged('wardrobe_items'); }
export async function updateWardrobeItems(rows: { id: string; values: Record<string, any> }[]) { for (const row of rows) { const { error } = await client().from('wardrobe_items').update({ ...row.values, updated_at: new Date().toISOString() }).eq('id', row.id); if (error) throw error; } notifyDataChanged('wardrobe_items'); }

export async function listBestMatches() { const { data, error } = await client().from('best_matches').select('*').order('created_at', { ascending: false }); if (error) throw error; return (data ?? []).map(mapBestMatch); }
export async function getBestMatch(id: string) { const { data, error } = await client().from('best_matches').select('*').eq('id', id).single(); if (error) throw error; return mapBestMatch(data); }
export async function createBestMatch(ownerId: string, match: Record<string, any>) { const id = crypto.randomUUID(); const now = new Date().toISOString(); const { error } = await client().from('best_matches').insert({ id, owner_id: ownerId, ...matchWrite(match), created_at: now, updated_at: now }); if (error) throw error; notifyDataChanged('best_matches'); return id; }
export async function updateBestMatch(id: string, match: Record<string, any>) { const { error } = await client().from('best_matches').update({ ...matchWrite(match), updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error; notifyDataChanged('best_matches'); }
export async function deleteBestMatch(id: string) { const { error } = await client().from('best_matches').delete().eq('id', id); if (error) throw error; notifyDataChanged('best_matches'); }

export async function getOwnProfile() { const { data, error } = await client().from('profiles').select('*').single(); if (error) throw error; return data; }
export async function setWardrobePublic(value: boolean) { const { error } = await client().from('profiles').update({ wardrobe_public: value, updated_at: new Date().toISOString() }); if (error) throw error; }
