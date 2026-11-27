import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaServer } from '@/lib/recaptcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : null;
  const action = typeof body?.action === 'string' ? body.action : undefined;
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const remoteIp = (forwardedFor.split(',')[0] || request.headers.get('x-real-ip') || '').trim();

  const result = await verifyRecaptchaServer(token, action, remoteIp);
  return NextResponse.json(result, { status: 200 });
}
