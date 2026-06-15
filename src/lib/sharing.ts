import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

/**
 * 分享隐私模型：复用全局 `wardrobe_users/{uid}.shareEnabled` 开关。
 * 分享任意单品 / best match 都要求该开关为 true（整柜只读公开），
 * 这样深链落地页与 best match 引用的单品才可被公开读取。
 */

export async function isSharingEnabled(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'wardrobe_users', uid));
  return snap.exists() && snap.data().shareEnabled === true;
}

/** 开启（或关闭）当前登录用户的全局分享开关。 */
export async function setSharingEnabled(enabled: boolean): Promise<void> {
  if (!auth.currentUser) throw new Error('未登录');
  await setDoc(
    doc(db, 'wardrobe_users', auth.currentUser.uid),
    { shareEnabled: enabled },
    { merge: true }
  );
}

export function buildItemShareUrl(uid: string, itemId: string): string {
  return `${window.location.origin}/share/${uid}/item/${itemId}`;
}

export function buildBestMatchShareUrl(uid: string, matchId: string): string {
  return `${window.location.origin}/share/${uid}/best-match/${matchId}`;
}

export function buildWardrobeShareUrl(uid: string): string {
  return `${window.location.origin}/share/${uid}`;
}
