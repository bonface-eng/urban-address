/**
 * Live end-to-end verification against the real Supabase project.
 * Reads credentials from .env.local (never printed). Creates throwaway users and
 * ALWAYS deletes them (and their rows) at the end.
 *
 *   node scripts/e2e-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Client as Pg } from 'pg';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) { console.error('Missing Supabase env vars'); process.exit(1); }

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = () => createClient(URL, ANON, opts);
const admin = createClient(URL, SERVICE, opts);

const results = [];
const rec = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

const stamp = Date.now();
const PASSWORD = 'Uax!e2e-' + stamp + 'Aa';
const clientEmail = `uax.e2e.client.${stamp}@mailinator.com`;
const adminEmail = `uax.e2e.admin.${stamp}@mailinator.com`;
const createdIds = [];
const createdRows = { inventory: [], orders: [] };

async function main() {
  // ---------- 1. SIGNUP (public anon client, exactly what the signup page does)
  const c1 = anon();
  const su = await c1.auth.signUp({
    email: clientEmail,
    password: PASSWORD,
    options: { data: { full_name: 'E2E Client', display_name: 'E2E Client' } },
  });
  if (su.error) {
    rec('signup (anon client)', false, `${su.error.status || ''} ${su.error.code || ''} ${su.error.message}`);
  } else {
    rec('signup (anon client)', true, `user created, session=${su.data.session ? 'yes (confirm-email OFF)' : 'no (confirm-email ON)'}`);
    if (su.data.user) createdIds.push(su.data.user.id);
  }

  let clientId = su.data?.user?.id;
  if (!clientId) {
    // Provision via admin API so the remaining checks can still run.
    const cu = await admin.auth.admin.createUser({ email: clientEmail, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'E2E Client' } });
    if (cu.error) { rec('fallback: admin.createUser', false, cu.error.message); return; }
    clientId = cu.data.user.id; createdIds.push(clientId);
    rec('fallback: admin.createUser (signup was blocked)', true);
  }
  const needsConfirm = !su.data?.session;

  // ---------- 2. PROFILE ROW created by handle_new_user trigger
  const prof = await admin.from('profiles').select('id, uid, email, role, display_name, account_type').eq('id', clientId).maybeSingle();
  rec('profiles row created by trigger', !!prof.data && !prof.error, prof.error ? prof.error.message : `role=${prof.data?.role} name=${prof.data?.display_name}`);
  rec('default role is CLIENT', prof.data?.role === 'CLIENT', `role=${prof.data?.role}`);

  // ---------- 3. LOGIN
  if (needsConfirm) {
    const unconfirmed = await anon().auth.signInWithPassword({ email: clientEmail, password: PASSWORD });
    // when created through signUp with confirm ON this must fail with "Email not confirmed"
    if (su.data?.user && !su.data?.session) rec('login blocked until email confirmed (confirm-email ON)', !!unconfirmed.error, unconfirmed.error?.message || 'login succeeded');
    if (su.data?.user && !su.data?.session) await admin.auth.admin.updateUserById(clientId, { email_confirm: true });
  }
  const c2 = anon();
  const li = await c2.auth.signInWithPassword({ email: clientEmail, password: PASSWORD });
  rec('login (signInWithPassword)', !li.error && !!li.data.session, li.error?.message || 'session issued');
  const badLogin = await anon().auth.signInWithPassword({ email: clientEmail, password: 'wrong-password-123' });
  rec('login rejects wrong password', !!badLogin.error, badLogin.error?.message);

  // ---------- 4. SESSION REFRESH
  const rf = await c2.auth.refreshSession();
  rec('session refresh (refresh token)', !rf.error && !!rf.data.session, rf.error?.message || 'new access token issued');
  const gu = await c2.auth.getUser();
  rec('getUser validates JWT server-side', !!gu.data?.user && gu.data.user.id === clientId, gu.error?.message);

  // ---------- 5. CLIENT ACCESS (RLS): must NOT read staff data, MUST read own profile
  const ownProfile = await c2.from('profiles').select('id, role').eq('id', clientId);
  rec('client can read own profile', !ownProfile.error && ownProfile.data?.length === 1, ownProfile.error?.message);
  const inv = await c2.from('inventory').select('id').limit(5);
  rec('client blocked from inventory by RLS (0 rows, no grant error)', !inv.error && (inv.data?.length ?? 0) === 0, inv.error?.message || `rows visible=${inv.data?.length}`);
  const adm = await c2.from('admins').select('email').limit(5);
  rec('client blocked from admins whitelist by RLS', !adm.error && (adm.data?.length ?? 0) === 0, adm.error?.message || `rows visible=${adm.data?.length}`);
  const otps = await c2.from('staff_pins').select('uid').limit(1);
  rec('client blocked from server-only table (staff_pins)', (otps.data?.length ?? 0) === 0, otps.error?.message || 'no rows / denied');
  const escalate = await c2.from('profiles').update({ role: 'ADMIN' }).eq('id', clientId).select();
  const after = await admin.from('profiles').select('role').eq('id', clientId).maybeSingle();
  rec('client cannot self-promote to ADMIN', after.data?.role === 'CLIENT', escalate.error?.message || `role still ${after.data?.role}`);

  // ---------- 6. ADMIN ACCESS (direct, no intermediate code step)
  const au = await admin.auth.admin.createUser({ email: adminEmail, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'E2E Admin' } });
  if (au.error) { rec('create test admin user', false, au.error.message); }
  else {
    const adminId = au.data.user.id; createdIds.push(adminId);
    await admin.from('profiles').update({ role: 'MANAGER', account_type: 'STAFF' }).eq('id', adminId);
    const c3 = anon();
    const al = await c3.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
    rec('staff login', !al.error, al.error?.message);
    const invS = await c3.from('inventory').select('id').limit(1);
    rec('staff (MANAGER) can read inventory', !invS.error, invS.error?.message || 'ok');

    // ---------- 7. CRUD inventory (admin-level: MANAGER passes is_admin())
    const iid = 'e2e-inv-' + stamp;
    const ins = await c3.from('inventory').insert({ id: iid, name: 'E2E Item', category: 'TEST', price: 10.5, stock_level: 5, min_stock: 1, unit: 'STORE' }).select().maybeSingle();
    if (ins.data) createdRows.inventory.push(iid);
    rec('inventory CREATE', !ins.error && !!ins.data, ins.error?.message);
    const rd = await c3.from('inventory').select('*').eq('id', iid).maybeSingle();
    rec('inventory READ', !rd.error && rd.data?.name === 'E2E Item', rd.error?.message);
    const up = await c3.from('inventory').update({ stock_level: 3 }).eq('id', iid).select().maybeSingle();
    rec('inventory UPDATE', !up.error && Number(up.data?.stock_level) === 3, up.error?.message);

    const oid = 'e2e-ord-' + stamp;
    const oi = await c3.from('orders').insert({ id: oid, type: 'STORE', status: 'PENDING', total: 21, cashier_id: adminId, items: [{ productId: iid, name: 'E2E Item', quantity: 2, price: 10.5 }] }).select().maybeSingle();
    if (oi.data) createdRows.orders.push(oid);
    rec('orders CREATE', !oi.error && !!oi.data, oi.error?.message);
    const orr = await c3.from('orders').select('id,total,status').eq('id', oid).maybeSingle();
    rec('orders READ', !orr.error && Number(orr.data?.total) === 21, orr.error?.message);
    const ou = await c3.from('orders').update({ status: 'PAID' }).eq('id', oid).select().maybeSingle();
    rec('orders UPDATE', !ou.error && ou.data?.status === 'PAID', ou.error?.message);
    const itemsSynced = await admin.from('order_items').select('*').eq('order_id', oid);
    rec('order_items synced by trigger', !itemsSynced.error && (itemsSynced.data?.length ?? 0) >= 1, itemsSynced.error?.message || `rows=${itemsSynced.data?.length}`);
    const od = await c3.from('orders').delete().eq('id', oid).select();
    rec('orders DELETE', !od.error && (od.data?.length ?? 0) === 1, od.error?.message);
    const idl = await c3.from('inventory').delete().eq('id', iid).select();
    rec('inventory DELETE', !idl.error && (idl.data?.length ?? 0) === 1, idl.error?.message);

    // ADMIN role gets full access directly
    await admin.from('profiles').update({ role: 'ADMIN' }).eq('id', adminId);
    const c4 = anon(); await c4.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
    const directAdmin = await c4.from('profiles').select('id').limit(5);
    rec('ADMIN gets direct full access without intermediate code step', !directAdmin.error && (directAdmin.data?.length ?? 0) >= 1, directAdmin.error?.message || `profiles visible=${directAdmin.data?.length}`);
  }

  // ---------- 8. LOGOUT
  const so = await c2.auth.signOut();
  const afterOut = await c2.auth.getUser();
  rec('logout (signOut) ends session', !so.error && !afterOut.data?.user, so.error?.message || afterOut.error?.message || 'session gone');

  // ---------- 9. PASSWORD RESET
  const pr = await anon().auth.resetPasswordForEmail(clientEmail, { redirectTo: 'http://localhost:3000/auth/callback' });
  rec('password reset email request (resetPasswordForEmail)', !pr.error, pr.error ? `${pr.error.status || ''} ${pr.error.code || ''} ${pr.error.message}` : 'accepted');
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email: clientEmail });
  const hashed = link.data?.properties?.hashed_token;
  const cr = anon();
  const vo = hashed ? await cr.auth.verifyOtp({ token_hash: hashed, type: 'recovery' }) : { error: link.error };
  rec('recovery token verifies (reset-password page path)', !vo.error, vo.error?.message);
  const NEW = PASSWORD + 'x';
  const upw = await cr.auth.updateUser({ password: NEW });
  rec('updateUser sets new password', !upw.error, upw.error?.message);
  const relog = await anon().auth.signInWithPassword({ email: clientEmail, password: NEW });
  rec('login works with the new password', !relog.error, relog.error?.message);
}

async function cleanup() {
  console.log('\n--- cleanup');
  for (const id of createdRows.orders) await admin.from('orders').delete().eq('id', id);
  for (const id of createdRows.inventory) await admin.from('inventory').delete().eq('id', id);
  for (const id of createdIds) {
    await admin.from('profiles').delete().eq('id', id);
    const d = await admin.auth.admin.deleteUser(id);
    console.log('deleted test user', id.slice(0, 8) + '…', d.error ? 'ERR ' + d.error.message : 'ok');
  }
  // Safety sweep: any leftover e2e users
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of list.data?.users || []) {
    if ((u.email || '').startsWith('uax.e2e.')) { await admin.from('profiles').delete().eq('id', u.id); await admin.auth.admin.deleteUser(u.id); console.log('swept leftover', u.email); }
  }
  const pg = new Pg({ connectionString: process.env.DATABASE_URL_MIGRATIONS });
  await pg.connect();
  const left = await pg.query("select count(*) from auth.users where email like 'uax.e2e.%'");
  console.log('remaining e2e users in auth.users:', left.rows[0].count);
  await pg.end();
}

try { await main(); } catch (e) { rec('UNCAUGHT', false, e.message); } finally { await cleanup(); }
const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
failed.forEach((f) => console.log(' FAIL:', f.name, '->', f.detail));
process.exit(failed.length ? 1 : 0);
