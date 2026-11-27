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

(async () => {
  try {
    await client.connect();
    const sql = fs.readFileSync(path.resolve('migration-output', 'sql', '06_verify.sql'), 'utf-8');
    const res = await client.query(sql);
    console.log('Verification query results:');
    console.dir(res.rows, { depth: null });
  } catch (e) {
    console.error('Verification error:', e);
  } finally {
    await client.end();
  }
})();
