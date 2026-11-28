import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/admin-auth';
import { CAR_WASH_CATEGORIES } from '@/data/carWashServices';
import {
  mapCarWashServiceToRow,
  mapRowToCarWashService,
  slugifyServiceId,
  validateCarWashServiceInput,
} from '@/lib/carwash-services';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const caller = await authorizeAdminRequest(req);
  if (!caller) {
    return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('carwash_services')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      services: (data || []).map(mapRowToCarWashService),
      categories: CAR_WASH_CATEGORIES,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load carwash services.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const caller = await authorizeAdminRequest(req);
  if (!caller) {
    return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const validation = validateCarWashServiceInput(body);
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        { error: validation.errors[0] || 'Validation failed.', errors: validation.errors },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const baseId = validation.normalized.id || slugifyServiceId(validation.normalized.name, validation.normalized.category);
    let candidateId = baseId;

    const { data: existing } = await supabase
      .from('carwash_services')
      .select('id')
      .eq('id', candidateId)
      .maybeSingle();

    if (existing) {
      candidateId = `${baseId}-${Date.now().toString(36).slice(-4)}`;
    }

    const row = mapCarWashServiceToRow({ ...validation.normalized, id: candidateId });
    const { data, error } = await supabase
      .from('carwash_services')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: mapRowToCarWashService(data) }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create service.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const caller = await authorizeAdminRequest(req);
  if (!caller) {
    return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    const reorder = Array.isArray(body?.reorder) ? body.reorder : null;
    if (!reorder || reorder.length === 0) {
      return NextResponse.json({ error: 'Reorder payload is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    for (const entry of reorder) {
      if (!entry?.id || !Number.isFinite(Number(entry.sortOrder))) {
        return NextResponse.json({ error: 'Invalid reorder item.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('carwash_services')
        .update({ sort_order: Number(entry.sortOrder), updated_at: now })
        .eq('id', String(entry.id));
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reorder services.' },
      { status: 500 }
    );
  }
}
