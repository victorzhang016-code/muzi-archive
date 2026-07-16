import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 未配置，迁移期间继续使用 Firebase。');
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

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
  })
  : null;

// Register as soon as the singleton is created so a recovery event cannot be
// missed while React is still mounting the route tree.
if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') recoverySessionDetected = true;
  });
}
