'use client';
import React,{useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useUser} from '@/lib/data';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ShieldCheck,RefreshCcw,Mail} from 'lucide-react';

export default function AdminOtpPage(){
 const {user,loading}=useUser();const router=useRouter();const [code,setCode]=useState('');
 useEffect(()=>{if(!loading&&!user)router.replace('/login');},[loading,user,router]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('A daily administrator verification code has been sent to your registered email address.');
 const verify=async(event:React.FormEvent)=>{
  event.preventDefault();if(!user||busy)return;setBusy(true);setMessage('');
  try{
   const token=await user.getIdToken();const response=await fetch('/api/admin/otp/verify',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({code})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Verification failed.');
   await user.getIdToken(true);router.replace('/dashboard');
  }catch(error:any){setMessage(error.message||'Could not verify your code.');}finally{setBusy(false);}
 };
 if(loading)return <main className="min-h-screen flex items-center justify-center"><RefreshCcw className="h-7 w-7 animate-spin text-primary"/></main>;
 return <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-4"><section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm">
  <img src="/assets/logo.png" alt="Urban Auto Express" className="h-11 w-auto object-contain mx-auto mb-7"/>
  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#FF6A00]"><ShieldCheck className="h-6 w-6"/></div>
  <h1 className="text-center text-xl font-semibold text-zinc-900">Administrator verification</h1>
  <p className="mt-2 text-center text-sm leading-6 text-zinc-500">Enter the six-digit security code sent to your administrator email. Verification remains active until midnight UTC.</p>
  <form onSubmit={verify} className="mt-6 space-y-3">
   <label htmlFor="admin-otp" className="block text-xs font-semibold text-zinc-700">Daily security code</label>
   <Input id="admin-otp" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} className="h-12 text-center text-xl font-bold tracking-[0.45em]" required/>
   <Button type="submit" disabled={!user||code.length!==6||busy} className="h-12 w-full bg-[#FF6A00] text-white hover:bg-[#E85F00]">{busy?<RefreshCcw className="h-4 w-4 animate-spin"/>:'Verify and continue'}</Button>
  </form>
  <p role="status" className="mt-4 text-center text-xs leading-5 text-zinc-600">{message}</p>
  <div className="mt-6 border-t border-zinc-100 pt-4 text-center"><p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400"><Mail className="h-3.5 w-3.5"/> Security verification by email</p><button type="button" onClick={async()=>{await user?.getIdToken().then(token=>fetch('/api/admin/otp/request',{method:'POST',headers:{Authorization:'Bearer '+token}}).then(async r=>{const d=await r.json();setMessage(d.message||d.error||'Check your email.');}));}} className="mt-3 block w-full text-xs font-semibold text-primary underline">Check resend status</button></div>
 </section></main>;
}
