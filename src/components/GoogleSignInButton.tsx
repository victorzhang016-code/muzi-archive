import { useEffect, useRef, useState } from 'react';
import { mountGoogleButton, signInWithGoogleIdToken } from '../lib/googleIdToken';

export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [officialButtonVisible, setOfficialButtonVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cleanup: (() => void) | undefined;
    let active = true;
    const observer = new MutationObserver(() => {
      if (container.childElementCount > 0) setOfficialButtonVisible(true);
    });
    observer.observe(container, { childList: true, subtree: true });

    mountGoogleButton(container, (value) => {
      if (!active) return;
      setError(value instanceof Error ? value.message : 'Google 登录失败，请重试。');
    })
      .then((dispose) => {
        window.setTimeout(() => {
          if (active && container.childElementCount > 0) setOfficialButtonVisible(true);
        }, 1200);
        if (active) cleanup = dispose;
        else dispose();
      })
      .catch((value) => {
        if (active) setError(value instanceof Error ? value.message : 'Google 登录组件加载失败。');
      });

    return () => {
      active = false;
      observer.disconnect();
      cleanup?.();
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="w-full max-w-xs">
      <div ref={containerRef} className={`${officialButtonVisible ? 'flex' : 'hidden'} min-h-11 w-full justify-center`} aria-label="使用 Google 账号登录" />
      {!officialButtonVisible && <button type="button" onClick={() => { void signInWithGoogleIdToken().catch((value) => setError(value instanceof Error ? value.message : 'Google 登录失败，请重试。')); }} className="w-full min-h-11 rounded-full bg-[#1f1f1f] px-5 text-sm font-medium text-white shadow-sm hover:bg-[#303030] transition-colors">使用 Google 账号登录</button>}
      {error && <p className="mt-3 text-xs text-stamp">{error}</p>}
    </div>
  );
}
