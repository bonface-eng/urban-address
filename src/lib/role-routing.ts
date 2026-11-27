// Client-safe copy (admin-auth.ts is server-only and must not be imported here).
const ROOT_ADMIN_EMAILS = [
  'gackstoneb@gmail.com',
  'bonfacewana3072@gmail.com',
  'urbanautoexpressnakuru@gmail.com',
  'urbanaautoexpressnakuru@gmail.com',
  'samuelkarani044@gmail.com',
  'gmaina424@gmail.com',
];

export interface RoleRoutingInput {
  role?: string | null;
  email?: string | null;
  isSuperAdmin?: boolean;
  assignedUnits?: string[] | null;
}

/**
 * Resolves the primary work dashboard route immediately after sign-in.
 *
 * - ADMIN (including root/super admins) -> /dashboard (Executive Admin overview; full access to /admin & all modules)
 * - MANAGER, SUPERVISOR, CASHIER -> /dashboard (POS & Staff operations dashboard)
 * - STOREKEEPER -> /inventory (Inventory & Store dashboard)
 * - ATTENDANT -> /carwash (Carwash service queue & jobs dashboard)
 * - KITCHEN -> /kds (Kitchen display board)
 * - CLIENT (or unauthenticated/unknown) -> / (Customer storefront)
 */
export function getRoleHomeRoute({
  role,
  email,
  isSuperAdmin = false,
}: RoleRoutingInput): string {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const isRootAdmin = Boolean(normalizedEmail && ROOT_ADMIN_EMAILS.includes(normalizedEmail));
  const upperRole = String(role || '').trim().toUpperCase();

  if (isSuperAdmin || isRootAdmin || upperRole === 'ADMIN') {
    return '/dashboard';
  }

  switch (upperRole) {
    case 'KITCHEN':
      return '/kds';
    case 'STOREKEEPER':
      return '/inventory';
    case 'ATTENDANT':
      return '/carwash';
    case 'CASHIER':
    case 'MANAGER':
    case 'SUPERVISOR':
      return '/dashboard';
    default:
      return '/';
  }
}

/**
 * Role-inherent baseline routes that a signed-in staff member is always allowed
 * to access without waiting on or being blocked by dynamic permission maps.
 */
export function getRoleBaselinePaths(role?: string | null, isSuperAdmin = false): string[] {
  if (isSuperAdmin) return ['*'];
  const upperRole = String(role || '').trim().toUpperCase();

  switch (upperRole) {
    case 'ADMIN':
      return ['*'];
    case 'MANAGER':
    case 'SUPERVISOR':
      return [
        '/dashboard',
        '/settings',
        '/lounge',
        '/store',
        '/carwash/pos',
        '/carwash',
        '/inventory',
        '/sales-history',
        '/customers',
        '/finance',
        '/reports',
        '/employees',
        '/suppliers',
        '/attendants',
        '/kds',
      ];
    case 'CASHIER':
      return [
        '/dashboard',
        '/settings',
        '/lounge',
        '/store',
        '/carwash/pos',
        '/sales-history',
        '/customers',
      ];
    case 'STOREKEEPER':
      return ['/inventory', '/suppliers', '/store', '/dashboard', '/settings'];
    case 'ATTENDANT':
      return ['/carwash', '/attendants', '/dashboard', '/settings'];
    case 'KITCHEN':
      return ['/kds', '/settings'];
    default:
      return [];
  }
}

/**
 * Sweeps obsolete browser storage keys from previous terminal security / PIN
 * gates so existing workstation browsers can never resurrect old overlays.
 */
export function clearObsoleteTerminalStorage(): void {
  if (typeof window === 'undefined') return;

  const sweep = (storage: Storage) => {
    const keys = Object.keys(storage);
    for (const key of keys) {
      const lower = key.toLowerCase();
      const isObsoletePrefix =
        lower.startsWith('uax_pin_') ||
        lower.startsWith('uax_legacy_') ||
        lower.startsWith('terminal_security_') ||
        lower.startsWith('terminal-security-');
      const isObsoletePinGateKey =
        lower.includes('pin') &&
        (lower.includes('migrat') ||
          lower.includes('legacy') ||
          lower.includes('disclaim') ||
          lower.includes('upgrade') ||
          lower.includes('version') ||
          lower.includes('reset') ||
          lower.includes('require'));

      if (isObsoletePrefix || isObsoletePinGateKey) {
        try {
          storage.removeItem(key);
        } catch {
          // Ignore storage quota / security errors in restricted contexts
        }
      }
    }
  };

  try {
    sweep(window.localStorage);
  } catch {
    // Ignore unavailable localStorage
  }
  try {
    sweep(window.sessionStorage);
  } catch {
    // Ignore unavailable sessionStorage
  }
}
