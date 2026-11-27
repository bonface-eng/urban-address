/**
 * Live End-to-End Verification against `npm run dev` (http://localhost:3000)
 * and the real Supabase project configured in `.env.local`.
 *
 * Tests:
 *  - Dev server boot & env startup validation
 *  - Public routes (/login, /signup, /forgot-password, /auth/reset-password, /api/public/catalogue)
 *  - Protected route redirects (/dashboard, /admin, /inventory -> /login?next=...)
 *  - Real Supabase Auth: signUp (with real provider diagnostic), profiles trigger (role=CLIENT),
 *    signInWithPassword, session persistence across SSR cookie request, signOut, password reset
 *  - Admin vs Client access (RLS + daily OTP gate + terminal PIN claim + /api/auth/clear-terminal-session)
 *  - Inventory & Orders CRUD + order_items trigger sync
 *  - Cleans up ALL created test users and rows.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Client as Pg } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'http://localhost:3000';

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = () => createClient(SUPABASE_URL, SUPABASE_ANON, opts);
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE, opts);

const results = [];
const rec = (category, name, pass, detail = '') => {
  results.push({ category, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} [${category}] ${name}${detail ? ' -> ' + detail : ''}`);
};

const stamp = Date.now();
const PASSWORD = `Uax!dev-${stamp}Aa`;
// Use a realistic domain accepted by Supabase Auth validator
const clientEmail = `uax.e2e.client.${stamp}@gmail.com`;
const adminEmail = `uax.e2e.admin.${stamp}@gmail.com`;
const createdIds = [];
const createdRows = { inventory: [], orders: [] };

async function waitForServer(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/login`, { redirect: 'manual' });
      if (r.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function projectRefFromUrl(url) {
  return new URL(url).hostname.split('.')[0];
}

async function runTests() {
  // 1. Page & API smoke checks on running Next.js dev server
  for (const path of ['/login', '/signup', '/forgot-password', '/auth/reset-password', '/api/public/catalogue']) {
    const r = await fetch(`${BASE}${path}`, { redirect: 'manual' });
    rec('Dev Server', `GET ${path}`, r.status === 200, `status=${r.status}`);
  }

  // 2. Protected route redirects when signed out (middleware)
  for (const p of ['/dashboard', '/admin', '/inventory', '/finance']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    const loc = r.headers.get('location') || '';
    const ok = (r.status === 307 || r.status === 302) && loc.includes('/login') && loc.includes(encodeURIComponent(p));
    rec('Route Protection', `Signed-out GET ${p} redirects to /login`, ok, `status=${r.status} location=${loc}`);
  }

  // 3. Real Supabase Signup (anon client)
  const su = await anon().auth.signUp({
    email: clientEmail,
    password: PASSWORD,
    options: {
      data: { full_name: 'E2E Dev Client', display_name: 'E2E Dev Client' },
      emailRedirectTo: `${BASE}/auth/callback`,
    },
  });

  let confirmEmailEnabled = null;
  let signupDiagnostic = '';
  let clientId = su.data?.user?.id || '';

  if (su.error) {
    signupDiagnostic = `${su.error.status || ''} ${su.error.code || ''} ${su.error.message}`.trim();
    rec('Auth Signup', 'supabase.auth.signUp', false, signupDiagnostic);
    const cu = await admin.auth.admin.createUser({
      email: clientEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Dev Client', display_name: 'E2E Dev Client' },
    });
    if (cu.error) throw cu.error;
    clientId = cu.data.user.id;
    createdIds.push(clientId);
  } else {
    createdIds.push(clientId);
    confirmEmailEnabled = !su.data.session;
    signupDiagnostic = su.data.session
      ? 'User created with active session (Confirm email is OFF)'
      : 'User created without session (Confirm email is ON; verification email queued)';
    rec('Auth Signup', 'supabase.auth.signUp', true, signupDiagnostic);
  }

  // 4. Profiles trigger verification
  const prof = await admin.from('profiles').select('id, uid, email, role, display_name').eq('id', clientId).maybeSingle();
  rec('Auth Profile', 'handle_new_user created profiles row with role=CLIENT', prof.data?.role === 'CLIENT' && prof.data?.email === clientEmail, `role=${prof.data?.role}`);

  // If confirm-email was ON during signUp, verify unconfirmed login behavior then confirm for remaining tests
  if (confirmEmailEnabled === true) {
    const blocked = await anon().auth.signInWithPassword({ email: clientEmail, password: PASSWORD });
    rec('Auth Confirm Email', 'Unconfirmed user login blocked with "Email not confirmed"', /email not confirmed/i.test(blocked.error?.message || ''), blocked.error?.message || 'unexpectedly allowed');
    await admin.auth.admin.updateUserById(clientId, { email_confirm: true });
  }

  // 5. Login + Session Refresh + SSR cookie persistence
  const clientSession = anon();
  const li = await clientSession.auth.signInWithPassword({ email: clientEmail, password: PASSWORD });
  rec('Auth Login', 'signInWithPassword (client)', !li.error && !!li.data.session, li.error?.message || 'session issued');

  // Verify middleware recognizes the Supabase SSR auth cookie (`sb-<ref>-auth-token`) on protected routes
  const ref = projectRefFromUrl(SUPABASE_URL);
  const cookiePayload = 'base64-' + Buffer.from(JSON.stringify(li.data.session)).toString('base64url');
  const authedDash = await fetch(`${BASE}/dashboard`, {
    redirect: 'manual',
    headers: { Cookie: `sb-${ref}-auth-token=${encodeURIComponent(cookiePayload)}` },
  });
  rec('Session Persistence', 'Middleware allows /dashboard with SSR session cookie', authedDash.status === 200, `status=${authedDash.status}`);

  const rf = await clientSession.auth.refreshSession();
  rec('Session Refresh', 'refreshSession rotates access token', !rf.error && !!rf.data.session, rf.error?.message || 'ok');

  // 6. Client vs Admin access & RLS checks
  const ownProf = await clientSession.from('profiles').select('id, role').eq('id', clientId);
  rec('RLS Access', 'Client reads own profile', !ownProf.error && ownProf.data?.length === 1);
  const clientInv = await clientSession.from('inventory').select('id').limit(5);
  rec('RLS Access', 'Client blocked from reading staff inventory', !clientInv.error && (clientInv.data?.length ?? 0) === 0, `rows=${clientInv.data?.length}`);
  const clientProm = await clientSession.from('profiles').update({ role: 'ADMIN' }).eq('id', clientId);
  const roleCheck = await admin.from('profiles').select('role').eq('id', clientId).maybeSingle();
  rec('RLS Access', 'Client cannot self-escalate role to ADMIN', roleCheck.data?.role === 'CLIENT', clientProm.error?.message || '');

  // 7. Logout
  const so = await clientSession.auth.signOut();
  const afterOut = await clientSession.auth.getUser();
  rec('Auth Logout', 'signOut clears user session', !so.error && !afterOut.data?.user);

  // 8. Password Reset flow (/api/auth/forgot-password + recovery link verifyOtp + updateUser + login)
  const forgotRes = await fetch(`${BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: clientEmail }),
  });
  rec('Password Reset', 'POST /api/auth/forgot-password returns 200', forgotRes.status === 200, `status=${forgotRes.status}`);

  const recLink = await admin.auth.admin.generateLink({ type: 'recovery', email: clientEmail });
  const hashedToken = recLink.data?.properties?.hashed_token;
  const resetClient = anon();
  const vo = hashedToken ? await resetClient.auth.verifyOtp({ token_hash: hashedToken, type: 'recovery' }) : { error: recLink.error };
  const NEW_PW = PASSWORD + 'Z9!';
  const updPw = await resetClient.auth.updateUser({ password: NEW_PW });
  const relog = await anon().auth.signInWithPassword({ email: clientEmail, password: NEW_PW });
  rec('Password Reset', 'Recovery verifyOtp + updateUser + login with new password', !vo.error && !updPw.error && !relog.error, vo.error?.message || updPw.error?.message || relog.error?.message || 'ok');

  // 9. Admin / Manager flow + Inventory & Orders CRUD
  const admCreate = await admin.auth.admin.createUser({
    email: adminEmail,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Manager', display_name: 'E2E Manager' },
  });
  if (admCreate.error) throw admCreate.error;
  const adminId = admCreate.data.user.id;
  createdIds.push(adminId);
  await admin.from('profiles').update({ role: 'MANAGER', account_type: 'STAFF' }).eq('id', adminId);

  const mgrClient = anon();
  await mgrClient.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });

  const iid = `e2e-inv-${stamp}`;
  const invIns = await mgrClient.from('inventory').insert({ id: iid, name: 'E2E Polish', category: 'E2E', price: 500, stock_level: 10, min_stock: 2, unit: 'STORE' }).select().maybeSingle();
  if (invIns.data) createdRows.inventory.push(iid);
  const invRead = await mgrClient.from('inventory').select('name, stock_level').eq('id', iid).maybeSingle();
  const invUpd = await mgrClient.from('inventory').update({ stock_level: 7 }).eq('id', iid).select().maybeSingle();
  const invDel = await mgrClient.from('inventory').delete().eq('id', iid).select();
  rec('CRUD Inventory', 'Create -> Read -> Update -> Delete via RLS as MANAGER',
    !invIns.error && invRead.data?.name === 'E2E Polish' && Number(invUpd.data?.stock_level) === 7 && (invDel.data?.length ?? 0) === 1,
    invIns.error?.message || invUpd.error?.message || invDel.error?.message || 'all 4 ops ok');

  const oid = `e2e-ord-${stamp}`;
  const ordIns = await mgrClient.from('orders').insert({
    id: oid, type: 'STORE', status: 'PENDING', total: 1000, cashier_id: adminId,
    items: [{ productId: iid, name: 'E2E Polish', quantity: 2, price: 500 }],
  }).select().maybeSingle();
  if (ordIns.data) createdRows.orders.push(oid);
  const ordRead = await mgrClient.from('orders').select('total, status').eq('id', oid).maybeSingle();
  const ordUpd = await mgrClient.from('orders').update({ status: 'PAID' }).eq('id', oid).select().maybeSingle();
  const ordItems = await admin.from('order_items').select('id').eq('order_id', oid);
  const ordDel = await mgrClient.from('orders').delete().eq('id', oid).select();
  rec('CRUD Orders', 'Create -> Read -> Update -> Sync order_items -> Delete',
    !ordIns.error && Number(ordRead.data?.total) === 1000 && ordUpd.data?.status === 'PAID' && (ordItems.data?.length ?? 0) >= 1 && (ordDel.data?.length ?? 0) === 1,
    ordIns.error?.message || ordUpd.error?.message || ordDel.error?.message || 'all ops ok');

  // 10. Claims / Special Flows: terminal_staff_session -> /api/auth/clear-terminal-session + daily admin OTP
  await admin.auth.admin.updateUserById(adminId, {
    app_metadata: { terminal_staff_session: true, terminalStaffSession: true, terminal_device_id: 'dev-e2e-1234567890' },
  });
  const freshPwLogin = await anon().auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
  const clearRes = await fetch(`${BASE}/api/auth/clear-terminal-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshPwLogin.data.session.access_token}` },
  });
  const clearJson = await clearRes.json();
  const refreshedAdmin = await admin.auth.admin.getUserById(adminId);
  rec('Special Flows', 'Password login clears terminal_staff_session via /api/auth/clear-terminal-session',
    clearRes.ok && clearJson.cleared === true && refreshedAdmin.data?.user?.app_metadata?.terminal_staff_session === false,
    JSON.stringify(clearJson));

  // Daily OTP check for ADMIN role
  await admin.from('profiles').update({ role: 'ADMIN' }).eq('id', adminId);
  const admSession = anon();
  await admSession.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
  const deniedBeforeOtp = await admSession.from('inventory').select('id').limit(1);
  const today = new Date().toISOString().slice(0, 10);
  await admin.from('admin_daily_otps').upsert({ id: adminId, day: today, code_hash: 'e2e', sent_at: Date.now(), expires_at: Date.now() + 60000, attempts: 0, verified_at: Date.now() }, { onConflict: 'id' });
  const allowedAfterOtp = await admSession.from('profiles').select('id').limit(3);
  await admin.from('admin_daily_otps').delete().eq('id', adminId);
  rec('Special Flows', 'ADMIN role gated by daily OTP and unlocked after verification',
    (deniedBeforeOtp.data?.length ?? 0) === 0 && !allowedAfterOtp.error && (allowedAfterOtp.data?.length ?? 0) >= 1,
    `before=${deniedBeforeOtp.data?.length ?? 0}, after=${allowedAfterOtp.data?.length ?? 0}`);

  return { confirmEmailEnabled, signupDiagnostic };
}

async function cleanup() {
  for (const id of createdRows.orders) await admin.from('orders').delete().eq('id', id);
  for (const id of createdRows.inventory) await admin.from('inventory').delete().eq('id', id);
  for (const id of createdIds) {
    await admin.from('admin_daily_otps').delete().eq('id', id);
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
  const pg = new Pg({ connectionString: process.env.DATABASE_URL_MIGRATIONS });
  await pg.connect();
  const left = await pg.query("select count(*) from auth.users where email like 'uax.e2e.%'");
  const leftCount = Number(left.rows[0].count);
  await pg.end();
  rec('Cleanup', 'All E2E test users deleted from auth.users', leftCount === 0, `remaining=${leftCount}`);
}

const isWin = process.platform === 'win32';
const devProc = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  shell: isWin,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
});
let devLogs = '';
devProc.stdout.on('data', (d) => { devLogs += d.toString(); });
devProc.stderr.on('data', (d) => { devLogs += d.toString(); });

let meta = {};
try {
  const ready = await waitForServer(60_000);
  rec('Dev Server', 'npm run dev boots cleanly (env.ts check passes)', ready, ready ? 'listening on :3000' : devLogs.slice(-400));
  if (ready) {
    meta = await runTests();
  }
} catch (err) {
  rec('Unhandled', 'E2E runner exception', false, err?.message || String(err));
} finally {
  await cleanup().catch((e) => console.error('cleanup err:', e));
  try {
    if (isWin && devProc.pid) {
      spawn('taskkill', ['/pid', String(devProc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      devProc.kill('SIGTERM');
    }
  } catch {}
}

fs.mkdirSync('migration-output', { recursive: true });
const passed = results.filter((r) => r.pass).length;
const report = [
  '# Live End-to-End Verification Report',
  '',
  `Date: ${new Date().toISOString()}`,
  `Result: ${passed}/${results.length} checks passed`,
  meta.signupDiagnostic ? `Signup diagnosis: ${meta.signupDiagnostic}` : '',
  '',
  '| Category | Check | Status | Details |',
  '|---|---|---|---|',
  ...results.map((r) => `| ${r.category} | ${r.name} | **${r.pass ? 'PASS' : 'FAIL'}** | ${String(r.detail || '').replace(/\|/g, '/')} |`),
  '',
].join('\n');
fs.writeFileSync('migration-output/TEST_REPORT.md', report);
console.log(`\nDONE: ${passed}/${results.length} passed. Wrote migration-output/TEST_REPORT.md`);
process.exit(passed === results.length ? 0 : 1);
