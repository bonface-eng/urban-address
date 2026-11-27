# Firebase-to-Supabase Future Restore Tooling (`scripts/README-MIGRATION.md`)

This directory contains two scripts designed to back up and restore data from Firebase to Supabase if the Firebase project suspension is lifted in the future:

1. **`scripts/backup-firebase.mjs`**: Connects to Firebase via `firebase-admin` (read-only) and exports all 45+ Firestore collections (and subcollections recursively) plus Firebase Auth users to `./migration-output/backup/<timestamp>/`.
2. **`scripts/firebase-export-to-supabase.mjs`**: Reads a backup folder produced by `backup-firebase.mjs` (or any Firestore JSON export following the structure below) and generates batched, FK-ordered PostgreSQL `INSERT` scripts (`ON CONFLICT DO NOTHING`) ready to run in the Supabase SQL Editor.

---

## Expected Input Format for `firebase-export-to-supabase.mjs`

Place your exported JSON files inside an input directory (e.g. `./migration-output/backup/2026-11-27/`):

- `auth-users.json` (optional): Array of Firebase Auth user records (`{ uid, email, emailVerified, displayName, photoURL, customClaims, passwordHash, passwordSalt }`).
- `firestore/<collectionName>.json` (or `<collectionName>.json` directly in the input directory): Array of documents:
  ```json
  [
    {
      "id": "firebase_doc_id",
      "data": {
        "name": "Sample Item",
        "createdAt": { "_type": "Timestamp", "value": "2026-11-01T00:00:00.000Z", "ms": 1793491200000 }
      },
      "_subcollections": {
        "held_bills": [
          { "id": "bill_1", "data": { "type": "LOUNGE", "total": 500 } }
        ]
      }
    }
  ]
  ```

---

## Usage

```bash
node scripts/firebase-export-to-supabase.mjs \
  --input ./migration-output/backup/<timestamp> \
  --output ./migration-output/sql/restored
```

Then execute the generated files in `migration-output/sql/restored/` in order:
1. `05_data_00_auth_and_profiles.sql`
2. `05_data_01_core_tables.sql`
3. `05_data_02_orders_jobs_and_logs.sql`
