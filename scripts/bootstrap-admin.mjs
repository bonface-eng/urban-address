/**
 * Interactive Root Administrator Bootstrap Script
 *
 * Creates (or upgrades) a root administrator in Supabase Auth, `public.admins`,
 * and `public.profiles` using SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const rl = readline.createInterface({ input, output });
  try {
    const rawEmail = await rl.question('Admin email address: ');
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('Invalid email address.');
      process.exit(1);
    }

    const rawName = await rl.question('Display name (default: Root Administrator): ');
    const displayName = rawName.trim() || 'Root Administrator';

    const password = await rl.question('Password (min 8 chars, uppercase + number + symbol): ');
    if (password.length < 8) {
      console.error('Password must be at least 8 characters.');
      process.exit(1);
    }

    // Check if user already exists in auth.users
    const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const existing = (listed?.users || []).find((u) => (u.email || '').toLowerCase() === email);

    let userId;
    if (existing) {
      const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata || {}),
          display_name: displayName,
          full_name: displayName,
        },
        app_metadata: {
          ...(existing.app_metadata || {}),
          role: 'ADMIN',
        },
      });
      if (updateErr || !updated.user) throw updateErr || new Error('Could not update existing admin user.');
      userId = updated.user.id;
      console.log(`Updated existing Auth user (${userId})`);
    } else {
      // Ensure whitelist row exists before signup trigger runs
      await supabase.from('admins').upsert({ email, role: 'ADMIN', added_by: 'bootstrap-script' }, { onConflict: 'email' });

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          full_name: displayName,
        },
        app_metadata: {
          role: 'ADMIN',
        },
      });
      if (createErr || !created.user) throw createErr || new Error('Could not create admin user.');
      userId = created.user.id;
      console.log(`Created Auth user (${userId})`);
    }

    const { error: adminErr } = await supabase
      .from('admins')
      .upsert({ email, role: 'ADMIN', added_by: 'bootstrap-script' }, { onConflict: 'email' });
    if (adminErr) throw adminErr;

    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          uid: userId,
          email,
          display_name: displayName,
          role: 'ADMIN',
          account_type: 'STAFF',
          email_verified: true,
          updated_at_ms: Date.now(),
        },
        { onConflict: 'id' }
      );
    if (profileErr) throw profileErr;

    console.log(`Root admin bootstrapped: ${email} (uid=${userId}, role=ADMIN)`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Bootstrap failed:', err?.message || err);
  process.exit(1);
});
