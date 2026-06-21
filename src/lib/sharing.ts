import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { BestMatch } from '../types';

/**
 * 分享隐私模型（v2，按单品/搭配分享）：
 * - 每条 wardrobe_items / best_matches 有 `shared` 标记：true = 这一条可被公开读取。
 * - 整柜公开 = wardrobe_users/{uid}.`wardrobePublic`（新字段）。仅在分享卡里勾选才置 true，可取消。
 *   （旧的全局 `shareEnabled` 字段已停用 → 老用户整柜自动回到私密，无需批量写。）
 * - 分享一套 best match 会连带把它引用的单品也置 shared=true（落地页才能渲染/点开单品）。
 */

// ───────────────────────── 整柜公开 ─────────────────────────

export async function isWardrobePublic(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'wardrobe_users', uid));
  return snap.exists() && snap.data().wardrobePublic === true;
}

/** 开启 / 关闭当前登录用户的「整柜公开」。 */
export async function setWardrobePublic(enabled: boolean): Promise<void> {
  if (!auth.currentUser) throw new Error('未登录');
  await setDoc(
    doc(db, 'wardrobe_users', auth.currentUser.uid),
    { wardrobePublic: enabled },
    { merge: true }
  );
}

// ───────────────────────── 按单品分享 ─────────────────────────

export async function isItemShared(itemId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'wardrobe_items', itemId));
  return snap.exists() && snap.data().shared === true;
}

export async function setItemShared(itemId: string, shared: boolean): Promise<void> {
  if (!auth.currentUser) throw new Error('未登录');
  await updateDoc(doc(db, 'wardrobe_items', itemId), { shared });
}

/**
 * 某件单品是否仍被其它已分享搭配引用。
 * 用于单独取消分享单品时，避免把仍在公开的搭配链路弄断。
 */
export async function isItemReferencedByOtherSharedMatches(
  itemId: string,
  excludeMatchId?: string
): Promise<boolean> {
  if (!auth.currentUser) throw new Error('未登录');

  const q = query(
    collection(db, 'best_matches'),
    where('userId', '==', auth.currentUser.uid),
    where('shared', '==', true),
    where('allItemIds', 'array-contains', itemId)
  );
  const snap = await getDocs(q);
  return snap.docs.some((d) => d.id !== excludeMatchId);
}

// ───────────────────────── 按搭配分享 ─────────────────────────

export async function isMatchShared(matchId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'best_matches', matchId));
  return snap.exists() && snap.data().shared === true;
}

/**
 * 分享 / 取消分享一套搭配，并连带处理它引用的单品：
 * - shared=true：把搭配 + 其 allItemIds 对应单品都置 shared=true。
 * - shared=false：把搭配置 false；其引用单品也置 false，但**跳过仍被其它已分享搭配引用的单品**，
 *   避免误关掉另一套仍在分享的搭配所需的单品。
 */
export async function setMatchShared(
  match: BestMatch,
  shared: boolean,
  otherSharedMatches: BestMatch[] = []
): Promise<void> {
  if (!auth.currentUser) throw new Error('未登录');
  const ids = Array.from(new Set(match.allItemIds ?? []));

  let itemIdsToWrite = ids;
  if (!shared) {
    // 仍被其它已分享搭配引用的单品不要关
    const stillNeeded = new Set<string>();
    for (const m of otherSharedMatches) {
      if (m.id === match.id) continue;
      if (m.shared !== true) continue;
      for (const id of m.allItemIds ?? []) stillNeeded.add(id);
    }
    itemIdsToWrite = ids.filter((id) => !stillNeeded.has(id));
  }

  // 先确保搭配本身写成功；引用单品逐条写、互不阻塞（容忍已删除的陈旧 id）
  await updateDoc(doc(db, 'best_matches', match.id), { shared });
  await Promise.allSettled(
    itemIdsToWrite.map((id) => updateDoc(doc(db, 'wardrobe_items', id), { shared }))
  );
}

// ───────────────────────── URL 构造 ─────────────────────────

export function buildItemShareUrl(uid: string, itemId: string): string {
  return `${window.location.origin}/share/${uid}/item/${itemId}`;
}

export function buildBestMatchShareUrl(uid: string, matchId: string): string {
  return `${window.location.origin}/share/${uid}/best-match/${matchId}`;
}

export function buildWardrobeShareUrl(uid: string): string {
  return `${window.location.origin}/share/${uid}`;
}
