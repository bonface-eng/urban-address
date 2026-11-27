'use client';
import React,{useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useUser} from '@/lib/data';
import {RefreshCcw} from 'lucide-react';
export function AdminDailyOtpGuard({children}:{children:React.ReactNode}){
 const {user,loading}=useUser();const router=useRouter();const pathname=usePathname();const [allowed,setAllowed]=useState(false);
 useEffect(()=>{
  let active=true;
  const check=async()=>{
   if(loading)return;
   if(!user){router.replace('/login?redirect='+encodeURIComponent(pathname||'/admin'));return;}
   try{
    const result=await user.getIdTokenResult(true);
    const today=new Date().toISOString().slice(0,10);
    if(result.claims.adminOtpVerifiedDate===today){if(active)setAllowed(true);}
    else router.replace('/admin-otp');
   }catch{router.replace('/admin-otp');}
  };
  void check();return()=>{active=false;};
 },[user,loading,router,pathname]);
 if(!allowed)return <div className="min-h-[50vh] flex items-center justify-center"><RefreshCcw className="h-6 w-6 animate-spin text-primary"/></div>;
 return <>{children}</>;
}
