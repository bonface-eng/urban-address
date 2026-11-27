import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connStr = process.env.DATABASE_URL_MIGRATIONS;
if (!connStr) {
  console.error('Missing DATABASE_URL_MIGRATIONS');
  process.exit(1);
}

const client = new Client({ connectionString: connStr });

async function runSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf-8');
  await client.query(sql);
  console.log(`✔ Executed ${path.basename(filePath)}`);
}

(async () => {
  try {
    await client.connect();
    const runOrderPath = path.resolve('migration-output', 'sql', 'RUN_ORDER.md');
    const runOrderContent = fs.readFileSync(runOrderPath, 'utf-8');
    const fileMatches = [...runOrderContent.matchAll(/^- \*\*File:\*\* `([^`]+)`/gm)];
    const files = fileMatches.map(m => path.resolve(m[1]));
    // Ensure we run inside a transaction for safety
    await client.query('BEGIN');
    for (const f of files) {
      await runSqlFile(f);
    }
    await client.query('COMMIT');
    console.log('All migrations applied successfully.');
  } catch (e) {
    console.error('Migration error, rolling back:', e);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
})();
