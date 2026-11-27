'use client';
import {useEffect,useState,useCallback} from 'react';
import {useUser} from '@/firebase';
import type {summarizeDashboard} from '@/lib/dashboard-summary';
import type {Order} from '@/lib/types';
export type DashboardSummary={stats:ReturnType<typeof summarizeDashboard>;backlog:{count:number;volume:number;items:unknown[]};recordCount:number};
export async function requestDashboard(user:{getIdToken:(refresh?:boolean)=>Promise<string>},period:string,details=false,signal?:AbortSignal){
 const token=await user.getIdToken(true);
 const response=await fetch('/api/dashboard-summary?'+new URLSearchParams({period,...(details?{details:'true'}:{})}),{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
 const data=await response.json();if(!response.ok)throw new Error(['DASHBOARD_AUTH_REQUIRED','STAFF_ACCESS_DENIED','DASHBOARD_INVALID'].includes(data.code)?data.code:'DASHBOARD_UNAVAILABLE');return data;
}
export function useDashboardSummary(period:string){
 const {user}=useUser();const[revision,setRevision]=useState(0);const[key,setKey]=useState('');const[data,setData]=useState<DashboardSummary|null>(null);const[error,setError]=useState<string|null>(null);const[loading,setLoading]=useState(true);
 const expected=`${user?.uid}:${period}:${revision}`;
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{if(!user)return;const controller=new AbortController();setData(null);setError(null);setLoading(true);setKey(expected);
 requestDashboard(user,period,false,controller.signal).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(()=>{if(!controller.signal.aborted)setError('DASHBOARD_UNAVAILABLE');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[user,period,revision,expected]);
 const details=useCallback(async()=>{if(!user)throw new Error('Sign in again.');const result=await requestDashboard(user,period,true);if(!Array.isArray(result.orders))throw new Error('Incomplete report response.');return result.orders as Order[];},[user,period]);
 if(!user)return{data:null,error:'DASHBOARD_AUTH_REQUIRED',loading:false,refresh,details};
 if(key!==expected)return{data:null,error:null,loading:true,refresh,details};
 return{data,error,loading,refresh,details};
}
