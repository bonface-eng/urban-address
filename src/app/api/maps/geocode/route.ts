import { NextRequest, NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');
  const isReverse = lat !== null || lon !== null;
  if (isReverse && (lat === null || lon === null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180)) {
    return NextResponse.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 });
  }
  if (!isReverse && (!q || q.length < 2 || q.length > 200)) {
    return NextResponse.json({ error: 'Enter a location between 2 and 200 characters.' }, { status: 400 });
  }

  const cacheKey = isReverse
    ? `reverse_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`
    : `search_${Buffer.from(q!.toLowerCase()).toString('base64url').slice(0, 120)}`;
  const cacheRef = getDbAdmin().collection('maps_geocode_cache').doc(cacheKey);
  try {
    const cached = await cacheRef.get();
    if (cached.exists && Number(cached.data()?.expiresAt || 0) > Date.now()) {
      return NextResponse.json(cached.data()?.result, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }
  } catch { /* Cache is an optimization; geocoding can still proceed. */ }

  const url = isReverse
    ? `${NOMINATIM}/reverse?format=jsonv2&lat=${encodeURIComponent(lat!)}&lon=${encodeURIComponent(lon!)}&zoom=16&addressdetails=1`
    : `${NOMINATIM}/search?format=jsonv2&limit=5&addressdetails=1&countrycodes=ke&q=${encodeURIComponent(q! + ', Kenya')}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'UrbanAddressPOS/1.0 (https://www.urbanautoexpress.com)', 'Accept-Language': 'en' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return NextResponse.json({ error: 'The maps service is temporarily unavailable.' }, { status: 502 });
    const result = await response.json();
    await cacheRef.set({ result, expiresAt: Date.now() + (isReverse ? 24 : 12) * 60 * 60 * 1000, updatedAt: Date.now() }).catch(() => undefined);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return NextResponse.json({ error: 'Unable to reach the maps service. Please try again.' }, { status: 503 });
  }
}
