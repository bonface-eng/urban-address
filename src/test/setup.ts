
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 1. Create stable mock functions that can be referenced in tests
export const mockUseFirestore = vi.fn((): any => ({}));
export const mockUseCollection = vi.fn((): { data: any[] | null; loading: boolean; error?: any } => ({ data: [], loading: false, error: null }));
export const mockUseDoc = vi.fn((): { data: any; loading: boolean; error?: any } => ({ data: null, loading: false, error: null }));
export const mockUseUser = vi.fn((): { user: any; loading: boolean } => ({ user: { uid: 'test-uid', email: 'test@urban.co.ke' }, loading: false }));
export const mockUseAuth = vi.fn((): any => ({}));
export const mockUseMemoSupabase = vi.fn((factory: any) => factory());
export const mockUseSupabase = vi.fn((): any => ({ db: {}, auth: {} }));

// 2. Register the module mock
vi.mock('@/lib/data', () => ({
  useDb: mockUseFirestore,
  useCollection: mockUseCollection,
  useDoc: mockUseDoc,
  useUser: mockUseUser,
  useAuth: mockUseAuth,
  useMemoSupabase: mockUseMemoSupabase,
  useSupabase: mockUseSupabase,
  useSupabaseApp: vi.fn(() => ({})),
  SupabaseProvider: ({ children }: any) => children,
  SupabaseClientProvider: ({ children }: any) => children,
}));

// 3. Mock Next.js Navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// 4. Mock Profile Hook
export const mockUseProfile = vi.fn((): any => ({
  role: 'ADMIN',
  profile: { uid: 'test-uid', displayName: 'Admin User', email: 'admin@urban.co.ke' },
  isSuperAdmin: true,
  isEmployee: true,
  loading: false,
  isManualAuth: true,
  switchRole: vi.fn()
}));

vi.mock('@/hooks/use-profile', () => ({
  useProfile: mockUseProfile,
}));

export const mockUseTerminal = vi.fn((): any => ({
  activeTerminal: { id: 'term-1', name: 'Main Terminal', unit: 'STORE', branchId: 'NAKA' },
  activeCashier: { uid: 'test-uid', displayName: 'Admin User', email: 'admin@urban.co.ke', role: 'ADMIN' },
  activeRegisterSession: { id: 'reg-1', status: 'OPEN', openingCash: 0 },
  loading: false,
  lockTerminal: vi.fn(),
  switchWithPin: vi.fn(async () => true),
  setIsLocked: vi.fn(),
  openRegister: vi.fn(async () => {}),
  closeRegister: vi.fn(async () => {}),
  swapIdentity: vi.fn(async () => true),
  loginAndSwitch: vi.fn(async () => true),
  loginWithGoogle: vi.fn(async () => true),
  clearActiveCashier: vi.fn(),
  refreshLocation: vi.fn(),
  isLocked: false,
  isLocationAuthorized: true,
  locationName: 'Nakuru Branch',
  clientIp: '127.0.0.1',
}));

vi.mock('@/hooks/use-terminal', () => ({
  useTerminal: mockUseTerminal,
  TerminalProvider: ({ children }: any) => children,
}));

// 5. Global Browser API Mocks
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ScrollIntoView and Pointer Capture APIs which are missing in JSDOM
Element.prototype.scrollIntoView = vi.fn();
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
