import { WardrobeItem, BestMatch, BestMatchItems, BestMatchSlot } from '../types';

/**
 * 公开衣柜取数 —— 统一走 /api/public/:uid（Vercel 边缘缓存），不直连 Supabase 表。
 * 所有公开页（卡墙 / 示例卡 / 公开衣柜 / 深链）都用它，省读取额度。
 */

export interface PublicWardrobe {
  items: WardrobeItem[];
  matches: BestMatch[];
  wardrobePublic: boolean;
}

/** 衣柜主人未公开整个衣柜 */
export class SharingDisabledError extends Error {}
/** 服务繁忙 / 额度用尽 / 网络错误（可重试） */
export class BusyError extends Error {}

/** Normalize legacy and incomplete public match payloads at the API boundary. */
function normalizeSlots(raw: unknown): BestMatchSlot[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (typeof entry === 'string') return [{ primary: entry }];
    if (!entry || typeof entry !== 'object' || typeof (entry as any).primary !== 'string') return [];
    const variants = Array.isArray((entry as any).variants)
      ? ((entry as any).variants as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    return [{ primary: (entry as any).primary as string, ...(variants.length > 0 ? { variants } : {}) }];
  });
}

function normalizeBestMatch(raw: any): BestMatch {
  const rawItems = raw?.items ?? {};
  const items: BestMatchItems = {
    tops: normalizeSlots(rawItems.tops),
    bottoms: normalizeSlots(rawItems.bottoms),
    shoes: normalizeSlots(rawItems.shoes),
    accessories: normalizeSlots(rawItems.accessories),
  };
  const allItemIds = Array.isArray(raw?.allItemIds) && raw.allItemIds.length > 0
    ? raw.allItemIds.filter((id: unknown): id is string => typeof id === 'string')
    : (['tops', 'bottoms', 'shoes', 'accessories'] as (keyof BestMatchItems)[]).flatMap((key) =>
      items[key].flatMap((slot) => [slot.primary, ...(slot.variants ?? [])])
    );
  return { ...raw, items, allItemIds } as BestMatch;
}

/**
 * 时间戳兼容：公开 RPC 返回 millis(number)，owner 查询适配层返回兼容 Timestamp。
 */
export function toDateSafe(v: any): Date | null {
  if (v == null) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (typeof v === 'number') return new Date(v);
  if (typeof v === 'string') { const d = new Date(v); return isNaN(+d) ? null : d; }
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
  return null;
}

export async function fetchPublicWardrobe(
  uid: string,
  opts?: { limit?: number }
): Promise<PublicWardrobe> {
  const url = `/api/public/${encodeURIComponent(uid)}${opts?.limit ? `?limit=${opts.limit}` : ''}`;
  const res = await fetch(url);
  if (res.status === 403) throw new SharingDisabledError('not shared');
  if (!res.ok) throw new BusyError(`status ${res.status}`);
  const data = await res.json();
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const rawMatches = Array.isArray(data.matches) ? data.matches : [];
  return {
    items: rawItems as WardrobeItem[],
    matches: rawMatches.map(normalizeBestMatch),
    wardrobePublic: data.wardrobePublic === true,
  };
}

/** Check full-wardrobe visibility without querying private tables from the visitor. */
export async function fetchPublicWardrobeVisibility(uid: string): Promise<boolean> {
  try {
    return (await fetchPublicWardrobe(uid, { limit: 1 })).wardrobePublic;
  } catch {
    // A private wardrobe intentionally returns 403; individual shared links remain valid.
    return false;
  }
}

/** 单条公开单品（按单品分享）—— 走 /api/public-item/:uid/:id。 */
export async function fetchPublicItem(uid: string, id: string): Promise<WardrobeItem> {
  const res = await fetch(`/api/public-item/${encodeURIComponent(uid)}/${encodeURIComponent(id)}`);
  if (res.status === 403) throw new SharingDisabledError('not shared');
  if (!res.ok) throw new BusyError(`status ${res.status}`);
  const data = await res.json();
  return data.item as WardrobeItem;
}

/** 单条公开搭配（按搭配分享）—— 返回 match + 其引用单品。走 /api/public-match/:uid/:id。 */
export async function fetchPublicMatch(
  uid: string,
  id: string
): Promise<{ match: BestMatch; items: WardrobeItem[] }> {
  const res = await fetch(`/api/public-match/${encodeURIComponent(uid)}/${encodeURIComponent(id)}`);
  if (res.status === 403) throw new SharingDisabledError('not shared');
  if (!res.ok) throw new BusyError(`status ${res.status}`);
  const data = await res.json();
  return {
    match: normalizeBestMatch(data.match),
    items: (Array.isArray(data.items) ? data.items : []) as WardrobeItem[],
  };
}
