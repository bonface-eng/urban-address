import {NextRequest,NextResponse} from 'next/server';
import {getAuth} from 'firebase-admin/auth';
import {getAdminApp,getDbAdmin} from '@/lib/firebase-admin';
import {readDashboard} from '@/lib/dashboard-read';
import {StaffAccessError} from '@/lib/staff-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:NextRequest){
 const header=request.headers.get('authorization')||'';if(!header.startsWith('Bearer ')||!header.slice(7))return json({code:'DASHBOARD_AUTH_REQUIRED'},401);
 try{let id;try{id=await getAuth(getAdminApp()!).verifyIdToken(header.slice(7),true);}catch{return json({code:'DASHBOARD_AUTH_REQUIRED'},401);}
 return json(await readDashboard(getDbAdmin(),{uid:id.uid,email:id.email,email_verified:id.email_verified},request.nextUrl.searchParams));
 }catch(error){if(error instanceof StaffAccessError)return json({code:error.code},error.status);console.error('[DASHBOARD_SUMMARY] Read failed.');return json({code:'DASHBOARD_UNAVAILABLE'},503);}
}
