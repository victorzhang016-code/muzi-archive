import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

type WireValue = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; timestampValue?: string; arrayValue?: { values?: WireValue[] }; mapValue?: { fields?: Record<string, WireValue> }; nullValue?: null };
type ExportDoc = { name: string; fields?: Record<string, WireValue>; createTime?: string; updateTime?: string };
type ExportFile = { format: string; collections: Record<string, ExportDoc[]> };

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = arg('input');
const out = resolve(arg('out') || './supabase-import-dry-run.json');
const valid = new Set((arg('valid-uids') || '').split(',').map((value) => value.trim()).filter(Boolean));
const excluded = new Set((arg('exclude-uids') || '').split(',').map((value) => value.trim()).filter(Boolean));
if (!input || valid.size === 0) throw new Error('Usage: --input=export.json --valid-uids=uid1,uid2 [--exclude-uids=uid3] --out=import.json');

const source = JSON.parse(await readFile(input, 'utf8')) as ExportFile;
if (source.format !== 'wearlog-firestore-export-v1') throw new Error('Unsupported Firestore export format');

const value = (raw: WireValue | undefined): any => {
  if (!raw) return undefined;
  if ('stringValue' in raw) return raw.stringValue;
  if ('integerValue' in raw) return Number(raw.integerValue);
  if ('doubleValue' in raw) return raw.doubleValue;
  if ('booleanValue' in raw) return raw.booleanValue;
  if ('nullValue' in raw) return null;
  if ('timestampValue' in raw) return raw.timestampValue;
  if ('arrayValue' in raw) return (raw.arrayValue?.values || []).map(value);
  if ('mapValue' in raw) return Object.fromEntries(Object.entries(raw.mapValue?.fields || {}).map(([key, item]) => [key, value(item)]));
  return undefined;
};
const fields = (doc: ExportDoc) => Object.fromEntries(Object.entries(doc.fields || {}).map(([key, raw]) => [key, value(raw)]));
const idOf = (doc: ExportDoc) => doc.name.split('/').pop() || '';
const timestamp = (doc: ExportDoc, key: string) => {
  const raw = fields(doc)[key];
  return raw ? new Date(raw).toISOString() : new Date(doc.updateTime || doc.createTime || 0).toISOString();
};
const owner = (data: any) => data.userId as string | undefined;
const ownerRows = new Map<string, { items: number; matches: number }>();
const excludedRows = new Map<string, { items: number; matches: number }>();
const bump = (map: Map<string, { items: number; matches: number }>, uid: string, kind: 'items' | 'matches') => {
  const row = map.get(uid) || { items: 0, matches: 0 };
  row[kind] += 1;
  map.set(uid, row);
};
const assertOwner = (uid: string | undefined, id: string) => {
  if (!uid) throw new Error(`Missing userId in ${id}`);
  if (valid.has(uid)) return true;
  if (excluded.has(uid)) return false;
  throw new Error(`Unknown owner ${uid} in ${id}; add it explicitly to --valid-uids or --exclude-uids`);
};
const assertRemoteImage = (data: any, id: string) => {
  for (const key of ['imageUrl', 'photoBase64']) {
    const image = data[key];
    if (typeof image === 'string' && image.startsWith('data:')) throw new Error(`Active record ${id} still has a data URL in ${key}; migrate that image to Blob before import`);
  }
};

const profiles = [...valid].map((uid) => ({ public_id: uid, legacy_firebase_uid: uid, wardrobe_public: false }));
for (const doc of source.collections.wardrobe_users || []) {
  const uid = idOf(doc);
  if (!valid.has(uid)) continue;
  const data = fields(doc);
  const profile = profiles.find((row) => row.legacy_firebase_uid === uid)!;
  profile.wardrobe_public = data.wardrobePublic === true;
}

const items = [];
for (const doc of source.collections.wardrobe_items || []) {
  const data = fields(doc);
  const uid = owner(data);
  if (!assertOwner(uid, idOf(doc))) { bump(excludedRows, uid!, 'items'); continue; }
  assertRemoteImage(data, idOf(doc));
  bump(ownerRows, uid!, 'items');
  items.push({ id: idOf(doc), legacy_owner_uid: uid, name: data.name || '', brand: data.brand ?? null, category: data.category, season: data.season, length: data.length ?? null, top_type: data.topType ?? null, accessory_type: data.accessoryType ?? null, rating: data.rating ?? null, story: data.story || '', purchase_year: data.purchaseYear ?? null, image_url: data.imageUrl ?? null, order_index: data.orderIndex ?? null, shared: data.shared === true, created_at: timestamp(doc, 'createdAt'), updated_at: timestamp(doc, 'updatedAt') });
}

const matches = [];
for (const doc of source.collections.best_matches || []) {
  const data = fields(doc);
  const uid = owner(data);
  if (!assertOwner(uid, idOf(doc))) { bump(excludedRows, uid!, 'matches'); continue; }
  assertRemoteImage(data, idOf(doc));
  bump(ownerRows, uid!, 'matches');
  matches.push({ id: idOf(doc), legacy_owner_uid: uid, items: data.items || {}, all_item_ids: data.allItemIds || [], name: data.name ?? null, story: data.story ?? data.note ?? null, scene_tags: data.sceneTags ?? null, photo_url: data.photoBase64 ?? null, shared: data.shared === true, created_at: timestamp(doc, 'createdAt'), updated_at: timestamp(doc, 'updatedAt') });
}

const payload = { format: 'wearlog-supabase-import-v1', generatedAt: new Date().toISOString(), validOwners: [...valid].sort(), excludedOwners: [...excluded].sort(), profiles, items, matches, ownerCounts: Object.fromEntries([...ownerRows.entries()]), excludedCounts: Object.fromEntries([...excludedRows.entries()]) };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(JSON.stringify({ output: out, validOwners: payload.validOwners, excludedOwners: payload.excludedOwners, importedItems: items.length, importedMatches: matches.length, excludedCounts: payload.excludedCounts }, null, 2));
