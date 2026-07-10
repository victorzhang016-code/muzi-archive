# Firebase Enterprise to Supabase Migration Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move wearlog's two real data owners from the Firebase Enterprise free-tier database to Supabase Free without data loss, while preserving existing public share URLs and adding email/password authentication.

**Architecture:** Vercel remains the web/API host and Vercel Blob remains the image store. Supabase Singapore provides Postgres and Auth. Existing Firebase data is exported, mapped by explicit legacy UID, dry-run imported, then cut over during a short read-only window. Old Firebase data remains read-only for rollback.

**Tech Stack:** React + TypeScript + Vite, Vercel Functions/Blob, Supabase JS/Postgres/RLS, Supabase Auth, Firebase REST/CLI for export, Vitest/Playwright for verification.

---

## Safety gates

1. Export Firebase Auth, every Firestore collection, and every referenced Blob object; encrypt and checksum backups outside Git.
2. Derive the two valid owners from `wardrobe_items.userId` and `best_matches.userId`; never infer ownership from `wardrobe_users` or the Auth account list.
3. Run a Supabase Singapore connectivity/auth/read-write smoke test on mainland networks. If it fails, stop before production migration and evaluate a Vercel API proxy.
4. Run the full import against a disposable Supabase project and compare counts, IDs, timestamps, share flags, image URLs, and item references.
5. Freeze Firebase writes, perform final export/import, switch Vercel variables, and keep Firebase read-only for 30 days.

## Data and identity

- Preserve Firestore document IDs as text primary keys.
- Add `profiles(id, public_id, legacy_firebase_uid, wardrobe_public)`; existing Firebase UIDs become stable `public_id` values so current share URLs and QR codes continue to work.
- Add `wardrobe_items`, `best_matches`, `aesthetic_profiles`, and `ai_import_usage` tables. Keep Best Match `items` as JSONB and `all_item_ids` as a text array for behavior parity.
- Do not import legacy Base64 backup fields; preserve them only in encrypted raw backups.
- Use RLS for owner access. Public pages query server-side API handlers that enforce `shared`/`wardrobe_public` gates.
- Use Supabase Auth email/password as the primary login, Google as optional, custom SMTP, email verification, CAPTCHA, and per-user upload/row limits.

## Cutover and compatibility

- Replace Firebase client reads/writes and Firebase JWT verification in `api/ai-import.ts` and `api/blob-upload.ts` with Supabase Auth/JWT handling.
- Keep `/share/:uid`, `/share/:uid/item/:id`, `/share/:uid/best-match/:id`, and `/api/public*` URL shapes unchanged; `uid` becomes `profiles.public_id`.
- Keep Vercel Blob URLs and proxy image access through the existing cacheable `/api/img` route.
- Configure the Alibaba domain on Vercel, then update Supabase Site URL, redirect URLs, Google OAuth callback, canonical URLs, sitemap, and robots.

## Verification and rollback

- Automated tests cover mapping, timestamp conversion, RLS isolation, auth flows, CRUD, sharing gates, image upload, AI rate limiting, and public APIs.
- Acceptance requires exact migrated counts and IDs for both valid owners, zero private cross-user reads, working old share URLs, working email login, and successful mainland no-VPN smoke tests.
- Do not delete Firebase accounts or data until the 30-day rollback window passes and a second export confirms no unaccounted data.
