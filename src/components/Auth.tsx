import { useState, useEffect } from 'react';
import {
  signInWithPopup, signInWithRedirect, getRedirectResult,
  linkWithPopup, linkWithRedirect,
  GoogleAuthProvider, signOut, onAuthStateChanged, User
} from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, LogOut, Loader2 } from 'lucide-react';

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle errors from mobile redirect sign-in (e.g. credential-already-in-use)
    getRedirectResult(auth).catch(async (error) => {
      if (error.code === 'auth/credential-already-in-use') {
        await signInWithRedirect(auth, new GoogleAuthProvider());
      } else {
        console.error('Redirect sign-in error:', error);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    const currentUser = auth.currentUser;
    try {
      if (isMobile) {
        if (currentUser?.isAnonymous) {
          await linkWithRedirect(currentUser, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
      } else {
        if (currentUser?.isAnonymous) {
          await linkWithPopup(currentUser, provider);
        } else {
          await signInWithPopup(auth, provider);
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/credential-already-in-use') {
        if (isMobile) {
          await signInWithRedirect(auth, provider);
        } else {
          await signInWithPopup(auth, provider);
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
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <button disabled className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading...</span>
      </button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          )}
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.displayName}</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-black hover:bg-gray-800 text-white transition-colors text-sm font-medium"
    >
      <LogIn className="w-4 h-4" />
      <span className="hidden sm:inline">Sign In with Google</span>
      <span className="sm:hidden">登录</span>
    </button>
  );
}
