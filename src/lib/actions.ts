'use server';

import { S3Client, PutObjectCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { SYSTEM_CONFIG } from './config';
import * as admin from 'firebase-admin';
import { getAdminApp, getDbAdmin } from './firebase-admin';

function getR2Client() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('R2_INFRASTRUCTURE_SECRETS_MISSING');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * reCAPTCHA Enterprise Verification Node
 */
export async function verifyRecaptcha(token: string | null) {
  if (!token) return { success: false, message: 'Security verification token missing.' };
  
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  try {
    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secretKey}&response=${token}`
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, message: 'Identity verified.' };
    }
    
    return { success: false, message: 'Security check failed. Ref: ' + (data['error-codes']?.[0] || 'Unknown') };
  } catch (err) {
    console.error('[RECAPTCHA_VERIFY_ERROR]', err);
    return { success: false, message: 'Verification node unreachable.' };
  }
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
 * Uploads assets to Cloudflare R2 with category prefixing
 */
export async function uploadImageToR2(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    const category = (formData.get('category') as string) || 'other';
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucket || !publicUrl) throw new Error('R2_CONFIG_MISSING');

    const extension = file.name.split('.').pop();
    const key = `catalog/${category.toLowerCase()}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type
    }));
    return { success: true, url: `${publicUrl}/${key}` };
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
    const type = formData.get('type') as string; // 'APK' or 'SCREENSHOT'
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucket || !publicUrl) throw new Error('R2_CONFIG_MISSING');

    const extension = file.name.split('.').pop();
    const filename = type === 'APK' ? 'urban_express.apk' : `${type.toLowerCase()}_${Date.now()}.${extension}`;
    const key = `app/${filename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: type === 'APK' ? 'application/vnd.android.package-archive' : file.type
    }));
    
    return { 
      success: true, 
      url: `${publicUrl}/${key}`,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
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
    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!bucket || !publicUrl) throw new Error('R2_CONFIG_MISSING');

    const prefix = category && category !== 'All' ? `catalog/${category.toLowerCase()}/` : 'catalog/';
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await r2.send(command);
    const contents = response.Contents || [];

    const images = contents
      .filter(item => {
        const key = item.Key || '';
        return key.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      })
      .map(item => ({
        url: `${publicUrl}/${item.Key}`,
        key: item.Key || '',
        lastModified: item.LastModified?.getTime() || 0,
        size: item.Size || 0,
        category: (item.Key || '').split('/')[1] || 'other'
      }))
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
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    const res = await response.json();
    if (res.status && res.data?.status === 'success') {
      return { success: true, message: 'Verified', data: res.data };
    }
    return { success: false, message: res.data?.gateway_response || 'Failed' };
  } catch (err) {
    return { success: false, message: 'Connection Error' };
  }
}

/**
 * Robust Historical Stock Reconciliation
 * Subtracts quantities from inventory for PAID orders that haven't been synced yet.
 * RESPECTS START TIME: Essential safety net to avoid double-deducting after manual restocks.
 */
export async function reconcileHistoricalStock(startTime: number, unit: string) {
  try {
    const db = getDbAdmin();
    // Query PAID orders within the timeframe.
    let q: admin.firestore.Query = db.collection('orders')
      .where('status', '==', 'PAID');
    
    // Safety Net: If startTime is 0, we risk double counting.
    // Recommended to always use a specific starting checkpoint.
    if (startTime > 0) {
      q = q.where('timestamp', '>=', startTime);
    }
    
    if (unit !== 'ALL') {
      q = q.where('type', '==', unit);
    }
    
    const snap = await q.get();
    
    // Filter only those that haven't been synchronized yet
    const unsyncedDocs = snap.docs.filter(docSnap => docSnap.data().inventorySynced !== true);
    
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
              updatedAt: Date.now()
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
      severity: 'WARNING'
    });

    return { success: true, message: `Sync Complete. ${updatedCount} sales orders synchronized with inventory balance.` };
  } catch (err: any) {
    console.error('[STOCK_RECONCILE_FAILURE]', err);
    return { success: false, message: err.message };
  }
}

/**
 * Capture Full Inventory Snapshot
 */
export async function backupInventory(userId: string, userName: string) {
  try {
    const db = getDbAdmin();
    const snap = await db.collection('inventory').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const backupRef = await db.collection('inventory_backups').add({
      items,
      timestamp: Date.now(),
      createdBy: userId,
      createdByName: userName,
      itemCount: items.length
    });

    await db.collection('audit_logs').add({
      action: 'INVENTORY_BACKUP',
      userId,
      details: `Created inventory snapshot #${backupRef.id.slice(-6).toUpperCase()}. Captured ${items.length} records.`,
      timestamp: Date.now(),
      severity: 'INFO'
    });

    return { success: true, id: backupRef.id };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Restore Inventory from Snapshot
 */
