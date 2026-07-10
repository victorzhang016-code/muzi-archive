import { supabase } from './supabase';

const GOOGLE_CLIENT_ID = '915859619424-513s95ujf3rlh2ec4d60ooracvgt29va.apps.googleusercontent.com';
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(options: { client_id: string; callback: (response: { credential?: string }) => void; use_fedcm_for_prompt?: boolean; nonce?: string }): void;
      prompt(callback?: (notification: { isNotDisplayed(): boolean; getNotDisplayedReason(): string }) => void): void;
      cancel(): void;
    } } };
  }
}

function loadGoogleIdentityServices() {
  if (window.google?.accounts.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 登录组件加载失败，请检查网络。'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function signInWithGoogleIdToken(): Promise<void> {
  if (!supabase) throw new Error('Supabase 未配置');
  await loadGoogleIdentityServices();
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await new Promise<void>((resolve, reject) => {
    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      use_fedcm_for_prompt: true,
      nonce: hashedNonce,
      callback: async ({ credential }) => {
        if (!credential) return reject(new Error('Google 未返回登录凭据。'));
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
        if (error) reject(error); else resolve();
      },
    });
    window.google!.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) reject(new Error(`Google 登录窗口未显示：${notification.getNotDisplayedReason()}`));
    });
  });
}
