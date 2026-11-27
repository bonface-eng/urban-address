import { NextRequest,NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp,getDbAdmin } from '@/lib/firebase-admin';
import { checkout,CheckoutError } from '@/lib/checkout-service';
import { StaffAccessError } from '@/lib/staff-access';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
async function verifyPayment(reference:string,amount:number) {
  const secret=process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !Number.isFinite(amount)) return false;
  const response=await fetch('https://api.paystack.co/transaction/verify/'+encodeURIComponent(reference),{headers:{Authorization:`Bearer ${secret}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
  if (!response.ok) return false;
  const result=await response.json();
  return result.status===true && result.data?.status==='success' && result.data?.currency==='KES' && result.data?.amount===Math.round(amount*100) && result.data?.reference===reference;
}
export async function POST(request:NextRequest) {
  const header=request.headers.get('authorization')||'';
  if (!header.startsWith('Bearer ') || !header.slice(7)) return json({code:'CHECKOUT_AUTH_REQUIRED'},401);
  try {
    let identity;
    try {identity=await getAuth(getAdminApp()!).verifyIdToken(header.slice(7),true);} catch {return json({code:'CHECKOUT_AUTH_REQUIRED'},401);}
    let body;try {body=await request.json();} catch {return json({code:'CHECKOUT_INVALID'},400);}
    if (!body || typeof body!=='object' || Array.isArray(body)) return json({code:'CHECKOUT_INVALID'},400);
    return json(await checkout(getDbAdmin(),{uid:identity.uid,email:identity.email,email_verified:identity.email_verified},body,verifyPayment));
  } catch(error) {
    if(error instanceof CheckoutError || error instanceof StaffAccessError) return json({code:error.code},error.status);
    console.error('[CHECKOUT] Unconfirmed transaction result.');
    return json({code:'CHECKOUT_UNCONFIRMED'},503);
  }
}
