import { beforeEach,describe,expect,it,vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { checkout } from './checkout-service';
let db:Firestore;let rows:Map<string,any>;let auditFails:boolean;
const identity={uid:'cashier',email:'staff@example.com',email_verified:true};
const payload=(extra:Record<string,any>={})=>({key:'key_abcdefghijklmnop',unit:'STORE',method:'CASH',cashReceived:500,total:300,items:[{productId:'oil',quantity:2}],...extra});
const payment=vi.fn();
const run=(body=payload(),who=identity)=>checkout(db,who,body,payment);
beforeEach(()=>{
 rows=new Map([['users/cashier',{role:'CASHIER',assignedUnits:['STORE','LOUNGE','CARWASH'],displayName:'Cashier'}],['inventory/oil',{name:'Oil',price:150,unit:'STORE',stockLevel:10}]]);auditFails=false;payment.mockReset().mockResolvedValue(true);
 let queue=Promise.resolve();
 const ref=(path:string):any=>({path,id:path.split('/').pop(),doc:(id:string)=>ref(path+'/'+id),collection:(name:string)=>ref(path+'/'+name),get:async()=>snap(path)});
 const snap=(path:string)=>({exists:rows.has(path),ref:ref(path),get:(key:string)=>rows.get(path)?.[key],data:()=>rows.get(path)});
 db={collection:(name:string)=>ref(name),runTransaction:(callback:any)=>{
  const result=queue.then(async()=>{const writes:Array<()=>void>=[];const output=await callback({get:async(r:any)=>snap(r.path),set:(r:any,d:any,options?:any)=>{if(auditFails&&r.path.startsWith('audit_logs/'))throw new Error('audit unavailable');writes.push(()=>rows.set(r.path,options?.merge?{...rows.get(r.path),...d}:d));},update:(r:any,d:any)=>writes.push(()=>rows.set(r.path,{...rows.get(r.path),...d})),delete:(r:any)=>writes.push(()=>rows.delete(r.path))});writes.forEach(w=>w());return output;});queue=result.then(()=>{},()=>{});return result;
 }} as unknown as Firestore;
});
describe('transactional idempotent checkout',()=>{
 it('derives prices/actor, commits stock receipt audit and idempotency marker together',async()=>{
  const result=await run(payload({cashierId:'forged',items:[{productId:'oil',quantity:2,price:1}]}));
  expect(result.receipt).toMatchObject({total:300,cashierId:'cashier',status:'PAID',paymentVerification:'STAFF_RECORDED_CASH'});
  expect(result.receipt.items[0].price).toBe(150);expect(rows.get('inventory/oil').stockLevel).toBe(8);
  expect([...rows.keys()].filter(k=>k.startsWith('audit_logs/'))).toHaveLength(1);
 });
 it('replaying same operation never creates another sale or double deducts',async()=>{
  const a=await run();const b=await run();expect(b.replayed).toBe(true);expect(b.receipt.id).toBe(a.receipt.id);expect(rows.get('inventory/oil').stockLevel).toBe(8);
 });
 it('rejects a changed payload under the same key',async()=>{
  await run();await expect(run(payload({total:150,items:[{productId:'oil',quantity:1}]}))).rejects.toMatchObject({code:'CHECKOUT_KEY_REUSED'});expect(rows.get('inventory/oil').stockLevel).toBe(8);
 });
 it('rolls back stock and orders if audit cannot save',async()=>{
  auditFails=true;await expect(run()).rejects.toThrow();expect(rows.get('inventory/oil').stockLevel).toBe(10);expect([...rows.keys()].some(k=>k.startsWith('orders/'))).toBe(false);
 });
 it('concurrent checkouts cannot oversell stock',async()=>{
  rows.get('inventory/oil').stockLevel=3;
  const result=await Promise.allSettled([run(),run(payload({key:'other_abcdefghijklmnop'}))]);expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(rows.get('inventory/oil').stockLevel).toBe(1);
 });
 it.each(['CLIENT','KITCHEN','ATTENDANT','STOREKEEPER'])('rejects checkout for %s role',async role=>{
  rows.get('users/cashier').role=role;await expect(run()).rejects.toMatchObject({status:403});expect(rows.get('inventory/oil').stockLevel).toBe(10);
 });
 it('requires assigned department for non-management operators',async()=>{
  rows.get('users/cashier').assignedUnits=['LOUNGE'];await expect(run()).rejects.toMatchObject({code:'CHECKOUT_UNIT_DENIED'});
 });
 it('rejects disabled operators and spoofed root email',async()=>{
  rows.set('users/cashier',{role:'CLIENT',email:'bonfacewana3072@gmail.com'});await expect(run()).rejects.toMatchObject({code:'STAFF_ACCESS_DENIED'});
  rows.set('users/cashier',{role:'ADMIN',disabled:true});await expect(run()).rejects.toMatchObject({code:'STAFF_ACCESS_DENIED'});
 });
 it.each([0,-1,0.5,10001,'2'])('rejects invalid quantity %j',async quantity=>{
  await expect(run(payload({items:[{productId:'oil',quantity}]}))).rejects.toMatchObject({code:'CHECKOUT_INVALID'});
 });
 it('rejects changed prices and insufficient cash',async()=>{
  await expect(run(payload({total:1}))).rejects.toMatchObject({code:'CHECKOUT_PRICE_CHANGED'});
  await expect(run(payload({cashReceived:200}))).rejects.toMatchObject({code:'CHECKOUT_CASH_REQUIRED'});
 });
 it('requires active same-unit catalogue items and adequate stock',async()=>{
  rows.get('inventory/oil').archived=true;await expect(run()).rejects.toMatchObject({code:'CHECKOUT_CATALOGUE_CHANGED'});
  rows.get('inventory/oil').archived=false;rows.get('inventory/oil').stockLevel=1;await expect(run()).rejects.toMatchObject({code:'CHECKOUT_STOCK_CHANGED'});
 });
 it('aggregates duplicate product lines before stock deductions',async()=>{
  await run(payload({items:[{productId:'oil',quantity:1},{productId:'oil',quantity:1}]}));expect(rows.get('inventory/oil').stockLevel).toBe(8);
 });
 it('deletes only an owned pending held tab and settles its master order once',async()=>{
  rows.set('users/cashier/held_bills/held',{type:'STORE',cashierId:'cashier'});rows.set('orders/held',{status:'PENDING',cashierId:'cashier'});
  const result=await run(payload({heldId:'held'}));expect(result.receipt.id).toBe('held');expect(rows.has('users/cashier/held_bills/held')).toBe(false);expect(rows.get('orders/held').status).toBe('PAID');
  await expect(run(payload({heldId:'held',key:'different_abcdefghijklmnop'}))).rejects.toMatchObject({code:'CHECKOUT_HELD_DENIED'});
 });
 it('does not settle another operators held order',async()=>{
  rows.set('users/other/held_bills/held',{type:'STORE',cashierId:'other'});await expect(run(payload({heldId:'held'}))).rejects.toMatchObject({code:'CHECKOUT_HELD_DENIED'});
 });
 it('requires processor verification for automatic mobile and prevents payment reuse',async()=>{
  payment.mockResolvedValueOnce(false);await expect(run(payload({method:'MOBILE',reference:'processor_ref'}))).rejects.toMatchObject({code:'CHECKOUT_PAYMENT_UNVERIFIED'});
  const result=await run(payload({method:'MOBILE',reference:'processor_ref'}));expect(result.receipt.paymentVerification).toBe('PROCESSOR_VERIFIED');
  await expect(run(payload({method:'MOBILE',reference:'processor_ref',key:'different_abcdefghijklmnop'}))).rejects.toMatchObject({code:'CHECKOUT_PAYMENT_REUSED'});
 });
 it('labels manually recorded mobile payments without claiming processor verification',async()=>{
  const result=await run(payload({method:'MOBILE',manual:true,reference:'ABC12345'}));expect(result.receipt.paymentVerification).toBe('STAFF_RECORDED_MOBILE');expect(payment).not.toHaveBeenCalled();
 });
 it('creates a carwash job without deducting synthetic service stock',async()=>{
  rows.set('inventory/oil',{name:'Wash',price:150,unit:'CARWASH',stockLevel:0,commission:20});rows.set('users/attendant',{role:'ATTENDANT',displayName:'Worker'});
  const result=await run(payload({unit:'CARWASH',jobType:'VEHICLE',plateNumber:'KAA 123A',attendantId:'attendant'}));
  expect(result.receipt.attendantName).toBe('Worker');expect(rows.get('inventory/oil').stockLevel).toBe(0);
  const job=[...rows].find(([key])=>key.startsWith('carwash_jobs/'))![1];expect(job.commission).toBe(60);expect(job.status).toBe('QUEUED');
 });
 it('refuses legacy pending tabs already marked stock-synced for manual review',async()=>{
  rows.set('users/cashier/held_bills/held',{type:'STORE',cashierId:'cashier',inventorySynced:true});rows.set('orders/held',{status:'PENDING',cashierId:'cashier'});
  await expect(run(payload({heldId:'held'}))).rejects.toMatchObject({code:'CHECKOUT_HELD_REVIEW_REQUIRED'});expect(rows.get('inventory/oil').stockLevel).toBe(10);
 });

});
