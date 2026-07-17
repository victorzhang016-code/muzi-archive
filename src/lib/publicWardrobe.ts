import { WardrobeItem, BestMatch } from '../types';

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
  return {
    items: (data.items ?? []) as WardrobeItem[],
    matches: (data.matches ?? []) as BestMatch[],
    wardrobePublic: data.wardrobePublic === true,
  };
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
    match: data.match as BestMatch,
    items: (data.items ?? []) as WardrobeItem[],
  };
}
