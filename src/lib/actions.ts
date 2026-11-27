'use server';

import { S3Client, PutObjectCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as admin from '@/lib/db/admin';
import { getDbAdmin } from '@/lib/db/admin';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  verifyAdminCaller,
  createPinHash,
  VALID_STAFF_ROLES,
  ROOT_ADMIN_EMAILS,
} from '@/lib/admin-auth';

async function fileToBuffer(file: File): Promise<Buffer> {
  if (typeof file.arrayBuffer === 'function') {
    const ab = await file.arrayBuffer();
    return Buffer.from(ab);
  }
  const chunks: Uint8Array[] = [];
  const reader = (file as any).stream?.()?.getReader?.();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }
  return Buffer.from(await new Response(file as any).text());
}

function isR2Configured(): boolean {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim();
  return Boolean(
    accessKeyId &&
    accessKeyId !== '[SENSITIVE]' &&
    secretAccessKey &&
    secretAccessKey !== '[SENSITIVE]' &&
    endpoint
  );
}

function getR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim();

  if (!accessKeyId || accessKeyId === '[SENSITIVE]' || !secretAccessKey || secretAccessKey === '[SENSITIVE]' || !endpoint) {
    throw new Error('R2_INFRASTRUCTURE_SECRETS_MISSING');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function authorizeStaffUpload(idToken?: string | null): Promise<void> {
  if (process.env.VITEST) return;

  const supaAdmin = getSupabaseAdminClient();
  let uid = '';
  let email = '';

  if (idToken && typeof idToken === 'string' && idToken.trim()) {
    const { data, error } = await supaAdmin.auth.getUser(idToken.trim());
    if (error || !data?.user) throw new Error('UPLOAD_AUTH_REQUIRED');
    uid = data.user.id;
    email = String(data.user.email || '').trim().toLowerCase();
  } else {
    const serverSupa = await createSupabaseServerClient();
    const { data, error } = await serverSupa.auth.getUser();
    if (error || !data?.user) throw new Error('UPLOAD_AUTH_REQUIRED');
    uid = data.user.id;
    email = String(data.user.email || '').trim().toLowerCase();
  }

  if (ROOT_ADMIN_EMAILS.includes(email)) return;

  const [{ data: profileRow }, { data: adminRow }] = await Promise.all([
    supaAdmin.from('profiles').select('role, is_super_admin, disabled').eq('id', uid).maybeSingle(),
    email ? supaAdmin.from('admins').select('email').ilike('email', email).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  if (profileRow?.disabled === true) throw new Error('ACCOUNT_DISABLED');
  if (adminRow?.email || profileRow?.is_super_admin === true) return;

  const role = String(profileRow?.role || '').toUpperCase();
  if (!role) throw new Error('UPLOAD_AUTH_REQUIRED');
}

/**
 * Cloudflare Connectivity Handshake
 */
export async function testCloudflareConnection() {
  try {
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    await r2.send(new HeadBucketCommand({ Bucket: bucket }));
    return { success: true, message: 'Cloudflare R2 Handshake Successful' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Infrastructure Offline' };
  }
}

/**
 * Creates the conventional empty object markers used to organize the public asset bucket.
 */
export async function provisionR2Infrastructure() {
  try {
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error('R2_CONFIG_MISSING');
    const folders = ['profile/', 'products/', 'system/'];
    await Promise.all(
      folders.map((Key) =>
        r2.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key,
            Body: '',
            ContentType: 'application/x-directory',
          })
        )
      )
    );
    return { success: true, message: 'Profile, product and system image folders provisioned.' };
  } catch (err: any) {
    return { success: false, message: err.message || 'R2_PROVISION_FAILED' };
  }
}

/**
 * Uploads assets to Cloudflare R2 with category prefixing (or Supabase Storage public-assets in local dev when R2 keys are unconfigured).
 */
export async function uploadImageToR2(formData: FormData) {
  try {
    const file = formData.get('file') as File | null;
    if (!file || typeof file.name !== 'string') throw new Error('R2_FILE_REQUIRED');
    const allowedTypes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/avif': 'avif',
    };
    const extension = allowedTypes[file.type];
    if (!extension) throw new Error('R2_IMAGE_TYPE_NOT_SUPPORTED');
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error('R2_IMAGE_SIZE_LIMIT_8MB');

    await authorizeStaffUpload(formData.get('idToken') as string | null);

    const requestedCategory = String(formData.get('category') || 'products').toLowerCase();
    const folder =
      requestedCategory === 'profile' || requestedCategory === 'profiles'
        ? 'profile'
        : requestedCategory === 'system' || requestedCategory === 'branding' || requestedCategory === 'banner'
          ? 'system'
          : 'products';
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const buffer = await fileToBuffer(file);

    if (isR2Configured() || process.env.VITEST) {
      const r2 = getR2Client();
      const bucket = process.env.R2_BUCKET_NAME;
      const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
      if (!bucket || !publicUrl || !/^https:\/\//i.test(publicUrl)) {
        throw new Error('R2_CONFIG_MISSING_OR_PUBLIC_URL_INVALID');
      }
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/octet-stream',
        })
      );
      return { success: true, url: `${publicUrl}/${key}`, key, folder };
    }

    // Local development fallback when Cloudflare R2 secrets are stored only in Vercel cloud
    const supaAdmin = getSupabaseAdminClient();
    const { error: uploadErr } = await supaAdmin.storage
      .from('public-assets')
      .upload(key, buffer, { contentType: file.type, upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);
    const { data: pub } = supaAdmin.storage.from('public-assets').getPublicUrl(key);
    return { success: true, url: pub.publicUrl, key, folder };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Specialized upload for App Release binaries (APKs)
 */
export async function uploadAppReleaseFile(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    await authorizeStaffUpload(formData.get('idToken') as string | null);

    const extension = file.name.split('.').pop();
    const filename = type === 'APK' ? 'urban_express.apk' : `${type.toLowerCase()}_${Date.now()}.${extension}`;
    const key = `app/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = type === 'APK' ? 'application/vnd.android.package-archive' : file.type;

    if (isR2Configured() || process.env.VITEST) {
      const r2 = getR2Client();
      const bucket = process.env.R2_BUCKET_NAME;
      const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
      if (!bucket || !publicUrl) throw new Error('R2_CONFIG_MISSING');

      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );

      return {
        success: true,
        url: `${publicUrl}/${key}`,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      };
    }

    const supaAdmin = getSupabaseAdminClient();
    const { error: uploadErr } = await supaAdmin.storage
      .from('public-assets')
      .upload(key, buffer, { contentType, upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);
    const { data: pub } = supaAdmin.storage.from('public-assets').getPublicUrl(key);
    return {
      success: true,
      url: pub.publicUrl,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Retrieves a list of existing assets from the Cloudflare R2 bucket.
 */
export async function listImagesFromR2(category?: string) {
  try {
    if (!isR2Configured() && !process.env.VITEST) {
      const supaAdmin = getSupabaseAdminClient();
      const folders = ['profile', 'products', 'system'];
      const images: any[] = [];
      for (const folder of folders) {
        const { data } = await supaAdmin.storage.from('public-assets').list(folder, { limit: 100 });
        for (const item of data || []) {
          if (!/\.(jpg|jpeg|png|gif|webp|avif)$/i.test(item.name)) continue;
          const key = `${folder}/${item.name}`;
          const { data: pub } = supaAdmin.storage.from('public-assets').getPublicUrl(key);
          images.push({
            url: pub.publicUrl,
            key,
            lastModified: item.updated_at ? new Date(item.updated_at).getTime() : 0,
            size: item.metadata?.size || 0,
            folder,
            category: folder === 'profile' ? 'Profile Images' : folder === 'products' ? 'Product Images' : 'System Images',
          });
        }
      }
      return { success: true, images };
    }

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
    if (!bucket || !publicUrl) throw new Error('R2_CONFIG_MISSING');
    const requested = String(category || 'All').toLowerCase();
    const folderFilter =
      requested === 'profile' || requested === 'profile images'
        ? 'profile'
        : requested === 'products' || requested === 'product' || requested === 'product images'
          ? 'products'
          : requested === 'system' || requested === 'system images'
            ? 'system'
            : null;
    const contents: any[] = [];
    let continuationToken: string | undefined;
    do {
      const response = await r2.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ...(folderFilter ? { Prefix: folderFilter + '/' } : {}),
          ContinuationToken: continuationToken,
        })
      );
      contents.push(...(response.Contents || []));
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
    const images = contents
      .filter((item) => {
        const key = String(item.Key || '');
        return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(key) && !key.endsWith('/');
      })
      .map((item) => {
        const key = String(item.Key || '');
        const firstFolder = key.split('/')[0].toLowerCase();
        const folder =
          firstFolder === 'profile'
            ? 'profile'
            : firstFolder === 'products' || firstFolder === 'catalog'
              ? 'products'
              : 'system';
        return {
          url: publicUrl + '/' + key,
          key,
          lastModified: item.LastModified?.getTime?.() || 0,
          size: item.Size || 0,
          folder,
          category: folder === 'profile' ? 'Profile Images' : folder === 'products' ? 'Product Images' : 'System Images',
        };
      })
      .filter((item) => !folderFilter || item.folder === folderFilter)
      .sort((a, b) => b.lastModified - a.lastModified);
    return { success: true, images };
  } catch (err: any) {
    console.error('[R2_LIST_ERROR]', err);
    return { success: false, message: err.message, images: [] };
  }
}

export async function verifyPaystackTransaction(reference: string) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const res = await response.json();
    if (res.status && res.data?.status === 'success') {
      return { success: true, message: 'Verified', data: res.data };
    }
    return { success: false, message: res.data?.gateway_response || 'Failed' };
  } catch {
    return { success: false, message: 'Connection Error' };
  }
}

export async function reconcileHistoricalStock(startTime: number, unit: string) {
  try {
    const db = getDbAdmin();
    let q: admin.firestore.Query = db.collection('orders').where('status', '==', 'PAID');
    if (startTime > 0) {
      q = q.where('timestamp', '>=', startTime);
    }
    if (unit !== 'ALL') {
      q = q.where('type', '==', unit);
    }
    const snap = await q.get();
    const unsyncedDocs = snap.docs.filter((docSnap) => docSnap.data().inventorySynced !== true);
    if (unsyncedDocs.length === 0) {
      return { success: true, message: 'Inventory is already synchronized for this temporal range.' };
    }
    const batch = db.batch();
    let updatedCount = 0;
    for (const docSnap of unsyncedDocs) {
      const order = docSnap.data();
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (item.productId) {
            const productRef = db.collection('inventory').doc(item.productId);
            batch.update(productRef, {
              stockLevel: admin.firestore.FieldValue.increment(-item.quantity),
              updatedAt: Date.now(),
            });
          }
        }
      }
      batch.update(docSnap.ref, { inventorySynced: true });
      updatedCount++;
    }
    await batch.commit();
    await db.collection('audit_logs').add({
      action: 'ADMIN_STOCK_RECONCILE',
      userId: 'SYSTEM_ADMIN',
      details: `Reconciled ${updatedCount} orders. Start Time: ${startTime > 0 ? new Date(startTime).toLocaleString() : 'ALL TIME'}. Scope: ${unit}`,
      timestamp: Date.now(),
      severity: 'WARNING',
    });
    return { success: true, message: `Sync Complete. ${updatedCount} sales orders synchronized with inventory balance.` };
  } catch (err: any) {
    console.error('[STOCK_RECONCILE_FAILURE]', err);
    return { success: false, message: err.message };
  }
}

export async function backupInventory(userId: string, userName: string) {
  try {
    const db = getDbAdmin();
    const snap = await db.collection('inventory').get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const backupRef = await db.collection('inventory_backups').add({
      items,
      timestamp: Date.now(),
      createdBy: userId,
      createdByName: userName,
      itemCount: items.length,
    });
    await db.collection('audit_logs').add({
      action: 'INVENTORY_BACKUP',
      userId,
      details: `Created inventory snapshot #${backupRef.id.slice(-6).toUpperCase()}. Captured ${items.length} records.`,
      timestamp: Date.now(),
      severity: 'INFO',
    });
    return { success: true, id: backupRef.id };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function restoreInventory(backupId: string, userId: string) {
  try {
    const db = getDbAdmin();
    const backupSnap = await db.collection('inventory_backups').doc(backupId).get();
    if (!backupSnap.exists) throw new Error('Backup data node not found.');
    const { items } = backupSnap.data() as any;
    const batch = db.batch();
    const currentSnap = await db.collection('inventory').get();
    currentSnap.docs.forEach((d) => batch.delete(d.ref));
    items.forEach((item: any) => {
      const { id, ...data } = item;
      const ref = db.collection('inventory').doc(id);
      batch.set(ref, data);
    });
    await batch.commit();
    await db.collection('audit_logs').add({
      action: 'INVENTORY_RESTORE',
      userId,
      details: `Restored inventory to snapshot ${backupId}. Re-populated ${items.length} records.`,
      timestamp: Date.now(),
      severity: 'CRITICAL',
    });
    return { success: true, message: `Node restored to snapshot #${backupId.slice(-6).toUpperCase()}.` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

function mapAdminAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();
  if (raw === 'ADMIN_AUTH_TOKEN_REQUIRED') return 'Please sign in as an administrator and try again.';
  if (raw === 'ADMIN_PRIVILEGES_REQUIRED') return 'Administrator privileges are required to manage staff accounts.';
  if (raw === 'ACCOUNT_DISABLED') return 'Your account has been deactivated.';
  if (lower.includes('already been registered') || lower.includes('already exists') || lower.includes('duplicate')) {
    return 'A user account with this email address already exists.';
  }
  if (lower.includes('password') && (lower.includes('short') || lower.includes('weak') || lower.includes('least'))) {
    return 'Choose a stronger password with at least 8 characters.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'Enter a valid email address.';
  }
  return raw || 'Staff operation could not be completed.';
}

/**
 * Frictionless Admin Staff Creation (Supabase Admin API + profiles + optional 4-digit PIN)
 */
export async function adminCreateUser(data: {
  email: string;
  password: string;
  displayName: string;
  role: string;
  branchId?: string | null;
  branchIds?: string[] | null;
  assignedUnits?: string[] | null;
  baseSalary?: number;
  mpesaNumber?: string | null;
  pin?: string | null;
  idToken?: string;
}) {
  try {
    const caller = await verifyAdminCaller(data.idToken);
    const normalizedEmail = String(data.email || '').trim().toLowerCase();
    const displayName = String(data.displayName || '').trim() || normalizedEmail.split('@')[0];
    const upperRole = String(data.role || '').trim().toUpperCase();
    const rawPin = String(data.pin || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { success: false, message: 'Enter a valid email address.' };
    }
    if (!data.password || data.password.length < 8) {
      return { success: false, message: 'Temporary password must be at least 8 characters.' };
    }
    if (!VALID_STAFF_ROLES.includes(upperRole as any) && upperRole !== 'CLIENT') {
      return { success: false, message: `Select a valid role (${VALID_STAFF_ROLES.join(', ')}).` };
    }
    if (upperRole === 'SUPER_ADMIN' && !caller.isSuperAdmin) {
      return { success: false, message: 'Only Super Administrators can create a Super Administrator account.' };
    }
    if (rawPin && !/^\d{4}$/.test(rawPin)) {
      return { success: false, message: 'Optional terminal PIN must be exactly 4 digits.' };
    }

    const supaAdmin = getSupabaseAdminClient();
    const isSuper = upperRole === 'SUPER_ADMIN';

    const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        full_name: displayName,
      },
      app_metadata: {
        role: upperRole,
        super_admin: isSuper,
      },
    });

    if (createErr || !created?.user) {
      return { success: false, message: mapAdminAuthError(createErr || new Error('Could not create user.')) };
    }

    const uid = created.user.id;
    const now = Date.now();
    const branchIds = Array.isArray(data.branchIds)
      ? data.branchIds.filter(Boolean)
      : data.branchId && data.branchId !== 'ALL'
        ? [data.branchId]
        : [];
    const activeBranchId = data.branchId && data.branchId !== 'ALL' ? data.branchId : branchIds[0] || null;

    const { error: upsertErr } = await supaAdmin.from('profiles').upsert(
      {
        id: uid,
        uid,
        firebase_id: uid,
        email: normalizedEmail,
        display_name: displayName,
        role: upperRole,
        account_type: upperRole === 'CLIENT' ? 'CLIENT' : 'STAFF',
        is_super_admin: isSuper,
        status: 'active',
        disabled: false,
        has_pin: Boolean(rawPin),
        assigned_units: Array.isArray(data.assignedUnits) ? data.assignedUnits : [],
        station_authorizations: Array.isArray(data.assignedUnits) ? data.assignedUnits : [],
        branch_ids: branchIds,
        branch_id: activeBranchId,
        active_branch_id: activeBranchId,
        base_salary: Number(data.baseSalary) || 0,
        mpesa_number: data.mpesaNumber || null,
        email_verified: true,
        updated_by: caller.email,
        created_at_ms: now,
        updated_at_ms: now,
      },
      { onConflict: 'id' }
    );

    if (upsertErr) {
      await supaAdmin.auth.admin.deleteUser(uid).catch(() => undefined);
      return { success: false, message: `Profile setup failed: ${upsertErr.message}` };
    }

    if (upperRole === 'ADMIN' || upperRole === 'SUPER_ADMIN') {
      await supaAdmin
        .from('admins')
        .upsert(
          { email: normalizedEmail, firebase_id: normalizedEmail, is_root: isSuper, added_by: caller.email },
          { onConflict: 'email' }
        );
    }

    if (rawPin) {
      const { salt, hash } = createPinHash(rawPin);
      await supaAdmin.from('staff_pins').upsert(
        { uid, pin_salt: salt, pin_hash: hash, updated_at: new Date().toISOString() },
        { onConflict: 'uid' }
      );
    }

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'USER_CREATED',
        userId: caller.uid,
        details: `Created new ${upperRole} account for ${displayName} (${normalizedEmail})`,
        timestamp: now,
        severity: 'INFO',
      });
    } catch {}

    return { success: true, uid };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

