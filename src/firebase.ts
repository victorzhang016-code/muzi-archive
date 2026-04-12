import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// 自动握手：匿名登录
signInAnonymously(auth).then((userCredential) => {
  console.log('Logged in as:', userCredential.user.uid);
}).catch((error) => {
  console.error('Anonymous auth failed:', error);
});
