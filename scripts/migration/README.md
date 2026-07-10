# Wearlog migration tools

These commands are read-only against Firebase and must be run before any migration or cleanup.

1. Authenticate with Google Application Default Credentials outside the repository:

```powershell
gcloud auth application-default login
```

2. Export the named Firestore database to a new file. The command refuses to overwrite an existing file:

```powershell
npx tsx scripts/migration/export-firestore.mts --out=E:\personal-backups\wearlog\firestore-YYYYMMDD.json
```

3. Inspect counts, distinct data-owner UIDs, legacy Base64 backup fields, and remote image URL counts:

```powershell
npx tsx scripts/migration/inspect-firestore-export.mts --input=E:\personal-backups\wearlog\firestore-YYYYMMDD.json
```

4. Export Firebase Auth separately, then checksum and encrypt both files. Do not commit either export:

```powershell
firebase auth:export E:\personal-backups\wearlog\firebase-auth-YYYYMMDD.json --format=json --project gen-lang-client-0133868878
Get-FileHash E:\personal-backups\wearlog\*.json -Algorithm SHA256
```

The exporter deliberately preserves raw Firestore wire values. A later import mapper, not this backup tool, is responsible for decoding timestamps and validating application fields.

## Supabase Auth provisioning

Run a dry-run first. It only checks that the two confirmed Firebase UIDs have verified Google identities and matching emails:

```powershell
$env:MIGRATION_ENV_FILE = (Resolve-Path .env.migration.local)
npx tsx scripts/migration/provision-supabase-users.mts --auth-export=E:\personal-backups\wearlog\firebase-auth-YYYYMMDD.json --valid-uids=uid1,uid2 --out=E:\personal-backups\wearlog\supabase-user-map.json
```

Only after reviewing the dry-run should `--apply` be added. It creates two Supabase users with random temporary passwords, creates their profiles, and writes the UID map outside Git. It does not send email or import wardrobe data.
