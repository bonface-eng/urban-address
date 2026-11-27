import { reportDateMillis } from './report-date';
import { FieldPath } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { staffAccess,StaffAccessError,type StaffIdentity } from './staff-access';
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
function project(data:Record<string,any>,keys:string[]) {
  const result:Record<string,unknown>={};
  for(const key of keys) if(['string','number','boolean'].includes(typeof data[key])||data[key]===null) result[key]=data[key];
  return result;
}
const orderFields=['type','jobType','status','prepStatus','total','discount','tip','tax','paymentMethod','paymentRef','paymentVerification','cashierId','cashierName','terminalId','registerSessionId','customerId','customerName','timestamp','servedAt','plateNumber','vehicleMake','vehicleModel','vehicleColor','tableNumber','attendantId','attendantName','carpetDimensions','inventorySynced'];
export async function managementRead(db:Firestore,identity:StaffIdentity,params:URLSearchParams) {
  const resource=params.get('resource')||'';
  const resources:Record<string,string>={reports:'orders',history:'orders','own-orders':'orders',directory:'users',attendants:'users',audit:'audit_logs',jobs:'carwash_jobs',terminals:'pos_terminals'};
  if(!resources[resource]||[...params.keys()].some(k=>!['resource','cursor'].includes(k))) throw new StaffAccessError('MANAGEMENT_INVALID',400);
  const access=await staffAccess(db,identity);
  if(['reports','history','directory','audit'].includes(resource)&&!access.manager) throw new StaffAccessError('MANAGEMENT_REQUIRED',403);
  if(resource==='own-orders'&&!access.manager&&access.role!=='CASHIER') throw new StaffAccessError('MANAGEMENT_REQUIRED',403);
  const cursor=params.get('cursor');if(cursor&&(cursor.includes('/')||cursor.length>1500))throw new StaffAccessError('MANAGEMENT_INVALID',400);
  let query:any=db.collection(resources[resource]);
  if(resource==='own-orders')query=query.where('cashierId','==',identity.uid);
  if(resource==='attendants')query=query.where('role','==','ATTENDANT');
  query=query.orderBy(FieldPath.documentId()).limit(200);if(cursor)query=query.startAfter(cursor);
  const snap=await query.get();
  const records=snap.docs.map((doc:any)=>{
    const data={...doc.data()};
    for (const field of ['timestamp','createdAt','servedAt','lastActive']) {
      const time=reportDateMillis(data[field]);
      if(time !== null) data[field]=time;
      else delete data[field];
    }
    if(resource==='directory'||resource==='attendants') {
      const safe=project(data,['displayName','email','phoneNumber','photoURL','role','createdAt']);
      if(resource==='directory') Object.assign(safe,project(data,['baseSalary','mpesaNumber','accountType','disabled','active','status']),{assignedUnits:Array.isArray(data.assignedUnits)?data.assignedUnits.filter((u:unknown)=>['STORE','LOUNGE','CARWASH'].includes(String(u))):[]});
      return {...safe,uid:doc.id,id:doc.id};
    }
    if(['reports','history','own-orders'].includes(resource))return {id:doc.id,...project(data,orderFields),items:Array.isArray(data.items)?data.items.map((item:any)=>({...project(item||{},['productId','name','category','status','notes']),price:number(item?.price),quantity:number(item?.quantity),commission:number(item?.commission)})):[]};
    if(resource==='audit')return {id:doc.id,...project(data,['action','userId','orderId','productId','terminalId','timestamp','severity','unit','total','stockBefore','stockAfter']),details:typeof data.details==='string'?data.details.slice(0,2000):''};
    if(resource==='terminals')return {id:doc.id,...project(data,['name','unit','status','currentCashierId','currentRegisterSessionId','lastActive'])};
    return {id:doc.id,...project(data,['orderId','jobType','plateNumber','vehicleMake','vehicleModel','vehicleColor','service','status','attendantId','attendantName','price','tip','commission','timestamp','customerId','valetService','address','carpetDimensions'])};
  });
  return {records,nextCursor:snap.size===200?snap.docs[snap.docs.length-1].id:null};
}
