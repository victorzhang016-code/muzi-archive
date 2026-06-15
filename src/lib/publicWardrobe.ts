import { WardrobeItem, BestMatch } from '../types';

/**
 * 公开衣柜取数 —— 统一走 /api/public/:uid（Vercel 边缘缓存），不直连 Firestore。
 * 所有公开页（卡墙 / 示例卡 / 公开衣柜 / 深链）都用它，省读取额度。
 */

export interface PublicWardrobe {
  items: WardrobeItem[];
  matches: BestMatch[];
  shareEnabled: boolean;
}

/** 衣柜主人未开启分享 */
export class SharingDisabledError extends Error {}
/** 服务繁忙 / 额度用尽 / 网络错误（可重试） */
export class BusyError extends Error {}

/**
 * 时间戳兼容：缓存接口把 Firestore Timestamp 序列化成 millis(number)，
 * 而 owner 直连路径仍是 Firestore Timestamp。此工具同时兼容两者。
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
    shareEnabled: data.shareEnabled !== false,
  };
}
