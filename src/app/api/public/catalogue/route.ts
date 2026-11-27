import { NextRequest, NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_UNITS = new Set(['LOUNGE', 'STORE', 'CARWASH']);
const MAX_PAGE_SIZE = 96;

function numberOr(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicProduct(id: string, data: Record<string, any>) {
  const stock = numberOr(data.stockLevel, 0);
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Unnamed product',
    category: typeof data.category === 'string' ? data.category : 'Other',
    price: Math.max(0, numberOr(data.price, 0)),
    // Public clients need availability, not the exact stock count.
    stockLevel: stock > 0 ? 1 : 0,
    unit: String(data.unit || '').toUpperCase(),
    image: typeof data.image === 'string' ? data.image : '',
    size: numberOr(data.size, 0) || undefined,
    sizeUnit: typeof data.sizeUnit === 'string' ? data.sizeUnit : undefined,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const unit = (params.get('unit') || '').toUpperCase();
  const productId = params.get('productId');
  if (productId && productId.length > 150) {
    return NextResponse.json({ error: 'Invalid product reference.' }, { status: 400 });
  }
  if (!productId && !PUBLIC_UNITS.has(unit)) {
    return NextResponse.json({ error: 'A supported catalogue unit is required.' }, { status: 400 });
  }

  try {
    const db = getDbAdmin();
    if (productId) {
      const snapshot = await db.collection('inventory').doc(productId).get();
      if (!snapshot.exists) return NextResponse.json({ product: null }, { headers: { 'Cache-Control': 'no-store' } });
      const data = snapshot.data() || {};
      const productUnit = String(data.unit || '').toUpperCase();
      if (!PUBLIC_UNITS.has(productUnit) || data.archived === true) {
        return NextResponse.json({ product: null }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.json({ product: publicProduct(snapshot.id, data) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const page = Math.max(1, Math.floor(numberOr(params.get('page'), 1)));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(numberOr(params.get('pageSize'), 24))));
    const minPrice = params.has('minPrice') ? Math.max(0, numberOr(params.get('minPrice'), 0)) : 0;
    const maxPrice = params.has('maxPrice') ? Math.max(0, numberOr(params.get('maxPrice'), Number.MAX_SAFE_INTEGER)) : Number.MAX_SAFE_INTEGER;
    const category = (params.get('category') || '').trim();
    const search = (params.get('search') || '').trim().toLocaleLowerCase().slice(0, 100);
    const sort = params.get('sort') || 'name';

    // Read only the requested business unit. Search/category/price filtering is applied
    // before pagination so every page represents the complete matching catalogue.
    const snapshot = await db.collection('inventory')
      .where('unit', 'in', [unit, unit.toLowerCase()])
      .get();

    let products = snapshot.docs
      .filter(doc => doc.data().archived !== true)
      .map(doc => publicProduct(doc.id, doc.data()))
      .filter(product => product.unit === unit)
      .filter(product => !category || category === 'All' || product.category === category)
      .filter(product => product.price >= minPrice && product.price <= maxPrice)
      .filter(product => !search || product.name.toLocaleLowerCase().includes(search) || product.category.toLocaleLowerCase().includes(search));

    products.sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price || a.name.localeCompare(b.name);
      if (sort === 'price-desc') return b.price - a.price || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });

    const total = products.length;
    const categories = Array.from(new Set(
      snapshot.docs
        .filter(doc => doc.data().archived !== true && String(doc.data().unit || '').toUpperCase() === unit)
        .map(doc => typeof doc.data().category === 'string' ? doc.data().category : '')
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
    const start = (page - 1) * pageSize;
    products = products.slice(start, start + pageSize);

    return NextResponse.json(
      { products, total, page, pageSize, totalPages: Math.ceil(total / pageSize), categories },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[PUBLIC_CATALOGUE_API_FAILED]', error);
    return NextResponse.json(
      { error: 'The product catalogue is temporarily unavailable. Please try again shortly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
