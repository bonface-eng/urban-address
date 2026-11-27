import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const dbUrl = process.env.DATABASE_URL_MIGRATIONS || process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: dbUrl });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT id, name, unit, category, subcategory, size, image, image_url, image_asset_key 
    FROM public.inventory 
    ORDER BY unit, name;
  `);

  const lines = ['product_id,product_name,unit,image_asset_key,image_url,match_confidence,match_method'];
  for (const row of res.rows) {
    const key = row.image_asset_key || (row.image && !row.image.startsWith('http') ? row.image : '') || '';
    const url = row.image_url || (row.image && row.image.startsWith('http') ? row.image : '') || '';
    const conf = url ? 'EXACT' : 'NONE';
    const method = url ? 'EXISTING_RECORD' : 'UNMATCHED';
    lines.push(`"${row.id}","${row.name.replace(/"/g, '""')}","${row.unit}","${key}","${url}","${conf}","${method}"`);
  }

  const outPath = './migration-output/inventory/IMAGE_MATCHES.csv';
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Generated IMAGE_MATCHES.csv with ${res.rows.length} records at ${outPath}`);

  await client.end();
}

run().catch(console.error);