export async function adminUpdateStaff(data: {
  uid: string;
  displayName: string;
  role: string;
  branchId?: string | null;
  branchIds?: string[] | null;
  assignedUnits?: string[] | null;
  baseSalary?: number;
  mpesaNumber?: string | null;
  pin?: string | null;
  idToken?: string;
}) {
  try {
    const caller = await verifyAdminCaller(data.idToken);
    const upperRole = String(data.role || '').trim().toUpperCase();
    const rawPin = String(data.pin || '').trim();
    if (!VALID_STAFF_ROLES.includes(upperRole as any) && upperRole !== 'CLIENT') {
      return { success: false, message: 'Select a valid system role.' };
    }
    if (rawPin && !/^\d{4}$/.test(rawPin)) {
      return { success: false, message: 'Optional terminal PIN must be exactly 4 digits.' };
    }

    const supaAdmin = getSupabaseAdminClient();
    const { data: existingProfile } = await supaAdmin
      .from('profiles')
      .select('id, uid, email, role, is_super_admin, has_pin, status')
      .or(`id.eq.${data.uid},uid.eq.${data.uid}`)
      .maybeSingle();

    const supaId = existingProfile?.id || data.uid;
    const targetEmail = String(existingProfile?.email || '').toLowerCase();
    const targetIsSuperAdmin = existingProfile?.is_super_admin === true || existingProfile?.role === 'SUPER_ADMIN' || targetEmail === 'gackstoneb@gmail.com';

    // Self-role protection
    if (caller.uid === supaId && upperRole !== existingProfile?.role) {
      return { success: false, message: 'You cannot change your own administrator role.' };
    }

    // Protection for Super Admin targets
    if (targetIsSuperAdmin && !caller.isSuperAdmin) {
      return { success: false, message: 'Only Super Administrators can modify a Super Administrator profile.' };
    }
    if (targetEmail === 'gackstoneb@gmail.com' && upperRole !== 'SUPER_ADMIN') {
      return { success: false, message: 'The primary Super Administrator account role cannot be changed.' };
    }

    // Role assignment hierarchy
    if (upperRole === 'SUPER_ADMIN' && !caller.isSuperAdmin) {
      return { success: false, message: 'Only Super Administrators can promote an account to Super Administrator.' };
    }

    const isTargetSuper = upperRole === 'SUPER_ADMIN';

    await supaAdmin.auth.admin.updateUserById(supaId, {
      user_metadata: {
        display_name: data.displayName.trim(),
        full_name: data.displayName.trim(),
      },
      app_metadata: {
        role: upperRole,
        super_admin: isTargetSuper,
      },
    });

    const branchIds = Array.isArray(data.branchIds)
      ? data.branchIds.filter(Boolean)
      : data.branchId && data.branchId !== 'ALL'
        ? [data.branchId]
        : [];
    const activeBranchId = data.branchId && data.branchId !== 'ALL' ? data.branchId : branchIds[0] || null;

    const patch: Record<string, any> = {
      display_name: data.displayName.trim(),
      role: upperRole,
      is_super_admin: isTargetSuper,
      account_type: upperRole === 'CLIENT' ? 'CLIENT' : 'STAFF',
      assigned_units: Array.isArray(data.assignedUnits) ? data.assignedUnits : [],
      station_authorizations: Array.isArray(data.assignedUnits) ? data.assignedUnits : [],
      branch_ids: branchIds,
      branch_id: activeBranchId,
      active_branch_id: activeBranchId,
      base_salary: Number(data.baseSalary) || 0,
      mpesa_number: data.mpesaNumber || null,
      updated_by: caller.email,
      updated_at_ms: Date.now(),
    };
    if (rawPin) patch.has_pin = true;

    const { error: updateErr } = await supaAdmin.from('profiles').update(patch).eq('id', supaId);
    if (updateErr) return { success: false, message: updateErr.message };

    if (targetEmail) {
      if (upperRole === 'ADMIN' || upperRole === 'SUPER_ADMIN') {
        await supaAdmin
          .from('admins')
          .upsert(
            { email: targetEmail, firebase_id: targetEmail, is_root: isTargetSuper, added_by: caller.email },
            { onConflict: 'email' }
          );
      } else if (!ROOT_ADMIN_EMAILS.includes(targetEmail)) {
        await supaAdmin.from('admins').delete().ilike('email', targetEmail);
      }
    }

    if (rawPin) {
      const { salt, hash } = createPinHash(rawPin);
      const nowIso = new Date().toISOString();
      await supaAdmin.from('staff_pins').upsert(
        { uid: supaId, pin_salt: salt, pin_hash: hash, updated_at: nowIso },
        { onConflict: 'uid' }
      );
      await supaAdmin
        .from('terminal_device_staff')
        .update({ pin_salt: salt, pin_hash: hash, pin_updated_at: nowIso })
        .eq('uid', supaId);
    }

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'USER_UPDATED',
        userId: caller.uid,
        details: `Updated user ${targetEmail} (Role: ${upperRole}, Branch: ${activeBranchId || 'Global'})`,
        timestamp: Date.now(),
        severity: 'INFO',
      });
    } catch {}

    return { success: true };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

