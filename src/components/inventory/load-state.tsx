import { Button } from '@/components/ui/button';

type Props = { loading: boolean; error: { code?: string } | null; ready: boolean; total: number; visible: number; unit: string; onReset: () => void; onRetry: () => void };

export function InventoryLoadState({ loading, error, ready, total, visible, unit, onReset, onRetry }: Props) {
  if (!ready) return <div role="status" className="p-8">Waiting for your staff profile before loading inventory.</div>;
  if (error) return <div role="alert" className="p-8 space-y-4 border border-red-200 rounded-xl">
    <h2 className="font-bold">Inventory could not be loaded</h2>
    <p>{error.code === 'permission-denied'
      ? 'Your inventory read was denied. This does not mean stock records were deleted. Contact your administrator. Ref: INVENTORY_READ_DENIED'
      : error.code === 'INVENTORY_AUTH_REQUIRED' ? 'Your sign-in session needs refreshing. Sign out and sign in again. Ref: INVENTORY_AUTH_REQUIRED'
      : error.code === 'INVENTORY_STAFF_REQUIRED' ? 'The server could not confirm active staff access. Contact your administrator. Ref: INVENTORY_STAFF_REQUIRED'
      : error.code === 'INVENTORY_SERVER_ACCESS' ? 'The server database connection lacks inventory access. Ref: INVENTORY_SERVER_ACCESS'
      : error.code === 'INVENTORY_DATABASE_CONFIGURATION' ? 'The database requires configuration before inventory can load. Ref: INVENTORY_DATABASE_CONFIGURATION'
      : error.code === 'INVENTORY_SERVER_UNAVAILABLE' ? 'The authenticated inventory service could not complete the read. Your records have not been changed. Ref: INVENTORY_SERVER_UNAVAILABLE'
      : 'The inventory connection failed. This does not mean stock records were deleted. Check your connection and retry. Ref: INVENTORY_READ_FAILED'}</p>
    <Button onClick={onRetry}>Retry inventory</Button>
  </div>;
  if (loading) return <div role="status" className="p-8">Loading inventory records…</div>;
  if (visible > 0) return null;
  return <div role="status" className="p-8 space-y-4 border rounded-xl">
    <h2 className="font-bold">{total === 0 ? 'No inventory records were returned' : 'No records match this view'}</h2>
    <p>{total === 0
      ? 'The current database query returned no records. No records have been changed or restored.'
      : `${total} records loaded across departments. Check the department tabs or Archived status; this view is ${unit}.`}</p>
    <Button variant="outline" onClick={onReset}>Reset filters</Button>
  </div>;
}
