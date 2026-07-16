import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const LEGACY_HOSTS = new Set(['wear-log.vercel.app']);

if (LEGACY_HOSTS.has(window.location.hostname)) {
  const target = new URL(window.location.href);
  target.protocol = 'https:';
  target.hostname = 'www.wearlog.cn';
  target.port = '';
  window.location.replace(target.toString());
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
