import {beforeEach,describe,expect,it,vi}from'vitest';
import{NextRequest}from'next/server';
import{POST}from'./route';
const m=vi.hoisted(()=>({verify:vi.fn(),checkout:vi.fn()}));
vi.mock('firebase-admin/auth',()=>({getAuth:()=>({verifyIdToken:m.verify})}));
vi.mock('@/lib/firebase-admin',()=>({getAdminApp:()=>({}),getDbAdmin:()=>({})}));
vi.mock('@/lib/checkout-service',async original=>({...await original<typeof import('@/lib/checkout-service')>(),checkout:m.checkout}));
const request=(auth='Bearer token')=>new NextRequest('http://localhost/api/checkout',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({key:'key_abcdefghijklmnop',unit:'STORE'})});
beforeEach(()=>{vi.clearAllMocks();m.verify.mockResolvedValue({uid:'actor',email:'actor@example.com',email_verified:true});m.checkout.mockResolvedValue({receipt:{id:'sale'}});});
describe('checkout request boundary',()=>{
 it('rejects anonymous and revoked sessions before checkout',async()=>{expect((await POST(request(''))).status).toBe(401);m.verify.mockRejectedValue(new Error('revoked'));expect((await POST(request())).status).toBe(401);expect(m.checkout).not.toHaveBeenCalled();});
 it('passes only verified identity and checks revocation',async()=>{expect((await POST(request())).status).toBe(200);expect(m.verify).toHaveBeenCalledWith('token',true);expect(m.checkout.mock.calls[0][1]).toEqual({uid:'actor',email:'actor@example.com',email_verified:true});});
 it('never claims a transaction failed definitively after an unknown exception',async()=>{m.checkout.mockRejectedValue(new Error('sensitive database error'));const response=await POST(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({code:'CHECKOUT_UNCONFIRMED'});});
 it('processor check validates KES amount/reference/status independent of browser callback',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch');vi.stubEnv('PAYSTACK_SECRET_KEY','test-key');
  m.checkout.mockImplementation(async(_db,_identity,_body,verifyPayment)=>{
   fetcher.mockResolvedValueOnce({ok:true,json:async()=>({status:true,data:{status:'success',currency:'USD',amount:10000,reference:'ref'}})}as any);expect(await verifyPayment('ref',100)).toBe(false);
   fetcher.mockResolvedValueOnce({ok:true,json:async()=>({status:true,data:{status:'success',currency:'KES',amount:10000,reference:'ref'}})}as any);expect(await verifyPayment('ref',100)).toBe(true);return{receipt:{id:'sale'}};
  });await POST(request());fetcher.mockRestore();vi.unstubAllEnvs();
 });
});
