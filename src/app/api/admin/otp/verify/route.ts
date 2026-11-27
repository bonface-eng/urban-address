import { NextRequest,NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp,getDbAdmin } from '@/lib/db/admin';
import { hashOtp,utcDayKey } from '@/lib/otp-security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 try{
  getAdminApp();const header=request.headers.get('authorization')||'';const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!token)return NextResponse.json({error:'Sign in is required.'},{status:401});
  const decoded=await admin.auth().verifyIdToken(token);const email=String(decoded.email||'').trim().toLowerCase();const db=getDbAdmin();
  const [profile,whitelist]=await Promise.all([db.collection('users').doc(decoded.uid).get(),email?db.collection('admins').doc(email).get():Promise.resolve(null)]);
  const roots=['urbanautoexpressnakuru@gmail.com','urbanaautoexpressnakuru@gmail.com','samuelkarani044@gmail.com','gmaina424@gmail.com','bonfacewana3072@gmail.com'];
  if(!(roots.includes(email)||!!whitelist?.exists||String(profile.data()?.role||'').toUpperCase()==='ADMIN'))return NextResponse.json({error:'Administrator access required.'},{status:403});
  const body=await request.json();const code=String(body?.code||'').trim();if(!/^\d{6}$/.test(code))return NextResponse.json({error:'Enter the six-digit code.'},{status:400});
  const today=utcDayKey();const ref=db.collection('admin_daily_otps').doc(decoded.uid);
  const result=await db.runTransaction(async tx=>{const snap=await tx.get(ref);const data=snap.data();const now=Date.now();if(!data||data.day!==today||data.expiresAt<now)return'expired';if(data.consumedAt)return'used';if((data.attempts||0)>=5)return'locked';if(data.codeHash!==hashOtp(decoded.uid,'admin:'+today,code)){tx.update(ref,{attempts:(data.attempts||0)+1,updatedAt:now});return'invalid';}tx.update(ref,{consumedAt:now,verifiedAt:now});return'valid';});
  if(result!=='valid'){const messages:Record<string,string>={expired:'The code has expired. Sign in again tomorrow or contact an administrator.',used:'This code has already been used.',locked:'Too many incorrect attempts. Try again tomorrow.',invalid:'Incorrect code. Please check and try again.'};return NextResponse.json({error:messages[result]},{status:result==='invalid'?400:429});}
  const user=await admin.auth().getUser(decoded.uid);
  const verifiedAt = new Date();
  await admin.auth().setCustomUserClaims(decoded.uid,{
   ...user.customClaims,
   adminOtpVerifiedDate:today,
   adminOtpVerifiedYear:verifiedAt.getUTCFullYear(),
   adminOtpVerifiedMonth:verifiedAt.getUTCMonth()+1,
   adminOtpVerifiedDay:verifiedAt.getUTCDate(),
  });
  await db.collection('audit_logs').add({action:'ADMIN_DAILY_OTP_VERIFIED',userId:decoded.uid,details:'Administrator completed daily email OTP verification.',timestamp:Date.now(),severity:'INFO'});
  return NextResponse.json({ok:true,verifiedDate:today});
 }catch(error){console.error('[ADMIN_DAILY_OTP_VERIFY]',error);return NextResponse.json({error:'Administrator verification failed. Please try again.'},{status:500});}
}
