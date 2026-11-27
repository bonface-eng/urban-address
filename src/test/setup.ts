
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// 1. Create stable mock functions that can be referenced in tests
export const mockUseFirestore = vi.fn((): any => ({}));
export const mockUseCollection = vi.fn((): { data: any[] | null; loading: boolean; error?: any } => ({ data: [], loading: false, error: null }));
export const mockUseDoc = vi.fn((): { data: any; loading: boolean; error?: any } => ({ data: null, loading: false, error: null }));
export const mockUseUser = vi.fn((): { user: any; loading: boolean } => ({ user: { uid: 'test-uid', email: 'test@urban.co.ke' }, loading: false }));
export const mockUseAuth = vi.fn((): any => ({}));
export const mockUseMemoFirebase = vi.fn((factory: any) => factory());
export const mockUseFirebase = vi.fn((): any => ({ firebaseApp: {}, firestore: {}, auth: {} }));

// 2. Register the module mock
vi.mock('@/firebase', () => ({
  useFirestore: mockUseFirestore,
  useCollection: mockUseCollection,
  useDoc: mockUseDoc,
  useUser: mockUseUser,
  useAuth: mockUseAuth,
  useMemoFirebase: mockUseMemoFirebase,
  useFirebase: mockUseFirebase,
  useFirebaseApp: vi.fn(() => ({})),
  FirebaseProvider: ({ children }: any) => children,
  FirebaseClientProvider: ({ children }: any) => children,
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

// 5. Global Browser API Mocks
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ScrollIntoView which is missing in JSDOM
Element.prototype.scrollIntoView = vi.fn();
