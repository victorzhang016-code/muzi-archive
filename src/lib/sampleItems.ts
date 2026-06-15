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