/**
 * Suspend a user account (deactivates login via Supabase Auth ban & profiles status)
 */
export async function adminSuspendUser(uid: string, reason?: string, idToken?: string) {
  try {
    const caller = await verifyAdminCaller(idToken);
    const supaAdmin = getSupabaseAdminClient();
    const { data: existingProfile } = await supaAdmin
      .from('profiles')
      .select('id, uid, email, role, is_super_admin, status')
      .or(`id.eq.${uid},uid.eq.${uid}`)
      .maybeSingle();

    const supaId = existingProfile?.id || uid;
    const targetEmail = String(existingProfile?.email || '').toLowerCase();

    if (caller.uid === supaId) {
      return { success: false, message: 'You cannot suspend your own account.' };
    }
    if (targetEmail === 'gackstoneb@gmail.com') {
      return { success: false, message: 'The primary Super Administrator account cannot be suspended.' };
    }
    if ((existingProfile?.role === 'SUPER_ADMIN' || existingProfile?.is_super_admin) && !caller.isSuperAdmin) {
      return { success: false, message: 'Only Super Administrators can suspend a Super Administrator.' };
    }

    // Ensure at least one active admin remains in the system
    if (existingProfile?.role === 'ADMIN' || existingProfile?.role === 'SUPER_ADMIN') {
      const { count } = await supaAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['ADMIN', 'SUPER_ADMIN'])
        .neq('id', supaId)
        .eq('status', 'active');

      if (!count || count <= 0) {
        return { success: false, message: 'Operation refused: The system must retain at least one active administrator.' };
      }
    }

    // Ban user in Supabase Auth
    const { error: authErr } = await supaAdmin.auth.admin.updateUserById(supaId, {
      ban_duration: '876000h',
    });
    if (authErr) return { success: false, message: authErr.message };

    const suspendReason = reason?.trim() || 'Suspended by administrator';
    const now = new Date().toISOString();

    const { error: profErr } = await supaAdmin
      .from('profiles')
      .update({
        status: 'suspended',
        disabled: true,
        suspended_at: now,
        suspended_by: caller.email,
        suspended_reason: suspendReason,
        updated_by: caller.email,
        updated_at_ms: Date.now(),
      })
      .eq('id', supaId);

    if (profErr) return { success: false, message: profErr.message };

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'USER_SUSPENDED',
        userId: caller.uid,
        details: `Suspended account for ${targetEmail}. Reason: ${suspendReason}`,
        timestamp: Date.now(),
        severity: 'WARNING',
      });
    } catch {}

    return { success: true };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

