import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { getDbAdmin } from '@/lib/db/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_UNITS = new Set(['LOUNGE', 'STORE', 'CARWASH']);
const MAX_PAGE_SIZE = 96;
const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
};

function numberOr(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicProduct(id: string, data: Record<string, any>) {
  const stock = data.stockLevel !== null && data.stockLevel !== undefined ? Number(data.stockLevel) : null;
  const rawPrice = data.price !== null && data.price !== undefined ? Number(data.price) : null;
  const trackStock = data.trackStock !== false && data.track_stock !== false;
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Unnamed product',
    category: typeof data.category === 'string' ? data.category : 'Other',
    subcategory: typeof data.subcategory === 'string' ? data.subcategory : undefined,
    price: rawPrice !== null && !isNaN(rawPrice) ? Math.max(0, rawPrice) : null,
    // Public clients need availability, not the exact stock count.
    stockLevel: stock !== null && !isNaN(stock) ? (stock > 0 ? 1 : 0) : null,
    trackStock,
    unit: String(data.unit || '').toUpperCase(),
    image: typeof data.imageUrl === 'string' && data.imageUrl ? data.imageUrl : (typeof data.image === 'string' ? data.image : ''),
    size: data.size || undefined,
    sizeUnit: typeof data.sizeUnit === 'string' ? data.sizeUnit : undefined,
  };
}

/**
 * Cache the Firestore read by business unit, not by search/filter/page.
 * This means homepage, category filters and pagination reuse the same
 * short-lived inventory snapshot instead of repeatedly scanning Firestore.
 */
const getCachedUnitCatalogue = unstable_cache(
  async (unit: string) => {
    const snapshot = await getDbAdmin()
      .collection('inventory')
      .where('unit', 'in', [unit, unit.toLowerCase()])
      .get();

    const activeDocs = snapshot.docs.filter(doc => doc.data().archived !== true);
    const products = activeDocs
      .map(doc => publicProduct(doc.id, doc.data()))
      .filter(product => product.unit === unit);

    const categories = Array.from(new Set(
      products.map(product => product.category).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    return { products, categories };
  },
  ['public-catalogue-v3'],
  { revalidate: 30 }
);

/** Product detail pages share a short-lived cache with catalogue requests. */
const getCachedPublicProduct = unstable_cache(
  async (productId: string) => {
    const snapshot = await getDbAdmin().collection('inventory').doc(productId).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() || {};
    const productUnit = String(data.unit || '').toUpperCase();
    if (!PUBLIC_UNITS.has(productUnit) || data.archived === true) return null;

    return publicProduct(snapshot.id, data);
  },
  ['public-product-v2'],
  { revalidate: 30 }
);

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
    if (productId) {
      const product = await getCachedPublicProduct(productId);
      return NextResponse.json({ product }, { headers: PUBLIC_CACHE_HEADERS });
    }

    const page = Math.max(1, Math.floor(numberOr(params.get('page'), 1)));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(numberOr(params.get('pageSize'), 24))));
    const minPrice = params.has('minPrice') ? Math.max(0, numberOr(params.get('minPrice'), 0)) : 0;
    const maxPrice = params.has('maxPrice') ? Math.max(0, numberOr(params.get('maxPrice'), Number.MAX_SAFE_INTEGER)) : Number.MAX_SAFE_INTEGER;
    const category = (params.get('category') || '').trim();
    const search = (params.get('search') || '').trim().toLocaleLowerCase().slice(0, 100);
    const sort = params.get('sort') || 'name';

    const cached = await getCachedUnitCatalogue(unit);
    let products = cached.products
      .filter(product => !category || category === 'All' || product.category === category)
      .filter(product => {
        if (product.price === null) return minPrice === 0;
        return product.price >= minPrice && product.price <= maxPrice;
      })
      .filter(product => !search ||
        product.name.toLocaleLowerCase().includes(search) ||
        product.category.toLocaleLowerCase().includes(search));

    products.sort((a, b) => {
      if (sort === 'price-asc') return (a.price ?? 0) - (b.price ?? 0) || a.name.localeCompare(b.name);
      if (sort === 'price-desc') return (b.price ?? 0) - (a.price ?? 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });

    const total = products.length;
    const start = (page - 1) * pageSize;
    products = products.slice(start, start + pageSize);

    return NextResponse.json(
      { products, total, page, pageSize, totalPages: Math.ceil(total / pageSize), categories: cached.categories },
      { headers: PUBLIC_CACHE_HEADERS }
    );
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : 'UNKNOWN';
    console.error('[PUBLIC_CATALOGUE_API_FAILED]', { errorCode, message: error instanceof Error ? error.message : 'Unknown error' });

    return NextResponse.json(
      { error: 'The catalogue is temporarily unavailable. Please try again shortly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