export async function restoreInventory(backupId: string, userId: string) {
  try {
    const db = getDbAdmin();
    const backupSnap = await db.collection('inventory_backups').doc(backupId).get();
    if (!backupSnap.exists) throw new Error('Backup data node not found.');
    
    const { items } = backupSnap.data() as any;
    
    // Process in chunks if large, but for MVP we assume batch size limit (500)
    const batch = db.batch();

    // 1. Clear existing inventory to prevent stale items
    const currentSnap = await db.collection('inventory').get();
    currentSnap.docs.forEach(d => batch.delete(d.ref));

    // 2. Restore from backup
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
      severity: 'CRITICAL'
    });

    return { success: true, message: `Node restored to snapshot #${backupId.slice(-6).toUpperCase()}.` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function adminCreateUser(data: { email: string; password: string; displayName: string; role: string; assignedUnits?: string[] | null; baseSalary?: number }) {
  try {
    const app = getAdminApp();
    if (!app) throw new Error('ADMIN_SDK_NOT_READY');
    const auth = admin.auth(app);
    const db = admin.firestore(app);
    const userRecord = await auth.createUser({ email: data.email, password: data.password, displayName: data.displayName });
    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: data.email.toLowerCase().trim(),
      displayName: data.displayName,
      role: data.role,
      assignedUnits: data.assignedUnits || [],
      baseSalary: data.baseSalary || 0,
      createdAt: Date.now(),
      accountType: 'STAFF',
    });
    return { success: true, uid: userRecord.uid };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function adminDeleteUser(uid: string) {
  try {
    const app = getAdminApp();
    if (!app) throw new Error('ADMIN_SDK_NOT_READY');
    const auth = admin.auth(app);
    const db = admin.firestore(app);
    try { await auth.deleteUser(uid); } catch (e) {}
    await db.collection('users').doc(uid).delete();
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function adminResetUserPassword(uid: string, pass: string) {
  try {
    const app = getAdminApp();
    if (!app) throw new Error('ADMIN_SDK_NOT_READY');
    const auth = admin.auth(app);
    const db = admin.firestore(app);
    await auth.updateUser(uid, { password: pass });
    await db.collection('users').doc(uid).update({ updatedAt: Date.now() });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function createPaystackRecipient(data: { name: string; account_number: string; bank_code: string; description?: string }) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const response = await fetch(`https://api.paystack.co/transferrecipient`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'mobile_money', name: data.name, account_number: data.account_number, bank_code: data.bank_code, currency: 'KES', description: data.description })
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
  } catch (e: any) {
    return { success: false, message: 'ERROR' };
  }
}

export async function checkAiStatus() {
  const geminiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
  return {
    hasKey: !!geminiKey,
    provider: 'Google Gemini',
    status: geminiKey ? 'OPERATIONAL' : 'OFFLINE',
    message: geminiKey ? 'Neural link established.' : 'Missing API key.'
  };
}
