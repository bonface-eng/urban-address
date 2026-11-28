import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/lib/admin-auth';
import {
  mapCarWashServiceToRow,
  mapRowToCarWashService,
  validateCarWashServiceInput,
} from '@/lib/carwash-services';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const caller = await authorizeAdminRequest(req);
  if (!caller) {
    return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Service ID is required.' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    // Allow quick active/inactive toggle or sortOrder update without full payload
    if (
      Object.keys(body).every((k) => k === 'isActive' || k === 'sortOrder') &&
      (typeof body.isActive === 'boolean' || Number.isFinite(Number(body.sortOrder)))
    ) {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (typeof body.isActive === 'boolean') updates.is_active = body.isActive;
      if (Number.isFinite(Number(body.sortOrder))) updates.sort_order = Number(body.sortOrder);

      const { data, error } = await supabase
        .from('carwash_services')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ service: mapRowToCarWashService(data) });
    }

    const validation = validateCarWashServiceInput({ ...body, id });
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        { error: validation.errors[0] || 'Validation failed.', errors: validation.errors },
        { status: 400 }
      );
    }

    const row = mapCarWashServiceToRow({ ...validation.normalized, id });
    const { data, error } = await supabase
      .from('carwash_services')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ service: mapRowToCarWashService(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update service.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const caller = await authorizeAdminRequest(req);
  if (!caller) {
    return NextResponse.json({ error: 'Admin privileges required.' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Service ID is required.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    // Check if this service appears in any past sales (orders.items JSONB)
    const { data: matchingOrders, error: orderCheckError } = await supabase
      .from('orders')
      .select('id')
      .eq('type', 'CARWASH')
      .contains('items', [{ productId: id }])
      .limit(1);

    if (!orderCheckError && Array.isArray(matchingOrders) && matchingOrders.length > 0) {
      const { data: deactivated, error: deactivateError } = await supabase
        .from('carwash_services')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (deactivateError) {
        return NextResponse.json({ error: deactivateError.message }, { status: 400 });
      }

      return NextResponse.json({
        deactivated: true,
        service: mapRowToCarWashService(deactivated),
        message: 'Service appears in past sales and was deactivated instead of deleted.',
      });
    }

    const { error } = await supabase
      .from('carwash_services')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete service.' },
      { status: 500 }
    );
  }
}
