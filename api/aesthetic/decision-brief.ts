import type { VercelRequest, VercelResponse } from '@vercel/node';
import { blockDevProdServices } from '../_lib/devGuard.js';
import { supabaseRest, verifySupabaseToken } from '../_lib/supabase.js';

const endpoint = process.env.KIMI_API_ENDPOINT || 'https://api.kimi.com/coding/v1/chat/completions';
const model = process.env.KIMI_DECISION_MODEL || process.env.KIMI_MODEL || 'kimi-for-coding';

function bodyOf(req: VercelRequest): Record<string, any> {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body as Record<string, any>;
}

function text(value: unknown, max = 180) { return String(value || '').trim().slice(0, max); }

function extractJson(value: unknown): Record<string, any> | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

function normalizeBrief(value: Record<string, any> | null) {
  const raw = value?.brief && typeof value.brief === 'object' ? value.brief : value;
  if (!raw) return null;
  const brief = { focus: text(raw.focus, 120), problem: text(raw.problem, 120), outcome: text(raw.outcome, 120) };
  return brief.focus || brief.problem || brief.outcome ? brief : null;
}

async function callKimi(prompt: string) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY is not configured');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 700, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: '只输出合法 JSON，不要 Markdown。' }, { role: 'user', content: prompt }] }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Kimi 搭配意图服务返回 ${response.status}`);
  const envelope = JSON.parse(raw) as Record<string, any>;
  return String(envelope.choices?.[0]?.message?.content || envelope.choices?.[0]?.text || envelope.output_text || '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (blockDevProdServices(res)) return;
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  try { await verifySupabaseToken(token); } catch { return res.status(401).json({ error: '登录状态已失效，请重新登录' }); }

  try {
    const rate = await supabaseRest('rpc/consume_ai_import', { method: 'POST', body: JSON.stringify({ p_max: 30, p_window_ms: 3_600_000 }) }, token);
    if (!rate.ok) return res.status(503).json({ error: '分析限流服务暂时不可用' });
    if (await rate.json()) return res.status(429).json({ error: '搭配意图解析请求较多，请稍后重试' });
  } catch { return res.status(503).json({ error: '分析限流服务暂时不可用' }); }

  const body = bodyOf(req);
  if (JSON.stringify(body).length > 128 * 1024) return res.status(413).json({ error: '当前搭配证据过多，无法解析' });
  const incoming = body.request && typeof body.request === 'object' ? body.request as Record<string, any> : {};
  const item = (value: any) => ({ itemId: text(value?.itemId, 120), itemName: text(value?.itemName, 120), slot: text(value?.slot, 40), fields: value?.fields && typeof value.fields === 'object' ? value.fields : {} });
  const anchor = item(incoming.anchor);
  const items = (Array.isArray(incoming.items) ? incoming.items : []).map(item).filter((entry) => entry.itemId && entry.itemName).slice(0, 12);
  if (!text(incoming.matchId, 120) || !anchor.itemId || !items.some((entry) => entry.itemId === anchor.itemId)) return res.status(400).json({ error: '搭配证据缺少核心单品' });
  const evidence = {
    matchId: text(incoming.matchId, 120), outfitName: text(incoming.outfitName, 160), story: text(incoming.story, 1600), anchor, items,
    confirmedTextEvidence: (Array.isArray(incoming.confirmedTextEvidence) ? incoming.confirmedTextEvidence : []).slice(0, 8),
    decisionMechanisms: (Array.isArray(incoming.decisionMechanisms) ? incoming.decisionMechanisms : []).slice(0, 3),
  };
  const promptVersion = text(body.promptVersion, 80) || 'wearlog-decision-brief-v1';
  const prompt = `你是衣LOG的单套搭配意图起草助手。根据这一套搭配的已确认事实，写三句短意图：focus（想突出什么）、problem（要处理什么问题）、outcome（最后效果怎样）。只使用给出的原始说明、确认字段、确认文字和已有规则机制。不补写身形、场景、品牌意图或穿着反馈。语言准确、具体，每项最多60个汉字；证据不足可为空。只返回 JSON：{"brief":{"focus":"","problem":"","outcome":""}}。当前搭配事实：${JSON.stringify(evidence)}`;
  try {
    let content = await callKimi(prompt);
    let brief = normalizeBrief(extractJson(content));
    if (!brief) { content = await callKimi(`只把下列内容修复成合法 JSON，不要重新解释：${content.slice(0, 1800)}`); brief = normalizeBrief(extractJson(content)); }
    if (!brief) return res.status(502).json({ error: 'Kimi 返回内容无法整理成搭配意图' });
    return res.status(200).json({ brief, modelVersion: model, promptVersion });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Kimi 搭配意图解析失败' });
  }
}