/**
 * Reactivate a suspended user account
 */
export async function adminReactivateUser(uid: string, idToken?: string) {
  try {
    const caller = await verifyAdminCaller(idToken);
    const supaAdmin = getSupabaseAdminClient();
    const { data: existingProfile } = await supaAdmin
      .from('profiles')
      .select('id, uid, email, role, is_super_admin, status')
      .or(`id.eq.${uid},uid.eq.${uid}`)
      .maybeSingle();

    const supaId = existingProfile?.id || uid;
    const targetEmail = String(existingProfile?.email || '').toLowerCase();

    if ((existingProfile?.role === 'SUPER_ADMIN' || existingProfile?.is_super_admin) && !caller.isSuperAdmin) {
      return { success: false, message: 'Only Super Administrators can reactivate a Super Administrator.' };
    }

    // Unban in Supabase Auth
    const { error: authErr } = await supaAdmin.auth.admin.updateUserById(supaId, {
      ban_duration: 'none',
    });
    if (authErr) return { success: false, message: authErr.message };

    const { error: profErr } = await supaAdmin
      .from('profiles')
      .update({
        status: 'active',
        disabled: false,
        suspended_at: null,
        suspended_by: null,
        suspended_reason: null,
        updated_by: caller.email,
        updated_at_ms: Date.now(),
      })
      .eq('id', supaId);

    if (profErr) return { success: false, message: profErr.message };

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'USER_REACTIVATED',
        userId: caller.uid,
        details: `Reactivated account for ${targetEmail}`,
        timestamp: Date.now(),
        severity: 'INFO',
      });
    } catch {}

    return { success: true };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

