import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.MIGRATION_ENV_FILE || '.env.migration.local', quiet: true });

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const authExportPath = arg('auth-export');
const validUids = (arg('valid-uids') || '').split(',').map((value) => value.trim()).filter(Boolean);
const outputPath = resolve(arg('out') || './supabase-user-map.json');
const apply = process.argv.includes('--apply');
if (!authExportPath || validUids.length !== 2) throw new Error('Usage: --auth-export=auth.json --valid-uids=uid1,uid2 --out=map.json [--apply]');

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

type FirebaseUser = { localId: string; email?: string; emailVerified?: boolean; providerUserInfo?: Array<{ providerId?: string }> };
type SupabaseUser = { id: string; email?: string };
const firebase = JSON.parse(await readFile(authExportPath, 'utf8')) as { users: FirebaseUser[] };
const sourceUsers = validUids.map((uid) => firebase.users.find((user) => user.localId === uid));
if (sourceUsers.some((user) => !user?.email)) throw new Error('Every valid UID must exist in Auth export with an email');
if (sourceUsers.some((user) => !(user?.providerUserInfo || []).some((provider) => provider.providerId === 'google.com'))) throw new Error('Every valid UID must have a Google provider in the Auth export');

const headers = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
async function listSupabaseUsers(): Promise<SupabaseUser[]> {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!response.ok) throw new Error(`list Supabase users failed: ${response.status}`);
  return ((await response.json()) as { users?: SupabaseUser[] }).users || [];
}

const existing = await listSupabaseUsers();
const plan = sourceUsers.map((user) => ({ legacy_firebase_uid: user!.localId, email: user!.email!, existing_supabase_id: existing.find((item) => item.email?.toLowerCase() === user!.email!.toLowerCase())?.id || null }));
console.log(JSON.stringify({ apply, users: plan.map((row) => ({ legacy_firebase_uid: row.legacy_firebase_uid, existing: !!row.existing_supabase_id })), output: outputPath }, null, 2));
if (!apply) {
  // Dry-run intentionally stops here without mutating Supabase. Avoid process.exit()
  // because Node on Windows may report open proxy sockets as a false failure.
} else {

const created: Array<{ legacy_firebase_uid: string; email: string; supabase_user_id: string }> = [];
for (const row of plan) {
  let id = row.existing_supabase_id;
  if (!id) {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email: row.email,
        email_confirm: true,
        password: randomBytes(32).toString('base64url'),
        user_metadata: { legacy_firebase_uid: row.legacy_firebase_uid },
      }),
    });
    if (!response.ok) throw new Error(`create Supabase user failed for ${row.legacy_firebase_uid}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    id = (await response.json() as SupabaseUser).id;
  }
  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, public_id: row.legacy_firebase_uid, legacy_firebase_uid: row.legacy_firebase_uid }),
  });
  if (!profileResponse.ok) throw new Error(`create profile failed for ${row.legacy_firebase_uid}: ${profileResponse.status} ${(await profileResponse.text()).slice(0, 200)}`);
  created.push({ legacy_firebase_uid: row.legacy_firebase_uid, email: row.email, supabase_user_id: id });
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ format: 'wearlog-supabase-user-map-v1', generatedAt: new Date().toISOString(), users: created }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Provisioned ${created.length} users and profiles. Mapping written outside Git: ${outputPath}`);
}
