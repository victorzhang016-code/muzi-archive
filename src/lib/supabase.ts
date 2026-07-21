import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabaseEnvironment = String(import.meta.env.VITE_SUPABASE_ENV || '').trim().toLowerCase();
const deploymentEnvironment = String(import.meta.env.VITE_VERCEL_ENV || '').trim().toLowerCase();

function isTruthy(value: unknown) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isLocalSupabaseUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function isLocalBrowserHost() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname.toLowerCase());
}

const allowHostedDevSupabase = isTruthy(import.meta.env.VITE_ALLOW_HOSTED_SUPABASE_DEV);
const allowLocalProductionPreview = isTruthy(import.meta.env.VITE_ALLOW_LOCAL_PRODUCTION_PREVIEW);
const deploymentMismatch = import.meta.env.PROD && (
  deploymentEnvironment === 'production'
    ? supabaseEnvironment !== 'production'
    : deploymentEnvironment === 'preview'
      ? supabaseEnvironment !== 'development'
      : true
);
const configurationError = !supabaseUrl || !supabasePublishableKey
  ? 'VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 未配置'
  : import.meta.env.DEV && (
      supabaseEnvironment !== 'development'
      || (!isLocalSupabaseUrl(supabaseUrl) && !allowHostedDevSupabase)
    )
    ? '开发环境只允许连接本地 Supabase；如需连接独立的托管开发项目，显式设置 VITE_ALLOW_HOSTED_SUPABASE_DEV=true'
    : import.meta.env.PROD && deploymentEnvironment === 'production' && supabaseEnvironment !== 'production'
      ? '生产构建必须设置 VITE_SUPABASE_ENV=production'
      : deploymentMismatch
        ? 'Vercel 部署环境与 Supabase 环境不匹配：Production 只能连接 production，Preview 只能连接 development'
      : import.meta.env.PROD && isLocalBrowserHost() && !allowLocalProductionPreview
        ? '禁止在本机预览生产 Supabase 构建；如确需排查请显式设置 VITE_ALLOW_LOCAL_PRODUCTION_PREVIEW=true'
        : null;

if (configurationError) {
  console.error(`[supabase] ${configurationError}`);
}

/**
 * Browser client only. The service-role key must never be placed in Vite env
 * variables or bundled into the browser.
 */
let recoverySessionDetected = false;

export const hasRecoverySession = () => recoverySessionDetected;
export const consumeRecoverySession = () => {
  const detected = recoverySessionDetected;
  recoverySessionDetected = false;
  return detected;
};

export const supabase = !configurationError && supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
  })
  : null;

export const supabaseConfigError = configurationError;

// Register as soon as the singleton is created so a recovery event cannot be
// missed while React is still mounting the route tree.
if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoverySessionDetected = true;
  });
}
