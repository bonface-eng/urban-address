import { NextRequest, NextResponse } from 'next/server';
import * as admin from '@/lib/db/admin';
import { getAdminApp, getDbAdmin } from '@/lib/db/admin';
import { hashOtp } from '@/lib/otp-security';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    getAdminApp();
    const header=request.headers.get('authorization')||'';
    const token=header.startsWith('Bearer ')?header.slice(7):'';
    if(!token) return NextResponse.json({error:'Sign in is required.'},{status:401});
    const decoded=await admin.auth().verifyIdToken(token);
    const user=await admin.auth().getUser(decoded.uid);
    if(!user.email) return NextResponse.json({error:'An email address is required.'},{status:400});
    if(user.emailVerified) return NextResponse.json({ok:true,alreadyVerified:true});
    const body=await request.json(); const code=String(body?.code||'').trim();
    if(!/^\d{6}$/.test(code)) return NextResponse.json({error:'Enter the six-digit code.'},{status:400});
    const db=getDbAdmin(); const ref=db.collection('email_verification_otps').doc(decoded.uid);
    const result=await db.runTransaction(async tx=>{
      const snap=await tx.get(ref); const data=snap.data(); const now=Date.now();
      if(!data||data.expiresAt<now) return 'expired';
      if(data.consumedAt) return 'used';
      if((data.attempts||0)>=5) return 'locked';
      if(data.codeHash!==hashOtp(decoded.uid,'signup',code)){tx.update(ref,{attempts:(data.attempts||0)+1,updatedAt:now});return 'invalid';}
      tx.update(ref,{consumedAt:now,updatedAt:now}); return 'valid';
    });
    if(result!=='valid'){
      const messages:Record<string,string>={expired:'This code has expired. Request a new verification code.',used:'This code has already been used.',locked:'Too many incorrect attempts. Request a new code later.',invalid:'That code is incorrect. Check it and try again.'};
      return NextResponse.json({error:messages[result]},{status:result==='invalid'?400:429});
    }
    await admin.auth().updateUser(decoded.uid,{emailVerified:true});
    await db.collection('users').doc(decoded.uid).set({emailVerified:true,emailVerifiedAt:Date.now()},{merge:true});
    return NextResponse.json({ok:true});
  } catch(error){console.error('[SIGNUP_OTP_VERIFY]',error);return NextResponse.json({error:'We could not verify this code. Please try again.'},{status:500});}
}
