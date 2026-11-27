import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: connStr });

async function run() {
  await client.connect();
  console.log('--- Table count ---');
  const tbl = await client.query("SELECT count(*) FROM pg_tables WHERE schemaname='public';");
  console.log('Public tables:', tbl.rows[0].count);
  const rls = await client.query("SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity=true;");
  console.log('RLS enabled tables:', rls.rows[0].count);
  const pol = await client.query("SELECT count(*) FROM pg_policies WHERE schemaname='public';");
  console.log('Total RLS policies:', pol.rows[0].count);
  const idx = await client.query("SELECT count(*) FROM pg_indexes WHERE schemaname='public';");
  console.log('Public indexes:', idx.rows[0].count);
  const fk = await client.query("SELECT count(*) FROM information_schema.table_constraints WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY';");
  console.log('Foreign keys:', fk.rows[0].count);
  console.log('--- Seed data rows ---');
  const seedTables = ['admins','branches','settings','system_config','digital_menus','profiles','inventory','orders'];
  for (const t of seedTables) {
    const res = await client.query(`SELECT count(*) FROM public.${t};`);
    console.log(`${t}:`, res.rows[0].count);
  }
  await client.end();
}
run().catch(e=>{console.error(e);process.exit(1);});
