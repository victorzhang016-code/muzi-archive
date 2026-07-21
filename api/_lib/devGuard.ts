import type { VercelResponse } from '@vercel/node';

function env(name: string): string {
  return String(process.env[name] || '').trim().toLowerCase();
}

function isTruthy(value: string): boolean {
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

/**
 * 本地 / Vercel Preview 下，只允许 serverless API 访问明确配置的
 * Development Supabase；Production 侧必须明确配置为 Production。
 * ALLOW_DEV_PROD_SERVICES 仅保留给历史兼容场景，不作为 Development 的前置条件。
 */
export function blockDevProdServices(res: VercelResponse): boolean {
  // Do not trust NODE_ENV here: a local `vercel dev` process can be started with
  // NODE_ENV=production. Vercel_ENV is the deployment boundary we control.
  const isProduction = env('VERCEL_ENV') === 'production';
  const explicitlyAllowed = isTruthy(process.env.ALLOW_DEV_PROD_SERVICES || '');
  const supabaseEnvironment = env('SUPABASE_ENV');

  if (isProduction && supabaseEnvironment !== 'production') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({
      error: 'production_supabase_environment_missing',
      message: 'Production server requires SUPABASE_ENV=production.',
    });
    return true;
  }

  if (!isProduction && supabaseEnvironment !== 'development') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      error: 'nonproduction_supabase_environment_missing',
      message: 'Preview/local server requires SUPABASE_ENV=development.',
    });
    return true;
  }

  if (isProduction || supabaseEnvironment === 'development' || explicitlyAllowed) return false;

  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({
    error: 'dev_prod_services_blocked',
    message: '本地开发环境已默认禁止 Serverless API 访问生产侧服务。若确需放行，请显式设置 ALLOW_DEV_PROD_SERVICES=true。',
  });
  return true;
}