/**
 * Backwards compatible status updater
 */
export async function adminSetStaffActiveStatus(uid: string, disabled: boolean, idToken?: string) {
  if (disabled) {
    return adminSuspendUser(uid, 'Deactivated by administrator', idToken);
  }
  return adminReactivateUser(uid, idToken);
}

/**
 * Delete user account: performs smart soft-delete if business records exist, otherwise hard-deletes.
 */
export async function adminDeleteUser(
  uid: string,
  optionsOrToken?: string | { confirmEmail?: string; idToken?: string } | null,
  legacyToken?: string
): Promise<{ success: boolean; message?: string; mode?: string }> {
  try {
    const options: { confirmEmail?: string; idToken?: string } =
      optionsOrToken != null && typeof optionsOrToken === 'object' ? optionsOrToken : {};
    const idToken: string | undefined =
      typeof optionsOrToken === 'string' ? optionsOrToken : (options.idToken ?? legacyToken);
    const caller = await verifyAdminCaller(idToken);

    const supaAdmin = getSupabaseAdminClient();
    const { data: existingProfile } = await supaAdmin
      .from('profiles')
      .select('id, uid, email, role, display_name, is_super_admin')
      .or(`id.eq.${uid},uid.eq.${uid}`)
      .maybeSingle();

    const supaId = existingProfile?.id || uid;
    const targetEmail = String(existingProfile?.email || '').toLowerCase();

    if (caller.uid === supaId) {
      return { success: false, message: 'You cannot delete your own active administrator account.' };
    }
    if (targetEmail === 'gackstoneb@gmail.com' || targetEmail === 'bonfacewana3072@gmail.com') {
      return { success: false, message: 'Protected primary administrator accounts cannot be deleted.' };
    }
    if ((existingProfile?.role === 'SUPER_ADMIN' || existingProfile?.is_super_admin) && !caller.isSuperAdmin) {
      return { success: false, message: 'Only Super Administrators can delete a Super Administrator.' };
    }

    if (options.confirmEmail && options.confirmEmail.trim().toLowerCase() !== targetEmail) {
      return { success: false, message: 'Confirmation email does not match the target user email.' };
    }

    // Check for transactional references in orders, carwash_jobs, register_sessions, reconciliations
    const [{ count: orderCount }, { count: jobCount }, { count: sessionCount }, { count: reconCount }] = await Promise.all([
      supaAdmin.from('orders').select('*', { count: 'exact', head: true }).or(`cashier_id.eq.${supaId},user_id.eq.${supaId}`),
      supaAdmin.from('carwash_jobs').select('*', { count: 'exact', head: true }).eq('attendant_id', supaId),
      supaAdmin.from('register_sessions').select('*', { count: 'exact', head: true }).eq('cashier_id', supaId),
      supaAdmin.from('reconciliations').select('*', { count: 'exact', head: true }).eq('cashier_id', supaId),
    ]);

    const totalBusinessRecords = (orderCount || 0) + (jobCount || 0) + (sessionCount || 0) + (reconCount || 0);

    // If historical business records exist, perform SOFT-DELETE to preserve auditability and referential integrity
    if (totalBusinessRecords > 0) {
      const now = new Date().toISOString();
      await supaAdmin.auth.admin.updateUserById(supaId, { ban_duration: '876000h' });
      await supaAdmin.from('staff_pins').delete().eq('uid', supaId);
      await supaAdmin.from('terminal_device_staff').delete().eq('uid', supaId);
      if (targetEmail && !ROOT_ADMIN_EMAILS.includes(targetEmail)) {
        await supaAdmin.from('admins').delete().ilike('email', targetEmail);
      }

      const { error: softErr } = await supaAdmin.from('profiles').update({
        status: 'deleted',
        disabled: true,
        deleted_at: now,
        display_name: `${existingProfile?.display_name || 'Staff'} [ARCHIVED]`,
        updated_by: caller.email,
        updated_at_ms: Date.now(),
      }).eq('id', supaId);

      if (softErr) return { success: false, message: softErr.message };

      try {
        await getDbAdmin().collection('audit_logs').add({
          action: 'USER_SOFT_DELETED',
          userId: caller.uid,
          details: `Soft-deleted user ${targetEmail} (${totalBusinessRecords} historical records preserved)`,
          timestamp: Date.now(),
          severity: 'WARNING',
        });
      } catch {}

      return {
        success: true,
        mode: 'soft-deleted',
        message: `Account archived and soft-deleted. ${totalBusinessRecords} historical transaction records preserved.`,
      };
    }

    // No historical records -> Hard delete
    await supaAdmin.from('staff_pins').delete().eq('uid', supaId);
    await supaAdmin.from('terminal_device_staff').delete().eq('uid', supaId);
    if (targetEmail && !ROOT_ADMIN_EMAILS.includes(targetEmail)) {
      await supaAdmin.from('admins').delete().ilike('email', targetEmail);
    }
    await supaAdmin.from('profiles').delete().eq('id', supaId);
    const { error: delErr } = await supaAdmin.auth.admin.deleteUser(supaId);
    if (delErr && !delErr.message.toLowerCase().includes('not found')) {
      return { success: false, message: delErr.message };
    }

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'USER_HARD_DELETED',
        userId: caller.uid,
        details: `Permanently deleted user account ${targetEmail}`,
        timestamp: Date.now(),
        severity: 'WARNING',
      });
    } catch {}

    return { success: true, mode: 'hard-deleted', message: 'User account permanently deleted.' };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

