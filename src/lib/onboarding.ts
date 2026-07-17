export type OnboardingSource = 'author_wardrobe' | 'direct_login' | 'shared_item';

export interface OnboardingIntent {
  source: OnboardingSource;
  returnPath: string;
  next: string;
  createdAt: number;
  expiresAt: number;
}

const STORAGE_KEY = 'wearlog-onboarding-intent-v1';
const TTL_MS = 30 * 60 * 1000;

export function safeOnboardingPath(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

function readStorage(): OnboardingIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingIntent>;
    if (!parsed.createdAt || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      source: parsed.source === 'author_wardrobe' || parsed.source === 'shared_item' ? parsed.source : 'direct_login',
      returnPath: safeOnboardingPath(parsed.returnPath),
      next: safeOnboardingPath(parsed.next),
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function startOnboardingIntent(source: OnboardingSource, returnPath = '/', next = '/') {
  const now = Date.now();
  const intent: OnboardingIntent = {
    source,
    returnPath: safeOnboardingPath(returnPath),
    next: safeOnboardingPath(next),
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent)); } catch { /* private browsing */ }
  return intent;
}

export function getOnboardingIntent() {
  return readStorage();
}

export function consumeOnboardingIntent() {
  const intent = readStorage();
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* private browsing */ }
  return intent;
}

export function getEmailRedirectUrl() {
  const intent = getOnboardingIntent();
  const next = encodeURIComponent(intent?.next ?? '/');
  return `${window.location.origin}/auth/confirm?next=${next}`;
}
