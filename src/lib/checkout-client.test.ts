import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import type { User } from 'firebase/auth';
import { submitCheckout } from './checkout-client';
const request=vi.fn();const token=vi.fn();const user={uid:'cashier',getIdToken:token}as unknown as User;
const payload={unit:'STORE',items:[{productId:'oil',quantity:1}],total:150,method:'CASH',cashReceived:200};
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();token.mockResolvedValue('token');vi.stubGlobal('fetch',request);});
afterEach(()=>vi.unstubAllGlobals());
describe('retry-safe checkout client',()=>{
 it('retains the same operation key after an unknown network result',async()=>{
  request.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ok:true,json:async()=>({receipt:{id:'saved'}})});
  await expect(submitCheckout(user,payload)).rejects.toThrow('CHECKOUT_UNCONFIRMED');
  expect((await submitCheckout(user,payload)).id).toBe('saved');
  expect(JSON.parse(request.mock.calls[0][1].body).key).toBe(JSON.parse(request.mock.calls[1][1].body).key);
  expect(sessionStorage.getItem('uax_checkout_cashier_STORE')).toBeNull();
 });
 it('prevents an altered cart being sent while the prior result is unknown',async()=>{
  request.mockRejectedValue(new Error('network'));await expect(submitCheckout(user,payload)).rejects.toThrow();
  await expect(submitCheckout(user,{...payload,total:300})).rejects.toThrow('CHECKOUT_PENDING_CONFIRMATION');expect(request).toHaveBeenCalledTimes(1);
 });
 it('allows corrected input after a definitive rejection',async()=>{
  request.mockResolvedValue({ok:false,status:409,json:async()=>({code:'CHECKOUT_STOCK_CHANGED'})});
  await expect(submitCheckout(user,payload)).rejects.toThrow('CHECKOUT_STOCK_CHANGED');expect(sessionStorage.getItem('uax_checkout_cashier_STORE')).toBeNull();
 });
 it('does not request anything without a signed-in identity',async()=>{await expect(submitCheckout(null,payload)).rejects.toThrow('CHECKOUT_AUTH_REQUIRED');expect(request).not.toHaveBeenCalled();});
 it('does not retry automatically on an upstream 503',async()=>{
  request.mockResolvedValue({ok:false,status:503,json:async()=>({code:'CHECKOUT_UNCONFIRMED'})});await expect(submitCheckout(user,payload)).rejects.toThrow('CHECKOUT_UNCONFIRMED');expect(request).toHaveBeenCalledTimes(1);expect(sessionStorage.getItem('uax_checkout_cashier_STORE')).not.toBeNull();
 });
 it('retains the original key if reauthentication is required after an unknown result',async()=>{
  request.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ok:false,status:401,json:async()=>({code:'CHECKOUT_AUTH_REQUIRED'})}).mockResolvedValueOnce({ok:true,json:async()=>({receipt:{id:'saved'}})});
  await expect(submitCheckout(user,payload)).rejects.toThrow('CHECKOUT_UNCONFIRMED');
  await expect(submitCheckout(user,payload)).rejects.toThrow('CHECKOUT_AUTH_REQUIRED');
  await submitCheckout(user,payload);
  const keys=request.mock.calls.map(([,options])=>JSON.parse(options.body).key);expect(new Set(keys).size).toBe(1);
 });

});
