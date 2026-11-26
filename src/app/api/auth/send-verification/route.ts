import { NextRequest,NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAdminApp,getDbAdmin } from '@/lib/firebase-admin';
import { sendTransactionalEmail } from '@/lib/resend';
import { customerNotificationEmail } from '@/lib/email/templates';
import { createOtp,hashOtp,recordOtpRequestSignal } from '@/lib/otp-security';
import { notifyTelegramOperations } from '@/lib/telegram/notifications';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 try{
  getAdminApp();const header=request.headers.get('authorization')||'';const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!token)return NextResponse.json({error:'Sign in is required.'},{status:401});
  const decoded=await admin.auth().verifyIdToken(token);const user=await admin.auth().getUser(decoded.uid);
  if(!user.email)return NextResponse.json({error:'An email address is required.'},{status:400});
  if(user.emailVerified)return NextResponse.json({ok:true,alreadyVerified:true});
  const db=getDbAdmin();
  const otpSignal = await recordOtpRequestSignal(db, decoded.uid, 'SIGNUP_EMAIL_VERIFICATION');
  if (otpSignal.shouldNotify) {
   const email = user.email;
   const maskedEmail = email.replace(/^(.).+(@.*)$/, '$1***$2');
   await notifyTelegramOperations({
    type:'SECURITY',
    title:otpSignal.spamSuspected?'OTP REQUEST | SPAM SUSPECTED':'OTP VERIFICATION REQUEST',
    message:`Email verification requested for ${maskedEmail}. Requests in 15 minutes: ${otpSignal.count}. ${otpSignal.spamSuspected?'Repeated requests have crossed the spam threshold.':''} Verification codes are never sent to Telegram.`,
    severity:otpSignal.spamSuspected?'WARNING':'INFO',
    managementOnly:true
   }).catch(error=>console.error('[TELEGRAM_OTP_REQUEST]',error));
  }
  const ref=db.collection('email_verification_otps').doc(decoded.uid);const code=createOtp();const now=Date.now();
  const state=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);const data=snap.data();const hour=Math.floor(now/3600000);
   if(data?.lastSentAt&&now-data.lastSentAt<60000)return{status:'cooldown' as const};
   const count=data?.hour===hour?(data.hourlyCount||0):0;
   if(count>=5)return{status:'limited' as const};
   tx.set(ref,{codeHash:hashOtp(decoded.uid,'signup',code),createdAt:now,lastSentAt:now,expiresAt:now+10*60*1000,attempts:0,consumedAt:null,hour,hourlyCount:count+1},{merge:true});
   return{status:'sent' as const};
  });
  if(state.status==='cooldown')return NextResponse.json({error:'Please wait 60 seconds before requesting another code.'},{status:429});
  if(state.status==='limited')return NextResponse.json({error:'You have reached the limit of five verification emails this hour. Try again later.'},{status:429});
  const email=customerNotificationEmail({email:user.email,name:user.displayName||'there',subject:'Your Urban Auto Express verification code',heading:'Verify your email address',message:'Your six-digit verification code is '+code+'. It expires in 10 minutes. Never share it with anyone.'});
  await sendTransactionalEmail({sender:'auth',to:user.email,...email});
  return NextResponse.json({ok:true,expiresInSeconds:600});
 }catch(error){console.error('[AUTH_EMAIL_VERIFICATION]',error);return NextResponse.json({error:'We could not send the verification code. Please try again.'},{status:503});}
}
