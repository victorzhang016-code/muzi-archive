import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// 持久化本地缓存（IndexedDB）：重开 app 时优先吃缓存、只补拉变更，
// 大幅减少每次打开 ~140 次的全量读取（缓解免费层 5万读/天的硬上限），
// 同时加快加载。若环境不支持（无痕模式 / IndexedDB 被禁），回退到默认内存缓存，
// 绝不能让初始化失败白屏。
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
    firebaseConfig.firestoreDatabaseId
  );
} catch (e) {
  console.warn('[firestore] persistent cache unavailable, falling back to memory cache', e);
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const storage = getStorage(app);
