import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

/**
 * Firebase 兼容层：当前业务数据已迁移到 Supabase，开发态永远只连接本地模拟器。
 * 这里保留旧类型和旧数据兼容能力，但不再支持任何“本地切生产”的环境变量开关。
 *
 * 生产构建里 `import.meta.env.DEV` 被静态替换成 `false`，整段连接代码会被 tree-shake，
 * **生产物理上不可能连到模拟器**。
 */
const USE_EMULATOR = import.meta.env.DEV;

let firestoreDb: Firestore;
if (USE_EMULATOR) {
  // 模拟器模式：用内存缓存即可（持久 IndexedDB 缓存与模拟器数据同用易串味），随后连本地。
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} else {
  // 生产：持久化本地缓存（IndexedDB）：重开 app 时优先吃缓存、只补拉变更，
  // 大幅减少每次打开 ~140 次的全量读取（缓解免费层 5万读/天的硬上限），
  // 同时加快加载。若环境不支持（无痕模式 / IndexedDB 被禁），回退到默认内存缓存，
  // 绝不能让初始化失败白屏。
  try {
    firestoreDb = initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        // 墙内/VPN 会反复掐断 Firestore 实时监听(onSnapshot)的 streaming 长连接，
        // SDK 每次重连都把整柜重新读一遍 —— 实测一次打开被放大 ~8×（143 条 → ~1150 读），
        // 表现为 Console 满屏 `ERR_CONNECTION_CLOSED` + `Listen stream transport errored`，
        // 用量图上则是"没人用却一阵阵直连 Firestore 狂读"的尖峰（绕过 Vercel）。
        // 强制 long-polling：改走普通短 HTTP 轮询，没有易被代理掐断的长连接，
        // 从根上消除"断→重连→整柜重读"的循环。代价仅实时性略降，本场景无感。
        experimentalForceLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch (e) {
    console.warn('[firestore] persistent cache unavailable, falling back to memory cache', e);
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = firestoreDb;
export const storage = getStorage(app);

if (USE_EMULATOR) {
  // 必须在任何读写之前连接；模块初始化早于组件挂载，这里是安全的时机。
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestoreDb, '127.0.0.1', 8080);
  console.warn('[firebase] 🔌 已连接本地模拟器（Auth:9099 / Firestore:8080）—— 读写不碰生产库，额度恒为 0');
}