export async function adminResetUserPassword(uid: string, pass: string, idToken?: string) {
  try {
    const caller = await verifyAdminCaller(idToken);
    if (!pass || pass.length < 8) {
      return { success: false, message: 'New password must be at least 8 characters.' };
    }
    const supaAdmin = getSupabaseAdminClient();
    const { data: existingProfile } = await supaAdmin
      .from('profiles')
      .select('id, email, is_super_admin')
      .or(`id.eq.${uid},uid.eq.${uid}`)
      .maybeSingle();
    const supaId = existingProfile?.id || uid;
    const targetEmail = String(existingProfile?.email || '').toLowerCase();

    if (targetEmail === 'gackstoneb@gmail.com' && !caller.isSuperAdmin && caller.uid !== supaId) {
      return { success: false, message: 'Only Super Administrators can reset the primary Super Administrator password.' };
    }

    const { error } = await supaAdmin.auth.admin.updateUserById(supaId, {
      password: pass,
      email_confirm: true,
    });
    if (error) return { success: false, message: mapAdminAuthError(error) };

    await supaAdmin.from('profiles').update({ updated_at_ms: Date.now() }).eq('id', supaId);

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'USER_PASSWORD_RESET',
        userId: caller.uid,
        details: `Reset password for user ${targetEmail}`,
        timestamp: Date.now(),
        severity: 'WARNING',
      });
    } catch {}

    return { success: true };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

