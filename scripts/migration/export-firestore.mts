import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { GoogleAuth } from 'google-auth-library';

const projectId = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0133868878';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'ai-studio-6fd5f2f5-eaa7-473f-b484-cc0b2cdcd9bb';
const collectionIds = (process.env.FIREBASE_COLLECTIONS || 'wardrobe_users,wardrobe_items,best_matches,aesthetic_profiles,ai_import_usage')
  .split(',').map((value) => value.trim()).filter(Boolean);
const outArg = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const outPath = resolve(outArg || `./_private-backups/wearlog/firestore-${new Date().toISOString().replaceAll(':', '-')}.json`);
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents`;

type FirestoreDocument = { name: string; fields?: Record<string, unknown>; createTime?: string; updateTime?: string };

async function accessToken(): Promise<string> {
  try {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const result = await client.getAccessToken();
    const token = typeof result === 'string' ? result : result.token;
    if (token) return token;
  } catch {
    // Fall through to the already-authenticated Firebase CLI session below.
  }

  // Firebase CLI stores the refresh token locally. Reuse it only in this
  // short-lived read-only export process; never print or persist the token.
  try {
    const require = createRequire(import.meta.url);
    const firebaseAuth = require(`${process.env.APPDATA || ''}/npm/node_modules/firebase-tools/lib/auth.js`);
    const account = firebaseAuth.getGlobalDefaultAccount();
    const refreshToken = account?.tokens?.refresh_token;
    if (refreshToken) {
      const result = await firebaseAuth.getAccessToken(refreshToken, ['https://www.googleapis.com/auth/cloud-platform']);
      if (result?.access_token) return result.access_token;
    }
  } catch {
    // Report the actionable authentication error below.
  }
  throw new Error('No Google access token. Run `gcloud auth application-default login` or ensure `firebase login` is active.');
}

async function listCollection(collectionId: string, token: string): Promise<FirestoreDocument[]> {
  const documents: FirestoreDocument[] = [];
  let pageToken = '';
  do {
    const url = new URL(`${base}/${encodeURIComponent(collectionId)}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`${collectionId}: Firestore REST ${response.status} ${await response.text()}`);
    const body = await response.json() as { documents?: FirestoreDocument[]; nextPageToken?: string };
    documents.push(...(body.documents || []));
    pageToken = body.nextPageToken || '';
  } while (pageToken);
  return documents;
}

const token = await accessToken();
const collections: Record<string, FirestoreDocument[]> = {};
for (const collectionId of collectionIds) {
  collections[collectionId] = await listCollection(collectionId, token);
  console.log(`${collectionId}: ${collections[collectionId].length} documents`);
}

const payload = {
  format: 'wearlog-firestore-export-v1',
  exportedAt: new Date().toISOString(),
  projectId,
  databaseId,
  collections,
};

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Wrote immutable export: ${outPath}`);
