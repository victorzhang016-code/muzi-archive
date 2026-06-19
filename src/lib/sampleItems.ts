import { WardrobeItem } from '../types';
import { fetchPublicWardrobe } from './publicWardrobe';

const AUTHOR_UID = import.meta.env.VITE_AUTHOR_UID as string | undefined;

/**
 * 拉取作者（VITE_AUTHOR_UID）的公开衣物卡片，用于：
 *  - 登录页背景滚动卡墙
 *  - 新用户空衣柜的「示例卡片」
 *
 * 走 /api/public/:uid?limit=n 边缘缓存接口（不直连 Firestore），有图优先。
 * 未配置 AUTHOR_UID 或读取失败时返回 []，调用方做兜底（不渲染）。
 */
export async function fetchAuthorSampleItems(n: number): Promise<WardrobeItem[]> {
  if (!AUTHOR_UID) return [];
  try {
    const { items } = await fetchPublicWardrobe(AUTHOR_UID, { limit: n });
    return items;
  } catch {
    return [];
  }
}

/** 新用户空衣柜示例卡优先展示的单品：作者衣柜里的 fengchenwang 裤子。 */
const isPreferredSample = (i: WardrobeItem) =>
  i.category === '下装' && /fengchenwang/i.test(i.brand || '');

/**
 * 新用户空衣柜的「示例卡片」专用：拉作者整柜（边缘缓存，图片仍懒加载），
 * 优先选 fengchenwang 的裤子；找不到时兜底为第一张有图的卡片，再不行取第一张。
 * 返回 null 时调用方不渲染示例。
 */
export async function fetchAuthorPreferredSample(): Promise<WardrobeItem | null> {
  if (!AUTHOR_UID) return null;
  try {
    const { items } = await fetchPublicWardrobe(AUTHOR_UID);
    if (items.length === 0) return null;
    return items.find(isPreferredSample) ?? items.find((i) => i.imageUrl) ?? items[0];
  } catch {
    return null;
  }
}