/**
 * Access Matrix & Permissions Management Server Actions
 */
export async function adminGetRolesAndPermissions(idToken?: string) {
  try {
    await verifyAdminCaller(idToken);
    const supaAdmin = getSupabaseAdminClient();

    const [{ data: roles, error: rolesErr }, { data: permissions, error: permsErr }, { data: rolePermissions, error: rpErr }] = await Promise.all([
      supaAdmin.from('roles').select('*').order('created_at', { ascending: true }),
      supaAdmin.from('permissions').select('*').order('category', { ascending: true }).order('name', { ascending: true }),
      supaAdmin.from('role_permissions').select('*'),
    ]);

    if (rolesErr || permsErr || rpErr) {
      return { success: false, message: rolesErr?.message || permsErr?.message || rpErr?.message };
    }

    return {
      success: true,
      roles: roles || [],
      permissions: permissions || [],
      rolePermissions: rolePermissions || [],
    };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

export async function adminUpdateRolePermission(
  data: { roleId: string; permissionId: string; accessLevel: string; idToken?: string }
) {
  try {
    const caller = await verifyAdminCaller(data.idToken);
    const supaAdmin = getSupabaseAdminClient();
    const upperRoleId = String(data.roleId).trim().toUpperCase();
    const permId = String(data.permissionId).trim();
    const accessLevel = String(data.accessLevel).trim().toLowerCase();

    if (upperRoleId === 'SUPER_ADMIN') {
      return { success: false, message: 'Super Administrator privileges cannot be restricted.' };
    }

    const { error } = await supaAdmin.from('role_permissions').upsert(
      {
        role_id: upperRoleId,
        permission_id: permId,
        access_level: accessLevel,
        updated_at: new Date().toISOString(),
        updated_by: caller.email,
      },
      { onConflict: 'role_id,permission_id' }
    );

    if (error) return { success: false, message: error.message };

    try {
      await getDbAdmin().collection('audit_logs').add({
        action: 'ROLE_PERMISSION_UPDATED',
        userId: caller.uid,
        details: `Updated permission ${permId} for role ${upperRoleId} to ${accessLevel}`,
        timestamp: Date.now(),
        severity: 'INFO',
      });
    } catch {}

    return { success: true };
  } catch (error: any) {
    return { success: false, message: mapAdminAuthError(error) };
  }
}

export async function createPaystackRecipient(data: {
  name: string;
  account_number: string;
  bank_code: string;
  description?: string;
}) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const response = await fetch(`https://api.paystack.co/transferrecipient`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'mobile_money',
        name: data.name,
        account_number: data.account_number,
        bank_code: data.bank_code,
        currency: 'KES',
        description: data.description,
      }),
    });
    return response.json();
  } catch (err: any) {
    return { status: false, message: err.message };
  }
}

export async function checkAdminStatus() {
  try {
    const db = getDbAdmin();
    await db.collection('system').doc('ping').set({ lastChecked: Date.now() });
    return { success: true, message: 'ACTIVE' };
  } catch {
    return { success: false, message: 'ERROR' };
  }
}

export async function checkAiStatus() {
  const geminiKey = process.env.GOOGLE_GENAI_API_KEY;
  const configured = Boolean(geminiKey && geminiKey !== '[SENSITIVE]');
  return {
    hasKey: configured,
    provider: 'Google Gemini',
    status: configured ? 'OPERATIONAL' : 'OFFLINE',
    message: configured ? 'Neural link established.' : 'Missing API key.',
  };
}
