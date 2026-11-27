'use client';
import React,{Suspense,useEffect,useState} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import Link from 'next/link';
import {applyActionCode} from '@/lib/db';
import {useAuth,useUser} from '@/lib/data';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {CheckCircle2,AlertTriangle,RefreshCcw,ShieldCheck,Mail} from 'lucide-react';

function VerifyEmailContent(){
 const auth=useAuth();const {user}=useUser();const searchParams=useSearchParams();const router=useRouter();
 const [status,setStatus]=useState<'ready'|'loading'|'success'|'error'>('ready');
 const [code,setCode]=useState('');const [message,setMessage]=useState('');const [sending,setSending]=useState(false);const [verifying,setVerifying]=useState(false);
 useEffect(()=>{
  const actionCode=searchParams.get('oobCode');if(!auth||!actionCode)return;
  let active=true;setStatus('loading');
  applyActionCode(auth,actionCode).then(async()=>{await auth.currentUser?.reload();if(active)setStatus('success');}).catch(()=>{if(active)setStatus('error');});
  return()=>{active=false;};
 },[auth,searchParams]);
 const requestCode=async()=>{
  if(!user){setMessage('Sign in with the account you just created before requesting a code.');return;}
  setSending(true);setMessage('');
  try{const token=await user.getIdToken();const response=await fetch('/api/auth/send-verification',{method:'POST',headers:{Authorization:'Bearer '+token}});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not send a code.');
   setMessage(data.alreadyVerified?'Your email is already verified.':'A new six-digit code has been sent. It expires in 10 minutes.');
  }catch(error:any){setMessage(error.message||'Could not send a code.');}finally{setSending(false);}
 };
 const verify=async(event:React.FormEvent)=>{
  event.preventDefault();if(!user||verifying)return;setVerifying(true);setMessage('');
  try{const token=await user.getIdToken();const response=await fetch('/api/auth/verify-signup-otp',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({code})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Verification failed.');
   await user.reload();setStatus('success');setMessage('Your email address is verified.');setTimeout(()=>router.replace('/'),900);
  }catch(error:any){setMessage(error.message||'Verification failed.');}finally{setVerifying(false);}
 };
 return <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-5"><section className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 text-center shadow-sm">
  <img src="/assets/logo.png" alt="Urban Auto Express" className="h-12 w-auto mx-auto mb-7 object-contain"/>
  {status==='loading'?<><RefreshCcw className="h-9 w-9 animate-spin text-primary mx-auto mb-5"/><h1 className="text-lg font-bold text-zinc-900">Verifying your email</h1><p className="text-sm text-zinc-500 mt-2">Please wait while we confirm your address.</p></>:
   status==='success'?<><CheckCircle2 className="h-11 w-11 text-green-600 mx-auto mb-5"/><h1 className="text-lg font-bold text-zinc-900">Email verified</h1><p className="text-sm text-zinc-500 mt-2">Your Urban Auto Express account email has been confirmed.</p><Button onClick={()=>router.replace('/')} className="w-full mt-7">Continue</Button></>:
   status==='error'?<><AlertTriangle className="h-11 w-11 text-amber-600 mx-auto mb-5"/><h1 className="text-lg font-bold text-zinc-900">Verification link expired</h1><p className="text-sm text-zinc-500 mt-2">Sign in and request a fresh verification code.</p><Button asChild className="w-full mt-7"><Link href="/login">Return to sign in</Link></Button></>:
   <><Mail className="h-10 w-10 text-primary mx-auto mb-4"/><h1 className="text-lg font-bold text-zinc-900">Verify your email address</h1><p className="text-sm text-zinc-500 mt-2">Enter the six-digit code sent to your inbox.</p>
    <form onSubmit={verify} className="mt-6 space-y-3"><label htmlFor="email-otp" className="block text-left text-xs font-semibold text-zinc-700">Verification code</label><Input id="email-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" className="h-12 text-center text-xl tracking-[0.45em] font-bold" required/><Button type="submit" disabled={code.length!==6||verifying} className="w-full h-12">{verifying?<RefreshCcw className="h-4 w-4 animate-spin"/>:'Verify email'}</Button></form>
    <Button type="button" variant="outline" onClick={requestCode} disabled={sending||!user} className="w-full mt-3">{sending?'Sending…':'Resend verification code'}</Button>
    {message&&<p role="status" className="mt-4 text-xs leading-5 text-zinc-600">{message}</p>}
    {!user&&<p className="mt-4 text-xs text-zinc-500">Your account session is not active. <Link href="/login" className="text-primary underline">Sign in</Link> to request a code.</p>}
   </>}
  <p className="mt-7 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400"><ShieldCheck className="h-3.5 w-3.5"/> Secure account verification</p>
 </section></main>;
}
export default function VerifyEmailPage(){return <Suspense fallback={<main className="min-h-screen flex items-center justify-center"><RefreshCcw className="h-8 w-8 animate-spin text-primary"/></main>}><VerifyEmailContent/></Suspense>;}
