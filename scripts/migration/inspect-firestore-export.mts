import { readFile } from 'node:fs/promises';

const input = process.argv.find((arg) => arg.startsWith('--input='))?.slice('--input='.length);
if (!input) throw new Error('Usage: npx tsx scripts/migration/inspect-firestore-export.mts --input=path.json');

const payload = JSON.parse(await readFile(input, 'utf8')) as {
  format: string;
  collections: Record<string, Array<{ name: string; fields?: Record<string, any> }>>;
};
if (payload.format !== 'wearlog-firestore-export-v1') throw new Error('Unsupported export format');

const userIds = new Set<string>();
let legacyImageFields = 0;
let remoteImageUrls = 0;
const ownerStats = new Map<string, { items: number; matches: number; userDoc: boolean; names: string[] }>();
for (const [collection, documents] of Object.entries(payload.collections)) {
  for (const document of documents) {
    const fields = document.fields || {};
    const userId = fields.userId?.stringValue;
    if (userId) {
      userIds.add(userId);
      const stats = ownerStats.get(userId) || { items: 0, matches: 0, userDoc: false, names: [] };
      if (collection === 'wardrobe_items') {
        stats.items += 1;
        if (stats.names.length < 3 && fields.name?.stringValue) stats.names.push(fields.name.stringValue);
      }
      if (collection === 'best_matches') stats.matches += 1;
      ownerStats.set(userId, stats);
    }
    if (collection === 'wardrobe_users') {
      const documentId = document.name.split('/').pop() || '';
      const stats = ownerStats.get(documentId) || { items: 0, matches: 0, userDoc: false, names: [] };
      stats.userDoc = true;
      ownerStats.set(documentId, stats);
    }
    if (fields.imageUrlBackup || fields.photoBackup) legacyImageFields += 1;
    for (const field of ['imageUrl', 'photoBase64']) {
      if (typeof fields[field]?.stringValue === 'string' && /^https?:\/\//i.test(fields[field].stringValue)) {
        remoteImageUrls += 1;
      }
    }
  }
  console.log(`${collection}: ${documents.length}`);
}
console.log(`distinct data owner UIDs: ${userIds.size}`);
console.log(`legacy image backup documents: ${legacyImageFields}`);
console.log(`remote image URLs: ${remoteImageUrls}`);
console.log(`owner UIDs (verify manually before import): ${JSON.stringify([...userIds].sort())}`);
for (const uid of [...ownerStats.keys()].sort()) {
  const stats = ownerStats.get(uid)!;
  console.log(`owner ${uid}: items=${stats.items}, matches=${stats.matches}, wardrobe_user_doc=${stats.userDoc}, sample_names=${JSON.stringify(stats.names)}`);
}
