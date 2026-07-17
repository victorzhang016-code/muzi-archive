import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // Vercel Preview and Production both run a production Vite build. Fail at
  // build time if the browser bundle is about to receive the wrong Supabase
  // environment; the runtime guard remains the second line of defence.
  if (process.env.VERCEL === '1') {
    const deployment = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
    const declaredDeployment = String(env.VITE_VERCEL_ENV || '').trim().toLowerCase();
    const declaredSupabase = String(env.VITE_SUPABASE_ENV || '').trim().toLowerCase();
    const expectedSupabase = deployment === 'production' ? 'production' : 'development';
    if (!deployment || declaredDeployment !== deployment || declaredSupabase !== expectedSupabase) {
      throw new Error(
        `[env] Vercel environment mismatch: VITE_VERCEL_ENV=${declaredDeployment || '(missing)'} `
        + `VERCEL_ENV=${deployment || '(missing)'}, VITE_SUPABASE_ENV=${declaredSupabase || '(missing)'}. `
        + 'Set Production to production/production and Preview to preview/development.'
      );
    }
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('[env] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required on Vercel.');
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
