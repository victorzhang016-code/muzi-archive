export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

import { auth } from '../firebase';

/** Coarse category for surfacing read failures in the UI without scaring the user. */
export type LoadErrorKind = 'busy' | 'permission' | 'unknown';

/**
 * Classify a Firestore listener/read error and log it — WITHOUT throwing.
 * Use this in onSnapshot error callbacks (async context where a throw is
 * swallowed and would wedge loading state). `resource-exhausted` (免费层读额度
 * 用尽 → 429) 和 `unavailable`（断网 / 临时不可用）都归为可重试的 'busy'，
 * 让 UI 显示「服务器繁忙，稍后重试」而不是伪装成空账号。
 */
export function classifyLoadError(error: unknown, path: string | null): LoadErrorKind {
  const code = (error as { code?: string })?.code;
  console.error('[firestore] load error', JSON.stringify({ code, path, message: error instanceof Error ? error.message : String(error) }));
  if (code === 'resource-exhausted' || code === 'unavailable') return 'busy';
  if (code === 'permission-denied') return 'permission';
  return 'unknown';
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
