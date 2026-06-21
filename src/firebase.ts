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
 * 是否连接本地 Firebase 模拟器（Auth + Firestore）。
 *
 * **安全默认**：本地 dev **默认连模拟器**（额度恒 0），只有显式 `VITE_ALLOW_PROD=true`
 * （`npm run dev:prod`，加载 `.env.prod`）才在 dev 下连生产。这样 `npm run dev` 不会再
 * 静默直连生产库烧额度（owner app 用 onSnapshot 直连 Firestore，绕过 /api，Vercel 日志看不到）。
 *
 * 生产构建里 `import.meta.env.DEV` 被静态替换成 `false`，整段连接代码会被 tree-shake，
 * **生产物理上不可能连到模拟器**。
 */
const ALLOW_PROD_IN_DEV = import.meta.env.VITE_ALLOW_PROD === 'true';
const USE_EMULATOR = import.meta.env.DEV && !ALLOW_PROD_IN_DEV;

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
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
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

// 开发安全网：万一 dev 下连了【生产】库（显式 VITE_ALLOW_PROD=true），弹一条躲不掉的红条 + 报错，
// 避免再次出现「本地调试静默烧生产额度」。生产构建里 import.meta.env.DEV=false → 整段被 tree-shake。
if (import.meta.env.DEV && !USE_EMULATOR) {
  console.error(
    '[firebase] ⚠️ 本地正连【生产】Firestore —— 会消耗免费读写额度！本地开发请用 `npm run dev`（默认连模拟器，需先 `npm run emu`）。'
  );
  if (typeof document !== 'undefined') {
    const banner = document.createElement('div');
    banner.textContent = '⚠️ 本地正连「生产」Firestore，正在消耗额度 —— 本地开发请用 npm run dev（连模拟器）';
    banner.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;background:#C24127;color:#fff;font:600 13px/1.45 system-ui,sans-serif;padding:8px 14px;text-align:center;letter-spacing:.02em;box-shadow:0 1px 6px rgba(0,0,0,.25)';
    const mount = () => document.body && document.body.prepend(banner);
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
  }
}
