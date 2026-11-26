import { NextRequest,NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminApp,getDbAdmin } from '@/lib/firebase-admin';
import { createOtp,hashOtp,utcDayEnd,utcDayKey,recordOtpRequestSignal } from '@/lib/otp-security';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';
import { sendTransactionalEmail } from '@/lib/resend';
import { customerNotificationEmail } from '@/lib/email/templates';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const ROOT_ADMINS=['urbanautoexpressnakuru@gmail.com','urbanaautoexpressnakuru@gmail.com','samuelkarani044@gmail.com','gmaina424@gmail.com','bonfacewana3072@gmail.com'];
export async function POST(request:NextRequest){
 try{
  getAdminApp();const header=request.headers.get('authorization')||'';const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!token)return NextResponse.json({error:'Sign in is required.'},{status:401});
  const decoded=await admin.auth().verifyIdToken(token);const email=String(decoded.email||'').trim().toLowerCase();const db=getDbAdmin();
  const [profile,whitelist]=await Promise.all([db.collection('users').doc(decoded.uid).get(),email?db.collection('admins').doc(email).get():Promise.resolve(null)]);
  const isAdmin=ROOT_ADMINS.includes(email)||!!whitelist?.exists||String(profile.data()?.role||'').toUpperCase()==='ADMIN';
  if(!isAdmin)return NextResponse.json({required:false});
  const today=utcDayKey();if(decoded.adminOtpVerifiedDate===today)return NextResponse.json({required:false,verifiedToday:true});
  const user=await admin.auth().getUser(decoded.uid);if(!user.email)return NextResponse.json({error:'Your admin account has no email address.'},{status:400});
  const otpSignal = await recordOtpRequestSignal(db, decoded.uid, 'ADMIN_DAILY_OTP');
  if (otpSignal.shouldNotify) {
   const maskedEmail = user.email.replace(/^(.).+(@.*)$/, '$1***$2');
   await notifyTelegramOperations({
    type:'SECURITY',
    title:otpSignal.spamSuspected?'ADMIN OTP REQUEST | SPAM SUSPECTED':'ADMIN OTP REQUEST',
    message:`Administrator verification requested for ${maskedEmail}. Requests in 15 minutes: ${otpSignal.count}. ${otpSignal.spamSuspected?'Repeated requests have crossed the spam threshold.':''} Verification codes are never sent to Telegram.`,
    severity:otpSignal.spamSuspected?'WARNING':'INFO',
    managementOnly:true
   }).catch(error=>console.error('[TELEGRAM_ADMIN_OTP_REQUEST]',error));
  }
  const ref=db.collection('admin_daily_otps').doc(decoded.uid);const code=createOtp();const now=Date.now();
  const state=await db.runTransaction(async tx=>{const snap=await tx.get(ref);const data=snap.data();if(data?.day===today&&data?.sentAt)return{sent:false};tx.set(ref,{day:today,codeHash:hashOtp(decoded.uid,'admin:'+today,code),sentAt:now,expiresAt:utcDayEnd(),attempts:0,consumedAt:null});return{sent:true};});
  if(state.sent){
   const emailContent=customerNotificationEmail({email:user.email,name:user.displayName||'Administrator',subject:'Your Urban Auto Express administrator sign-in code',heading:'Administrator sign-in verification',message:'Your six-digit administrator sign-in code is '+code+'. It expires at midnight UTC today. Never share it with anyone.'});
   try{await sendTransactionalEmail({sender:'auth',to:user.email,...emailContent});}
   catch(error){await ref.delete();throw error;}
  }
  return NextResponse.json({required:true,sent:state.sent,message:state.sent?'A verification code has been sent to your administrator email.':'A code has already been sent today. Use the code in your inbox.'});
 }catch(error){console.error('[ADMIN_DAILY_OTP_REQUEST]',error);return NextResponse.json({error:'We could not start administrator verification. Please try again.'},{status:500});}
}
