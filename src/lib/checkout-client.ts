import type { User } from 'firebase/auth';
import type { Order } from './types';
const inFlight=new Set<string>();
/** Retain the same idempotency key after unknown results, including page reloads. */
export async function submitCheckout(user:User|null,payload:Record<string,unknown>):Promise<Order> {
  if(!user) throw new Error('Sign in again. Ref: CHECKOUT_AUTH_REQUIRED');
  const slot=`uax_checkout_${user.uid}_${payload.unit}`;
  if(inFlight.has(slot)) throw new Error('Checkout is already being confirmed. Please wait.');
  inFlight.add(slot);
  try {
    const fingerprint=JSON.stringify(payload);
    let saved:{key:string;fingerprint:string}|null=null;
    try {saved=JSON.parse(sessionStorage.getItem(slot)||'null');} catch {}
    if(saved && saved.fingerprint!==fingerprint) throw new Error('A previous checkout is unconfirmed. Restore the original cart/payment and retry, or check Sales History before starting a different sale. Ref: CHECKOUT_PENDING_CONFIRMATION');
    const key=saved?.key||crypto.randomUUID();
    sessionStorage.setItem(slot,JSON.stringify({key,fingerprint}));
    const token=await user.getIdToken(true);
    let response;
    try {response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...payload,key}),signal:AbortSignal.timeout(30000),cache:'no-store'});} catch {throw new Error('Sale result is unconfirmed. Keep the cart unchanged and retry to confirm the same transaction; do not start another sale. Ref: CHECKOUT_UNCONFIRMED');}
    let data;try {data=await response.json();} catch {throw new Error('Sale result is unconfirmed. Retry the unchanged checkout. Ref: CHECKOUT_UNCONFIRMED');}
    if(!response.ok || !data.receipt?.id) {
      const code=typeof data.code==='string' && /^(CHECKOUT|STAFF)_[A-Z_]+$/.test(data.code)?data.code:'CHECKOUT_UNCONFIRMED';
      const messages:Record<string,string>={CHECKOUT_HELD_REVIEW_REQUIRED:'This legacy tab may already have deducted stock. Ask a manager to reconcile it before checkout.',CHECKOUT_PRICE_CHANGED:'Catalogue prices changed. Refresh products and review your cart.',CHECKOUT_STOCK_CHANGED:'Stock is no longer sufficient. Refresh products and review quantities.',CHECKOUT_CASH_REQUIRED:'Enter enough cash received.',CHECKOUT_PAYMENT_UNVERIFIED:'The processor payment could not be verified for this amount/currency.',CHECKOUT_PAYMENT_REUSED:'That payment reference is already recorded. Check Sales History.',CHECKOUT_UNIT_DENIED:'Your account is not assigned to this department.',CHECKOUT_ROLE_DENIED:'Your role cannot finalize sales.',CHECKOUT_AUTH_REQUIRED:'Sign in again.'};
      // Only explicit pre-commit rejections allow a corrected cart/new key.
      const definitive=['CHECKOUT_PRICE_CHANGED','CHECKOUT_STOCK_CHANGED','CHECKOUT_CASH_REQUIRED','CHECKOUT_CATALOGUE_CHANGED','CHECKOUT_ATTENDANT_INVALID','CHECKOUT_HELD_DENIED','CHECKOUT_ALREADY_SETTLED','CHECKOUT_HELD_REVIEW_REQUIRED','CHECKOUT_PAYMENT_REUSED'];
      if(response.status>=400 && response.status<500 && definitive.includes(code)) sessionStorage.removeItem(slot);
      throw new Error(`${messages[code]||'Checkout could not be confirmed. Review the sale status before changing the cart.'} Ref: ${code}`);
    }
    sessionStorage.removeItem(slot);
    return data.receipt as Order;
  } finally {inFlight.delete(slot);}
}
