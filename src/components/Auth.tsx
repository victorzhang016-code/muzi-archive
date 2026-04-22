import { useState, useEffect } from 'react';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, signOut, onAuthStateChanged, User
} from 'firebase/auth';
import { auth } from '../firebase';
import { LogOut, Loader2 } from 'lucide-react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 处理重定向回跳（兜底：如果旧 redirect 流程回跳过来）
    getRedirectResult(auth).catch((error) => {
      console.error('Redirect sign-in error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser && !firebaseUser.isAnonymous ? firebaseUser : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      // 优先 popup（桌面 + 手机均适用）
      // signInWithRedirect 在手机默认浏览器 / Chrome Custom Tabs 里会因
      // session storage 被清空而丢失 state，导致登录失败
      await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        // popup 被系统拦截时降级到 redirect
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectError) {
          console.error('Redirect sign-in error:', redirectError);
        }
      } else {
        console.error('Error signing in with Google', error);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return { user, loading, login, logout };
}

export function AuthButton() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    );
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      {user.photoURL && (
        <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
      )}
      <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.displayName}</span>
      <button
        onClick={logout}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors text-sm font-medium"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">退出</span>
      </button>
    </div>
  );
}
