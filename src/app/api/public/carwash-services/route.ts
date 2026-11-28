import { NextResponse } from 'next/server';
import { CAR_WASH_CATEGORIES, CAR_WASH_SERVICES } from '@/data/carWashServices';
import { mapRowToCarWashService } from '@/lib/carwash-services';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('carwash_services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          services: CAR_WASH_SERVICES.filter((s) => s.isActive),
          categories: CAR_WASH_CATEGORIES,
          source: 'fallback',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const services = rows.length > 0
      ? rows.map(mapRowToCarWashService)
      : CAR_WASH_SERVICES.filter((s) => s.isActive);

    return NextResponse.json(
      {
        services,
        categories: CAR_WASH_CATEGORIES,
        source: rows.length > 0 ? 'db' : 'fallback',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      {
        services: CAR_WASH_SERVICES.filter((s) => s.isActive),
        categories: CAR_WASH_CATEGORIES,
        source: 'fallback',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
