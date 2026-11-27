import{beforeEach,describe,expect,it,vi}from'vitest';import{NextRequest}from'next/server';import{GET}from'./route';
const m=vi.hoisted(()=>({verify:vi.fn(),read:vi.fn()}));
vi.mock('firebase-admin/auth',()=>({getAuth:()=>({verifyIdToken:m.verify})}));vi.mock('@/lib/firebase-admin',()=>({getAdminApp:()=>({}),getDbAdmin:()=>({})}));vi.mock('@/lib/management-reads',()=>({managementRead:m.read}));
const request=(auth='Bearer token')=>new NextRequest('http://localhost/api/management-reads?resource=directory',{headers:{Authorization:auth}});
beforeEach(()=>{vi.clearAllMocks();m.verify.mockResolvedValue({uid:'actor'});m.read.mockResolvedValue({records:[],nextCursor:null});});
describe('management request boundary',()=>{
 it('requires valid revocation-checked sign-in',async()=>{expect((await GET(request(''))).status).toBe(401);m.verify.mockRejectedValue(new Error('revoked'));expect((await GET(request())).status).toBe(401);expect(m.read).not.toHaveBeenCalled();});
 it('uses verified identity and private no-store responses',async()=>{const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('no-store');expect(m.verify).toHaveBeenCalledWith('token',true);expect(m.read.mock.calls[0][1].uid).toBe('actor');});
});
