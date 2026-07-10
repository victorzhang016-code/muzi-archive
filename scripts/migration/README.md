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
