import { createClient } from '@supabase/supabase-js';

const sourceUrl = String(import.meta.env.VITE_AESTHETIC_SOURCE_SUPABASE_URL || '').trim();
const sourceKey = String(import.meta.env.VITE_AESTHETIC_SOURCE_SUPABASE_PUBLISHABLE_KEY || '').trim();
export const aestheticSourceEnvironment = String(import.meta.env.VITE_AESTHETIC_SOURCE_ENV || '').trim().toLowerCase();

export const aestheticSourceConfigError = !sourceUrl || !sourceKey
  ? '本地实验的数据源未配置'
  : aestheticSourceEnvironment !== 'production'
    ? '本地实验数据源必须明确标记为 Production（只读）'
    : null;

/**
 * Separate auth client for the read-only source account. It never replaces
 * the app's Development client and uses its own storage key.
 */
export const aestheticSourceSupabase = !aestheticSourceConfigError
  ? createClient(sourceUrl, sourceKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'wearlog-aesthetic-source-auth-v1',
      },
    })
  : null;

