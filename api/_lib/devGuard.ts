import type { VercelResponse } from '@vercel/node';

function env(name: string): string {
  return String(process.env[name] || '').trim().toLowerCase();
}

function isTruthy(value: string): boolean {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

/**
 * 本地 / vercel dev 下，默认禁止 serverless API 直读生产 Firestore。
 * 只有显式设置 ALLOW_DEV_PROD_FIRESTORE=true 才允许穿透。
 */
export function blockDevProdFirestore(res: VercelResponse): boolean {
  const isProduction = env('VERCEL_ENV') === 'production' || env('NODE_ENV') === 'production';
  const explicitlyAllowed = isTruthy(env('ALLOW_DEV_PROD_FIRESTORE'));

  if (isProduction || explicitlyAllowed) return false;

  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({
    error: 'dev_prod_firestore_blocked',
    message: '本地开发环境已默认禁止 Serverless API 访问生产 Firestore。若确需放行，请显式设置 ALLOW_DEV_PROD_FIRESTORE=true。',
  });
  return true;
}
