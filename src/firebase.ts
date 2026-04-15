import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// 自动匿名登录：必须等 Firebase 处理完 redirect 结果后再判断
// 直接调用 signInAnonymously() 会和 signInWithRedirect 产生竞争，
// 导致 redirect 回来时创建新的匿名 UID，手机端与 PC 端 UID 不一致
const unsub = onAuthStateChanged(auth, (user) => {
  unsub(); // 只运行一次
  if (!user) {
    signInAnonymously(auth).catch((e) => console.error('Anonymous auth failed:', e));
  }
});
