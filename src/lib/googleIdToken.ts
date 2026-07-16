import { supabase } from './supabase';

const GOOGLE_CLIENT_ID = '915859619424-513s95ujf3rlh2ec4d60ooracvgt29va.apps.googleusercontent.com';
let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        nonce?: string;
      }): void;
      renderButton(parent: HTMLElement, options: {
        theme?: string;
        size?: string;
        text?: string;
        shape?: string;
        width?: number;
        logo_alignment?: string;
      }): void;
      prompt(callback?: () => void): void;
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

async function createNoncePair() {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return { nonce, hashedNonce };
}

async function exchangeCredential(credential: string | undefined, nonce: string) {
  if (!credential) throw new Error('Google 未返回登录凭据。');
  const { error } = await supabase!.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
  if (error) throw error;
}

/**
 * Mount Google's official Sign in with Google button. Unlike One Tap
 * `prompt()`, this button is activated by an explicit user gesture and is
 * therefore much less affected by browser prompt suppression and FedCM.
 */
export async function mountGoogleButton(container: HTMLElement, onError: (error: unknown) => void) {
  if (!supabase) throw new Error('Supabase 未配置。');
  await loadGoogleIdentityServices();
  const { nonce, hashedNonce } = await createNoncePair();
  let disposed = false;

  window.google!.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: hashedNonce,
    callback: async ({ credential }) => {
      if (disposed) return;
      try {
        await exchangeCredential(credential, nonce);
      } catch (error) {
        onError(error);
      }
    },
  });

  window.google!.accounts.id.renderButton(container, {
    theme: 'filled_black',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    width: 320,
    logo_alignment: 'left',
  });

  return () => {
    disposed = true;
    window.google?.accounts.id.cancel();
    container.replaceChildren();
  };
}

/** One Tap fallback used by the diagnostic auth-check page. */
export async function signInWithGoogleIdToken(): Promise<void> {
  if (!supabase) throw new Error('Supabase 未配置。');
  await loadGoogleIdentityServices();
  const { nonce, hashedNonce } = await createNoncePair();

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Google 登录窗口未显示，请重试或使用正式域名打开。'));
      }
    }, 8000);

    const fail = (error: unknown) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      }
    };

    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashedNonce,
      callback: async ({ credential }) => {
        try {
          await exchangeCredential(credential, nonce);
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            resolve();
          }
        } catch (error) {
          fail(error);
        }
      },
    });

    // Do not call display-moment methods here. Google no longer exposes them
    // when FedCM is enabled, and calling them can leave the login unresolved.
    window.google!.accounts.id.prompt();
  });
}
