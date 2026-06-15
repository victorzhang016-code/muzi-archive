import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { WardrobeItem } from '../types';

const AUTHOR_UID = import.meta.env.VITE_AUTHOR_UID as string | undefined;

/**
 * 拉取作者（VITE_AUTHOR_UID）的公开衣物卡片，用于：
 *  - 登录页背景滚动卡墙
 *  - 新用户空衣柜的「示例卡片」
 *
 * 依赖作者已开启全局分享（wardrobe_users/{author}.shareEnabled === true）。
 * 未配置 AUTHOR_UID 或读取失败时返回 []，调用方需做兜底（不渲染）。
 *
 * 注：Firestore 不能直接「优先有图」排序，这里多取一些再按「有图」前置，
 * 取前 n 张。
 */
export async function fetchAuthorSampleItems(n: number): Promise<WardrobeItem[]> {
  if (!AUTHOR_UID) return [];
  try {
    const q = query(
      collection(db, 'wardrobe_items'),
      where('userId', '==', AUTHOR_UID),
      limit(Math.max(n * 3, 24))
    );
    const snap = await getDocs(q);
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WardrobeItem));
    // 有图的排前面，保证视觉饱满
    all.sort((a, b) => (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0));
    return all.slice(0, n);
  } catch {
    return [];
  }
}
