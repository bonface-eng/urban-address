import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const dbUrl = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Missing database connection url");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });

async function run() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL.");

  const files = [
    'supabase/migrations/20261128000012_inventory_schema_and_catalogue.sql',
    'supabase/migrations/20261128000013_import_lounge_inventory.sql',
    'supabase/migrations/20261128000014_import_store_inventory.sql'
  ];

  for (const file of files) {
    console.log(`\nApplying migration: ${file}`);
    const sql = fs.readFileSync(file, 'utf-8');
    await client.query(sql);
    console.log(`Successfully applied: ${file}`);
  }

  // Verification queries
  console.log("\n--- VERIFICATION ---");
  const countRes = await client.query(`
    SELECT unit, count(*) as count, count(price) as with_price, count(stock_level) as with_stock 
    FROM public.inventory 
    GROUP BY unit;
  `);
  console.table(countRes.rows);

  const totalRes = await client.query(`SELECT count(*) as total FROM public.inventory;`);
  console.log("Total inventory rows in DB:", totalRes.rows[0].total);

  const catRes = await client.query(`SELECT count(*) as cat_count FROM public.public_catalogue;`);
  console.log("Total public catalogue items:", catRes.rows[0].cat_count);

  await client.end();
}

run().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
