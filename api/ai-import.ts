import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * AI 导入代理 —— 把文档文字转给 Kimi 解析成结构化衣物 JSON。
 *
 * 安全：此接口会消耗服务端 KIMI_API_KEY（真金白银），必须防止被匿名脚本滥用。
 * 因此要求调用方携带**合法的 Firebase ID Token**（Authorization: Bearer <token>），
 * 用 Google 公钥验签（免 firebase-admin，与 api/public 一致的免 SDK 风格）。
 * 再叠加请求体大小上限，挡掉超大单次调用。
 */

// projectId（与前端 firebase 配置一致，本就公开，非密钥）
const PROJECT = 'gen-lang-client-0133868878';

// Firebase ID Token 的签名公钥（JWKS，jose 会自动缓存 + 处理 key 轮换）
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

// 单次请求体上限：正常导入的文档文字远小于此；超过基本是滥用/误传
const MAX_BODY_CHARS = 600_000;

// 按用户限流：KIMI_API_KEY 是借来、无法轮换的（真金白银），鉴权只挡住匿名脚本，
// 但任何登录用户都能反复调用、把 messages 当免费 LLM 代理刷。这里再加一道每用户限流。
// 说明：这是「尽力而为」级——计数在模块作用域的内存里，Vercel 冷启/多实例会各自归零，
// 不是强一致配额；目的在于挡住单用户的循环/连刷，对小范围试用足够。
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 小时滑动窗口
const RATE_MAX = 40;                    // 每用户每小时最多 40 次导入解析
const hits = new Map<string, number[]>(); // uid -> 近期调用时间戳

function rateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(uid, recent);
    return true;
  }
  recent.push(now);
  hits.set(uid, recent);
  // 顺手清理：Map 过大时丢弃不再活跃的 uid，避免无界增长
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  // 1) 鉴权：必须是已登录的 Firebase 用户
  const authz = (req.headers.authorization as string) || '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: '请登录后再使用导入功能' });
  let uid: string;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT}`,
      audience: PROJECT,
    });
    uid = String(payload.sub || payload.user_id || '');
    if (!uid) throw new Error('no subject');
  } catch {
    return res.status(401).json({ error: '登录状态已失效，请刷新页面重新登录后再导入' });
  }

  // 1.5) 按用户限流，保护借来的 API key
  if (rateLimited(uid)) {
    return res.status(429).json({ error: '导入太频繁了，请过一会儿再试（每小时上限 40 次）' });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { messages } = req.body || {};
  if (!messages) return res.status(400).json({ error: 'messages required' });

  // 2) 体积上限：防止单次超大调用烧 token
  const size = JSON.stringify(messages).length;
  if (size > MAX_BODY_CHARS) {
    return res.status(413).json({ error: `内容过长（约 ${Math.round(size / 1000)}K 字符），请分批导入` });
  }

  const aiRes = await fetch('https://api.kimi.com/coding/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 16384, messages }),
  });

  const data = await aiRes.json();
  return res.status(aiRes.status).json(data);
}
