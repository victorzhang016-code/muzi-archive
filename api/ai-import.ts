import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * AI 导入代理 - 把文档文字转给 Kimi 解析成结构化衣物 JSON。
 *
 * 安全：
 * - 必须携带合法 Firebase ID Token
 * - 请求体大小上限
 * - 持久化限流状态（Firestore 文档），避免多实例/冷启动绕过
 */

const PROJECT = 'gen-lang-client-0133868878';
const DB = 'ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${encodeURIComponent(DB)}/documents`;
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 40;
const MAX_BODY_CHARS = 600_000;
const RATE_RETRY_MAX = 4;

const docPath = (uid: string) => `${FIRESTORE_BASE}/ai_import_usage/${encodeURIComponent(uid)}`;

type RateRecord = {
  windowStart: number;
  count: number;
};

type FirestoreDoc = {
  fields?: {
    windowStart?: { integerValue?: string };
    count?: { integerValue?: string };
  };
  updateTime?: string;
};

function authHeaders(idToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${idToken}`,
    'content-type': 'application/json',
  };
}

function encodeRateRecord(record: RateRecord) {
  return {
    fields: {
      windowStart: { integerValue: String(record.windowStart) },
      count: { integerValue: String(record.count) },
    },
  };
}

function decodeRateRecord(doc: FirestoreDoc | null | undefined): RateRecord | null {
  if (!doc?.fields) return null;
  const windowStart = Number(doc.fields.windowStart?.integerValue || 0);
  const count = Number(doc.fields.count?.integerValue || 0);
  if (!Number.isFinite(windowStart) || !Number.isFinite(count) || windowStart <= 0 || count < 0) {
    return null;
  }
  return { windowStart, count };
}

async function readRateRecord(uid: string, idToken: string): Promise<{ record: RateRecord | null; updateTime?: string }> {
  try {
    const res = await fetch(docPath(uid), {
      headers: { authorization: `Bearer ${idToken}` },
    });
    if (res.status === 404) return { record: null };
    if (!res.ok) throw new Error(`read rate ${res.status}`);
    const doc = await res.json() as FirestoreDoc;
    return { record: decodeRateRecord(doc), updateTime: doc.updateTime };
  } catch {
    return { record: null };
  }
}

async function writeRateRecord(
  uid: string,
  idToken: string,
  record: RateRecord,
  updateTime?: string,
  exists?: boolean
): Promise<'ok' | 'conflict' | 'error'> {
  const url = new URL(docPath(uid));
  url.searchParams.set('updateMask.fieldPaths', 'windowStart');
  url.searchParams.append('updateMask.fieldPaths', 'count');
  if (updateTime) {
    url.searchParams.set('currentDocument.exists', 'true');
    url.searchParams.set('currentDocument.updateTime', updateTime);
  } else if (exists === false) {
    url.searchParams.set('currentDocument.exists', 'false');
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: authHeaders(idToken),
      body: JSON.stringify(encodeRateRecord(record)),
    });
    if (res.ok) return 'ok';
    if (res.status === 409 || res.status === 412) return 'conflict';
    return 'error';
  } catch {
    return 'error';
  }
}

async function checkAndIncrementRate(uid: string, idToken: string): Promise<boolean> {
  const now = Date.now();
  for (let attempt = 0; attempt < RATE_RETRY_MAX; attempt += 1) {
    const { record, updateTime } = await readRateRecord(uid, idToken);
    const withinWindow = !!record && now - record.windowStart < RATE_WINDOW_MS;
    const current = withinWindow && record ? record : { windowStart: now, count: 0 };

    if (current.count >= RATE_MAX) return true;

    const next: RateRecord = withinWindow
      ? { windowStart: current.windowStart, count: current.count + 1 }
      : { windowStart: now, count: 1 };

    const result = await writeRateRecord(uid, idToken, next, updateTime, updateTime ? true : false);
    if (result === 'ok') return false;
    if (result === 'error') return true;
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

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

  if (await checkAndIncrementRate(uid, token)) {
    return res.status(429).json({ error: '导入太频繁了，请过一会儿再试（每小时上限 40 次）' });
  }

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { messages } = req.body || {};
  if (!messages) return res.status(400).json({ error: 'messages required' });

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
