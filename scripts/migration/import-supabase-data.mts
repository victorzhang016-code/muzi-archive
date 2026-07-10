import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import dotenv from 'dotenv'

type Migration = {
  profiles: Array<Record<string, unknown>>
  items: Array<Record<string, unknown>>
  matches: Array<Record<string, unknown>>
}

type UserMap = { users: Array<{ legacy_firebase_uid: string; supabase_user_id: string }> }

const arg = (name: string, fallback?: string) => {
  const prefix = `--${name}=`
  const value = process.argv.find((item) => item.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

const required = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const envFile = arg('env', process.env.MIGRATION_ENV_FILE ?? '.env.migration.local')
dotenv.config({ path: envFile })

const supabaseUrl = required(process.env.SUPABASE_URL, 'SUPABASE_URL')
const serviceRoleKey = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY')
const inputPath = path.resolve(required(arg('input'), 'input (Supabase dry-run JSON)'))
const mapPath = path.resolve(required(arg('map'), 'map (Supabase user map JSON)'))
const apply = process.argv.includes('--apply')
const batchSize = Number(arg('batch-size', '100'))

const migration = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as Migration
const userMap = JSON.parse(fs.readFileSync(mapPath, 'utf8')) as UserMap
const uidToSupabaseId = new Map(userMap.users.map((user) => [user.legacy_firebase_uid, user.supabase_user_id]))

const ownerId = (uid: unknown) => {
  if (typeof uid !== 'string' || !uidToSupabaseId.has(uid)) {
    throw new Error(`No Supabase user mapping for legacy UID: ${String(uid)}`)
  }
  return uidToSupabaseId.get(uid)!
}

const profiles = migration.profiles.map((profile) => ({
  id: ownerId(profile.legacy_firebase_uid),
  public_id: profile.public_id,
  legacy_firebase_uid: profile.legacy_firebase_uid,
  wardrobe_public: profile.wardrobe_public ?? false,
}))

const items = migration.items.map((item) => ({
  id: item.id,
  owner_id: ownerId(item.legacy_owner_uid),
  name: item.name,
  brand: item.brand ?? null,
  category: item.category,
  season: item.season,
  length: item.length ?? null,
  top_type: item.top_type ?? null,
  accessory_type: item.accessory_type ?? null,
  rating: item.rating ?? null,
  story: item.story ?? '',
  purchase_year: item.purchase_year ?? null,
  image_url: item.image_url ?? null,
  order_index: item.order_index ?? null,
  shared: item.shared ?? false,
  created_at: item.created_at,
  updated_at: item.updated_at,
}))

const matches = migration.matches.map((match) => ({
  id: match.id,
  owner_id: ownerId(match.legacy_owner_uid),
  items: match.items ?? {},
  all_item_ids: match.all_item_ids ?? [],
  name: match.name ?? null,
  story: match.story ?? null,
  scene_tags: match.scene_tags ?? null,
  photo_url: match.photo_url ?? null,
  shared: match.shared ?? false,
  created_at: match.created_at,
  updated_at: match.updated_at,
}))

const counts = (rows: Array<{ owner_id?: string }>) =>
  Object.fromEntries([...new Set(rows.map((row) => row.owner_id).filter(Boolean))].map((id) => [id, rows.filter((row) => row.owner_id === id).length]))

console.log(JSON.stringify({
  apply,
  profiles: profiles.length,
  items: items.length,
  matches: matches.length,
  item_counts_by_user: counts(items),
  match_counts_by_user: counts(matches),
}))

if (!apply) process.exit(0)

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
}

async function upsert(table: string, rows: Array<Record<string, unknown>>, conflict: string) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows.slice(i, i + batchSize)),
    })
    if (!response.ok) throw new Error(`${table} batch ${i}-${Math.min(i + batchSize, rows.length)} failed: ${response.status} ${await response.text()}`)
  }
}

await upsert('profiles', profiles, 'id')
await upsert('wardrobe_items', items, 'id')
await upsert('best_matches', matches, 'id')
console.log(JSON.stringify({ imported: { profiles: profiles.length, items: items.length, matches: matches.length } }))
