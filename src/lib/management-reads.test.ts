import { beforeEach,describe,expect,it,vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { managementRead } from './management-reads';
vi.mock('firebase-admin/firestore',()=>({FieldPath:{documentId:()=>'__name__'}}));
let profile:any;let db:Firestore;let docs:any[];let filters:any[];
const identity={uid:'staff',email:'staff@example.com',email_verified:true};
const run=(resource:string,actor=identity)=>managementRead(db,actor,new URLSearchParams({resource}));
beforeEach(()=>{
 profile={role:'CASHIER'};docs=[];filters=[];
 const ref=(path:string):any=>({doc:(id:string)=>ref(path+'/'+id),get:async()=>path==='users/staff'?{exists:!!profile,get:(k:string)=>profile?.[k],data:()=>profile}:path.startsWith('admins/')?{exists:false}:{docs:docs.map((data,i)=>({id:String(i),data:()=>data})),size:docs.length},where:(...args:any[])=>{filters.push(args);return ref(path);},orderBy:()=>ref(path),limit:()=>ref(path),startAfter:()=>ref(path)});
 db={collection:(path:string)=>ref(path)}as unknown as Firestore;
});
describe('role scoped management snapshots',()=>{
 it.each(['reports','history','directory','audit'])('denies non-management %s',async resource=>{await expect(run(resource)).rejects.toMatchObject({code:'MANAGEMENT_REQUIRED',status:403});});
 it('limits operator history to their authenticated cashier ID',async()=>{await run('own-orders');expect(filters).toContainEqual(['cashierId','==','staff']);});
 it('provides full directory fields only for management, without credentials',async()=>{
  profile={role:'MANAGER'};docs=[{displayName:'Worker',role:'ATTENDANT',baseSalary:20000,mpesaNumber:'0700000000',pin:'1234',masterKey:'secret',password:'secret',pinHash:'hash',assignedUnits:['CARWASH']}];
  const result=await run('directory');expect(result.records[0]).toMatchObject({displayName:'Worker',baseSalary:20000});expect(JSON.stringify(result)).not.toMatch(/pin|masterKey|password|secret|hash/);
 });
 it('returns only basic attendant identity to operators',async()=>{
  docs=[{displayName:'Worker',role:'ATTENDANT',baseSalary:20000,mpesaNumber:'0700000000',pin:'1234'}];const result=await run('attendants');
  expect(result.records[0]).toMatchObject({displayName:'Worker'});expect(result.records[0]).not.toHaveProperty('baseSalary');expect(result.records[0]).not.toHaveProperty('mpesaNumber');expect(filters).toContainEqual(['role','==','ATTENDANT']);
 });
 it('recognizes verified existing root admin without promoting profile email spoof',async()=>{
  profile={role:'CLIENT',email:'bonfacewana3072@gmail.com'};await expect(run('reports')).rejects.toMatchObject({status:403});
  expect((await run('reports',{...identity,email:'bonfacewana3072@gmail.com'})).records).toEqual([]);
 });
 it('denies inactive accounts even for manager directory reads',async()=>{profile={role:'ADMIN',active:false};await expect(run('directory')).rejects.toMatchObject({status:403});});
 it('does not accept arbitrary collection paths or UID overrides',async()=>{
  await expect(run('admins')).rejects.toMatchObject({code:'MANAGEMENT_INVALID'});
  await expect(managementRead(db,identity,new URLSearchParams('resource=own-orders&uid=other'))).rejects.toMatchObject({code:'MANAGEMENT_INVALID'});
 });
 it('does not return arbitrary audit payloads or secret request fields',async()=>{
  profile={role:'ADMIN'};docs=[{action:'UPDATE',details:'Changed stock',requestResourceData:{password:'secret'},secret:'private'}];const result=await run('audit');expect(result.records[0]).toMatchObject({action:'UPDATE',details:'Changed stock'});expect(JSON.stringify(result)).not.toMatch(/requestResourceData|password|private/);
 });
});
