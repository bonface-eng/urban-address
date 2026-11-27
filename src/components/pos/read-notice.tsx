import { Button } from '@/components/ui/button';
export function PosReadNotice({ label, error, onRetry }: { label: string; error: string | null; onRetry: () => void }) {
  if (!error) return null;
  const safeCode = ['POS_AUTH_REQUIRED','POS_STAFF_REQUIRED','POS_READ_INVALID','POS_READ_UNAVAILABLE','INVENTORY_AUTH_REQUIRED','INVENTORY_STAFF_REQUIRED','INVENTORY_SERVER_ACCESS','INVENTORY_DATABASE_CONFIGURATION','INVENTORY_SERVER_UNAVAILABLE'].includes(error) ? error : 'POS_READ_UNAVAILABLE';
  return <div role="alert" className="p-3 border border-red-200 rounded-xl text-sm space-y-2">
    <p>{label} could not be loaded. {safeCode.endsWith('AUTH_REQUIRED') ? 'Sign in again.' : 'Retry or contact your administrator.'} Ref: {safeCode}</p>
    <Button variant="outline" size="sm" onClick={onRetry}>Retry {label}</Button>
  </div>;
}
