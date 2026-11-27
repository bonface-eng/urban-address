import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { TelegramIcon } from '@/components/icons/telegram-icon';
import { getRoleBaselinePaths } from '@/lib/role-routing';
import {
  Activity,
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Car,
  ChefHat,
  ClipboardList,
  Coffee,
  Contact,
  FileText,
  HardDrive,
  Image as ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Mail,
  MonitorPlay,
  MonitorCheck,
  Package,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  UserCircle,
  Users,
  AlertCircle,
} from 'lucide-react';

export type NavItem = {
  icon: LucideIcon | ComponentType<{ className?: string }>;
  label: string;
  href: string;
  superOnly?: boolean;
  unit?: 'LOUNGE' | 'STORE' | 'CARWASH';
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * One source of truth for desktop and mobile navigation.
 * Hub landing pages are intentionally excluded; every destination is a real module.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
      { icon: UserCircle, label: 'Profile & Settings', href: '/settings' },
      { icon: ChefHat, label: 'Kitchen Board', href: '/kds', unit: 'LOUNGE' },
      { icon: Coffee, label: 'Lounge POS', href: '/lounge', unit: 'LOUNGE' },
      { icon: Store, label: 'Store POS', href: '/store', unit: 'STORE' },
      { icon: MonitorPlay, label: 'Carwash POS', href: '/carwash/pos', unit: 'CARWASH' },
    ],
  },
  {
    title: 'Sales & Finance',
    items: [
      { icon: ClipboardList, label: 'Sales History', href: '/sales-history' },
      { icon: Contact, label: 'Customers', href: '/customers' },
      { icon: Receipt, label: 'Petty Cash & Finance', href: '/finance' },
      { icon: BarChart3, label: 'Business Reports', href: '/reports' },
      { icon: ShieldAlert, label: 'Fraud & Security', href: '/reports/fraud' },
      { icon: Award, label: 'Loyalty Reconciliation', href: '/admin/loyalty' },
    ],
  },
  {
    title: 'Inventory & Service',
    items: [
      { icon: Package, label: 'Inventory', href: '/inventory' },
      { icon: Truck, label: 'Suppliers', href: '/suppliers' },
      { icon: Car, label: 'Carwash Service Queue', href: '/carwash', unit: 'CARWASH' },
      { icon: Activity, label: 'Attendant Performance', href: '/attendants', unit: 'CARWASH' },
    ],
  },
  {
    title: 'People',
    items: [
      { icon: Users, label: 'Staff Registry', href: '/employees' },
      { icon: Banknote, label: 'Staff Payroll', href: '/admin/payroll' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { icon: Bot, label: 'Business Intelligence', href: '/admin/intelligence' },
      { icon: HardDrive, label: 'Database & System Health', href: '/admin/database' },
      { icon: AlertCircle, label: 'System Errors', href: '/admin/system-errors', superOnly: true },
      { icon: ShieldCheck, label: 'Access Matrix', href: '/admin', superOnly: true },
      { icon: Mail, label: 'Email Communications', href: '/admin/email', superOnly: true },
      { icon: TelegramIcon, label: 'Telegram Management', href: '/admin/telegram', superOnly: true },
      { icon: Building2, label: 'Branches & Locations', href: '/admin/branches', superOnly: true },
      { icon: MonitorPlay, label: 'Digital Menu Display', href: '/admin/digital-menu', superOnly: true },
      { icon: Smartphone, label: 'App Release Manager', href: '/admin/app-manager', superOnly: true },
      { icon: ImageIcon, label: 'Asset Library', href: '/admin/assets', superOnly: true },
      { icon: MonitorCheck, label: 'Live Audio Support', href: '/admin/live-audio' },
      { icon: MessageSquare, label: 'Support Inbox', href: '/admin/support' },
      { icon: FileText, label: 'OS Documents', href: '/admin/documents' },
      { icon: BookOpen, label: 'Help Guide', href: '/admin/help' },
    ],
  },
];

export type NavigationAccess = {
  role?: string | null;
  isSuperAdmin: boolean;
  assignedUnits?: string[];
  permMap?: Record<string, string[]> | null;
};

export function getVisibleNavGroups({
  role,
  isSuperAdmin,
  assignedUnits = [],
  permMap,
}: NavigationAccess): NavGroup[] {
  if (!role && !isSuperAdmin) return [];

  const baseline = getRoleBaselinePaths(role, isSuperAdmin);
  const roleAllowed = permMap?.[role || ''] || [];
  const upperRole = String(role || '').toUpperCase();
  const effectiveUnits =
    assignedUnits.length > 0
      ? assignedUnits
      : upperRole === 'ATTENDANT'
        ? ['CARWASH']
        : upperRole === 'STOREKEEPER'
          ? ['STORE']
          : upperRole === 'KITCHEN'
            ? ['LOUNGE']
            : assignedUnits;

  return NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isSuperAdmin || baseline.includes('*')) return true;
      if (item.superOnly || !role) return false;
      if (!baseline.includes(item.href) && !roleAllowed.includes(item.href)) return false;
      if (item.unit && !effectiveUnits.includes(item.unit)) return false;
      return true;
    }),
  })).filter(group => group.items.length > 0);
}
