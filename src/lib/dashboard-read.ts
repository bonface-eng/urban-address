import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { staffAccess,StaffAccessError,type StaffIdentity } from './staff-access';
import { reportDateMillis } from './report-date';
import { summarizeDashboard } from './dashboard-summary';
import type { Order } from './types';
export function dashboardRange(period:string,now=Date.now()) {
 const day=86400000,offset=3*3600000;
 const today=Math.floor((now+offset)/day)*day-offset;
 if(!['TODAY','YESTERDAY','LAST_7_DAYS','LAST_30_DAYS','ALL_TIME'].includes(period))throw new StaffAccessError('DASHBOARD_INVALID',400);
 return {start:period==='ALL_TIME'?0:period==='YESTERDAY'?today-day:period==='LAST_7_DAYS'?today-7*day:period==='LAST_30_DAYS'?today-30*day:today,end:period==='YESTERDAY'?today:now+1};
}
function orderRecord(doc:any):Order {
 const d=doc.data();const result:Record<string,any>={id:doc.id,timestamp:reportDateMillis(d.timestamp)};
 for(const k of ['type','status','total','cashierId','cashierName','tableNumber','plateNumber']) if(['string','number'].includes(typeof d[k]))result[k]=d[k];
 result.total=typeof d.total==='number'&&Number.isFinite(d.total)?d.total:0;
 result.items=Array.isArray(d.items)?d.items.map((v:any)=>({productId:typeof v?.productId==='string'?v.productId:'',name:typeof v?.name==='string'?v.name:'',category:typeof v?.category==='string'?v.category:'',price:typeof v?.price==='number'&&Number.isFinite(v.price)?v.price:0,quantity:typeof v?.quantity==='number'&&Number.isFinite(v.quantity)?v.quantity:0})):[];
 return result as Order;
}
export async function readDashboard(db:Firestore,identity:StaffIdentity,params:URLSearchParams,now=Date.now()) {
 if([...params.keys()].some(k=>!['period','details'].includes(k)))throw new StaffAccessError('DASHBOARD_INVALID',400);
 const period=params.get('period')||'TODAY';const range=dashboardRange(period,now);
 const access=await staffAccess(db,identity);
 const global=access.manager;
 let snapshots:any[];
 if(!global) {
  // A single equality query keeps personal reads UID-scoped without requiring new indexes.
  snapshots=[await db.collection('orders').where('cashierId','==',identity.uid).get()];
 } else if(period==='ALL_TIME') snapshots=[await db.collection('orders').get()];
 else {
  // Firestore compares timestamps and numbers as distinct types. Query both legacy representations.
  snapshots=await Promise.all([
   db.collection('orders').where('timestamp','>=',range.start).where('timestamp','<',range.end).get(),
   db.collection('orders').where('timestamp','>=',Timestamp.fromMillis(range.start)).where('timestamp','<',Timestamp.fromMillis(range.end)).get(),
  ]);
 }
 const records=new Map<string,Order>();for(const snap of snapshots)for(const doc of snap.docs)records.set(doc.id,orderRecord(doc));
 const paid=[...records.values()].filter(o=>o.status==='PAID'&&typeof o.timestamp==='number'&&o.timestamp>=range.start&&o.timestamp<range.end&&(global||o.cashierId===identity.uid));
 const stats=summarizeDashboard(paid,period,!global);
 if(params.get('details')==='true')return {orders:paid.sort((a,b)=>b.timestamp-a.timestamp),period,range};
 let backlog={count:0,volume:0,items:[] as unknown[]};
 if(global){const pending=await db.collection('orders').where('status','==','PENDING').get();backlog={count:pending.size,volume:pending.docs.reduce((sum,doc)=>{const value=doc.get('total');return sum+(typeof value==='number'&&Number.isFinite(value)?value:0);},0),items:[]};}
 return {stats,backlog,period,range,recordCount:paid.length};
}
