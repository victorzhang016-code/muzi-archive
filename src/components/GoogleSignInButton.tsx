import { useEffect, useRef, useState } from 'react';
import { mountGoogleButton } from '../lib/googleIdToken';

export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cleanup: (() => void) | undefined;
    let active = true;

    mountGoogleButton(container, (value) => {
      if (!active) return;
      setError(value instanceof Error ? value.message : 'Google 登录失败，请重试。');
    })
      .then((dispose) => {
        if (active) cleanup = dispose;
        else dispose();
      })
      .catch((value) => {
        if (active) setError(value instanceof Error ? value.message : 'Google 登录组件加载失败。');
      });

    return () => {
      active = false;
      cleanup?.();
      container.replaceChildren();
    };
  }, []);

  return (
    <div className="w-full max-w-xs">
      <div ref={containerRef} className="flex min-h-11 w-full justify-center" aria-label="使用 Google 账号登录" />
      {error && <p className="mt-3 text-xs text-stamp">{error}</p>}
    </div>
  );
}
