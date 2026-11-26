'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Award,
  Activity, 
  Settings2, 
  Save,
  RefreshCcw,
  Check,
  AlertTriangle,
  Zap,
  Terminal,
  KeyRound,
  Eye,
  EyeOff,
  CloudLightning,
  Globe,
  Trash2,
  Mail,
  ShieldAlert,
  Server,
  Coffee, 
  ShoppingBag, 
  MonitorPlay, 
  Smartphone,
  Package, 
  Car, 
  Users, 
  ClipboardList, 
  UserCircle, 
  Receipt, 
  BarChart3, 
  ChefHat, 
  Banknote,
  Contact,
  TrendingUp,
  Truck,
  LayoutDashboard,
  Store,
  HardDrive,
  Monitor,
  ArrowUpRight,
  Hash,
  RotateCcw,
  Key,
  Database,
  Cloud,
  UserPlus,
  MonitorCheck,
  Image as ImageIcon,
  Moon,
  Sun,
  AlertCircle,
  CreditCard,
  Fingerprint,
  Lock,
  BellRing,
  Megaphone,
  Send,
  History,
  MessageSquare,
  ExternalLink,
  FileText,
  BookOpen,
  Bot,
  DollarSign,
  Copy,
  Building2,
  LayoutGrid,
  Snowflake,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, setDoc, collection, query, orderBy, limit, addDoc, deleteDoc, updateDoc, where, getDocs, writeBatch } from 'firebase/firestore';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UserRole, AuditLog, BusinessUnit, UserProfile, POSTerminal, BusinessBranch } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN'];
const UNITS: { label: string; value: BusinessUnit }[] = [
  { label: 'Lounge & Bar', value: 'LOUNGE' },
  { label: 'Auto Accessories', value: 'STORE' },
  { label: 'Carwash Detailing', value: 'CARWASH' }
];

const ACCESS_PAGES: Array<{ label: string; href: string; icon: React.ElementType; group: string; superOnly?: boolean }> = [
  // Operations
  { label: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard, group: 'Operations' },
  { label: 'Kitchen Board', href: '/kds', icon: ChefHat, group: 'Operations' },
  { label: 'Lounge Station', href: '/lounge', icon: Coffee, group: 'Operations' },
  { label: 'Retail Station', href: '/store', icon: Store, group: 'Operations' },
  { label: 'Carwash Station', href: '/carwash/pos', icon: MonitorPlay, group: 'Operations' },

  // Intelligence
  { label: 'AI Analyst', href: '/admin/intelligence', icon: Bot, group: 'Intelligence' },
  { label: 'Security Monitoring', href: '/reports/fraud', icon: ShieldAlert, group: 'Intelligence' },
  { label: 'System Health', href: '/admin/database', icon: HardDrive, group: 'Intelligence' },
  { label: 'System Errors', href: '/admin/system-errors', icon: AlertCircle, group: 'Intelligence', superOnly: true },

  // Staff
  { label: 'Team Registry', href: '/employees', icon: Users, group: 'Staff' },
  { label: 'Attendant Performance', href: '/attendants', icon: UserCircle, group: 'Staff' },
  { label: 'Staff Payroll', href: '/admin/payroll', icon: Banknote, group: 'Staff' },

  // Finance & customers
  { label: 'Sales History', href: '/sales-history', icon: ClipboardList, group: 'Finance' },
  { label: 'Petty Cash & Finance', href: '/finance', icon: Receipt, group: 'Finance' },
  { label: 'Business Reports', href: '/reports', icon: BarChart3, group: 'Finance' },
  { label: 'Customer CRM', href: '/customers', icon: Contact, group: 'Finance' },
  { label: 'Loyalty Reconciliation', href: '/admin/loyalty', icon: Award, group: 'Finance' },

  // Logistics
  { label: 'Inventory Catalog', href: '/inventory', icon: Package, group: 'Logistics' },
  { label: 'Supplier Network', href: '/suppliers', icon: Truck, group: 'Logistics' },
  { label: 'Service Queue', href: '/carwash', icon: Car, group: 'Logistics' },

  // Direct administration pages (hub landing pages removed)
  { label: 'Access Matrix', href: '/admin', icon: Terminal, group: 'Governance' },
  { label: 'Branch Management', href: '/admin/branches', icon: Building2, group: 'Governance' },
  { label: 'Digital Menu Display', href: '/admin/digital-menu', icon: MonitorPlay, group: 'Governance' },
  { label: 'App Release Manager', href: '/admin/app-manager', icon: Smartphone, group: 'Governance' },
  { label: 'Asset Library', href: '/admin/assets', icon: ImageIcon, group: 'Governance' },
  { label: 'Live Audio Support', href: '/admin/live-audio', icon: MonitorCheck, group: 'Governance' },
  { label: 'Support Inbox', href: '/admin/support', icon: MessageSquare, group: 'Governance' },
  { label: 'OS Documents', href: '/admin/documents', icon: FileText, group: 'Governance' },
  { label: 'Email Communications', href: '/admin/email', icon: Mail, group: 'Governance', superOnly: true },
  { label: 'Telegram Management', href: '/admin/telegram', icon: Send, group: 'Governance', superOnly: true },
  { label: 'Help Guide', href: '/admin/help', icon: BookOpen, group: 'Governance' },
];

export default function AdminPanel() {
  const { isSuperAdmin, profile } = useProfile();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSettingUpBranches, setIsSettingUpBranches] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState('matrix');
  const [terminalToDelete, setTerminalToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<string | 'ALL_STAFF'>('ALL_STAFF');

  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalUnit, setNewTerminalUnit] = useState<BusinessUnit>('STORE');

  useEffect(() => {
    setMounted(true);
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab && ['matrix', 'staff', 'broadcasting', 'stations', 'config'].includes(requestedTab)) setActiveAdminTab(requestedTab);
  }, []);

  // Guard document requests with user session to prevent permission errors
  const permissionsRef = useMemo(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user, isSuperAdmin]);

  const configRef = useMemo(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user, isSuperAdmin]);

  const { data: permMap } = useDoc<any>(permissionsRef);
  const { data: remoteConfig } = useDoc<any>(configRef);

  const [localPerms, setLocalPerms] = useState<Record<string, string[]>>({});
  const [isPermsDirty, setIsPermsDirty] = useState(false);

  const [localConfig, setLocalConfig] = useState({
    commissionStandard: '30.00',
    commissionNightShift: '50.00',
    paystackPublicKeyLive: '',
    paystackSecretKeyLive: '',
    visualTheme: 'NONE'
  });


  const terminalsRef = useMemo(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return collection(firestore, 'pos_terminals');
  }, [firestore, user, isSuperAdmin]);

  const { data: terminals } = useCollection<POSTerminal>(terminalsRef);

  const branchesRef = useMemo(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return collection(firestore, 'branches');
  }, [firestore, user, isSuperAdmin]);
  const { data: branches } = useCollection<BusinessBranch>(branchesRef);

  const staffQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return query(collection(firestore, 'users'), orderBy('createdAt', 'desc'));
  }, [firestore, user, isSuperAdmin]);
  const { data: allStaff } = useCollection<UserProfile>(staffQuery);

  const broadcastHistoryQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isSuperAdmin) return null;
    return query(
      collection(firestore, 'audit_logs'),
      where('action', '==', 'INTERNAL_BROADCAST'),
      orderBy('timestamp', 'desc'),
      limit(15)
    );
  }, [firestore, user, isSuperAdmin]);
  const { data: broadcastHistory } = useCollection<AuditLog>(broadcastHistoryQuery);

  // Keep administrator settings synchronized with other administrators while
  // preserving this session's unsaved permission edits.
  useEffect(() => {
    if (permMap && !isPermsDirty) setLocalPerms(permMap);
  }, [permMap, isPermsDirty]);

  // Global configuration is read-only in this panel; mirror every remote update.
  useEffect(() => {
    if (remoteConfig) setLocalConfig(prev => ({ ...prev, ...remoteConfig }));
  }, [remoteConfig]);

  const togglePermission = (role: string, href: string) => {
    setIsPermsDirty(true);
    setLocalPerms(prev => {
      const current = (prev && prev[role]) ? [...prev[role]] : [];
      const updated = current.includes(href) 
        ? current.filter(h => h !== href) 
        : [...current, href];
      return { ...prev, [role]: updated };
    });
  };

  const handleSaveAll = async () => {
    if (!firestore || !profile) return;
    setIsSubmitting(true);
    
    try {
      await setDoc(doc(firestore, 'system', 'permissions'), localPerms);
      await setDoc(doc(firestore, 'system', 'config'), localConfig);
      setIsPermsDirty(false);
      
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'UPDATE_SETTINGS',
        userId: profile.uid,
        details: `Updated global system access matrix and operational variables. Visual Theme: ${localConfig.visualTheme}`,
        timestamp: Date.now(),
        severity: 'CRITICAL'
      });

      toast({ title: "Settings Saved", description: "Master OS parameters synchronized." });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Refused" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage || !profile || !firestore) return;
    
    setIsBroadcasting(true);
    try {
      let targetQuery = query(collection(firestore, 'users'), where('role', '!=', 'CLIENT'));
      if (broadcastTarget !== 'ALL_STAFF') {
         targetQuery = query(collection(firestore, 'users'), where('role', '==', broadcastTarget));
      }

      const snap = await getDocs(targetQuery);
      if (snap.empty) {
        toast({ title: "No Recipients", description: `No staff found with role: ${broadcastTarget}` });
        setIsBroadcasting(false);
        return;
      }

      const batch = writeBatch(firestore);
      const timestamp = Date.now();

      snap.docs.forEach(userDoc => {
        const notifRef = doc(collection(firestore, 'notifications'));
        batch.set(notifRef, {
          userId: userDoc.id,
          title: broadcastTitle,
          message: broadcastMessage,
          timestamp,
          read: false,
          type: 'AUTH'
        });
      });

      const auditRef = doc(collection(firestore, 'audit_logs'));
      batch.set(auditRef, {
        action: 'INTERNAL_BROADCAST',
        userId: profile.uid,
        details: `[${broadcastTarget}] ${broadcastTitle}: ${broadcastMessage}`,
        timestamp,
        severity: 'WARNING'
      });

      await batch.commit();
      
      toast({ title: "Alert Sent", description: `Message delivered to ${snap.size} nodes.` });
      setBroadcastTitle('');
      setBroadcastMessage('');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Broadcast Failed" });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleProvisionStation = async () => {
    if (!firestore || !newTerminalName || !profile) return;
    try {
      await addDoc(collection(firestore, 'pos_terminals'), {
        name: newTerminalName.trim(),
        unit: newTerminalUnit,
        status: 'OPEN',
        currentCashierId: null,
        lastActive: Date.now(),
        createdAt: Date.now()
      });
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'STATION_PROVISIONED',
        userId: profile.uid,
        details: `Provisioned new station: ${newTerminalName} (${newTerminalUnit})`,
        timestamp: Date.now(),
        severity: 'INFO'
      });
      setNewTerminalName('');
      toast({ title: "Station Active", description: `${newTerminalName} is now connected.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Provisioning Failed" });
    }
  };

  const handleDeleteTerminal = async () => {
    if (!firestore || !terminalToDelete || !profile) return;
    try {
      await deleteDoc(doc(firestore, 'pos_terminals', terminalToDelete.id));
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'STATION_REMOVED',
        userId: profile.uid,
        details: `Decommissioned station: ${terminalToDelete.name}`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });
      toast({ title: "Station Removed" });
    } catch (e) {
      toast({ variant: "destructive", title: "Action Blocked" });
    } finally {
      setTerminalToDelete(null);
    }
  };

  const defaultNakaBranch = (branches || []).find(branch => branch.code === 'default-naka');
  const currentStaff = (allStaff || []).filter(staff => staff.role && staff.role !== 'CLIENT');
  const branchSetupNeeded = Boolean(branches && allStaff && (
    !defaultNakaBranch || currentStaff.some(staff =>
      !(staff.branchIds || []).includes(defaultNakaBranch.id) || staff.activeBranchId !== defaultNakaBranch.id
    )
  ));

  const setupDefaultNakaBranch = async () => {
    if (!firestore || !user || !profile || !isSuperAdmin || !branches || !allStaff) return;
    setIsSettingUpBranches(true);
    try {
      const now = Date.now();
      const branchId = defaultNakaBranch?.id || 'default-naka';
      const branchRef = doc(firestore, 'branches', branchId);
      const branchData = {
        id: branchId,
        businessId: 'urban-address' as const,
        name: 'Default - Naka Branch',
        code: 'default-naka',
        status: 'ACTIVE' as const,
        isPrimary: true,
        location: defaultNakaBranch?.location || {
          address: '',
          town: 'Naka',
          county: 'Nakuru',
          country: 'Kenya'
        },
        phone: defaultNakaBranch?.phone || '',
        createdAt: defaultNakaBranch?.createdAt || now,
        createdBy: defaultNakaBranch?.createdBy || user.uid,
        updatedAt: now,
        updatedBy: user.uid
      };

      const branchBatch = writeBatch(firestore);
      branchBatch.set(branchRef, branchData, { merge: true });
      (branches || []).filter(branch => branch.id !== branchId && branch.isPrimary).forEach(branch => {
        branchBatch.update(doc(firestore, 'branches', branch.id), {
          isPrimary: false, updatedAt: now, updatedBy: user.uid
        });
      });
      await branchBatch.commit();

      const staffToAssign = currentStaff.filter(staff =>
        !(staff.branchIds || []).includes(branchId) || staff.activeBranchId !== branchId
      );
      for (let offset = 0; offset < staffToAssign.length; offset += 450) {
        const batch = writeBatch(firestore);
        staffToAssign.slice(offset, offset + 450).forEach(staff => {
          const branchIds = Array.from(new Set([...(staff.branchIds || []), branchId]));
          batch.update(doc(firestore, 'users', staff.uid), {
            branchIds,
            activeBranchId: branchId,
            updatedAt: now
          });
        });
        await batch.commit();
      }

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'INITIALIZE_BRANCH_STRUCTURE',
        userId: profile.uid,
        details: `Created or confirmed Default - Naka Branch and assigned ${staffToAssign.length} existing staff accounts.`,
        timestamp: now,
        severity: 'INFO'
      });
      toast({
        title: 'Default - Naka Branch is ready',
        description: `${staffToAssign.length} existing staff account(s) assigned. You can now add other branches and locations.`
      });
    } catch (error) {
      console.error('[branch-setup] Failed to initialize default Naka branch', error);
      toast({
        variant: 'destructive',
        title: 'Branch setup was not completed',
        description: 'Some setup steps may have saved. Retry this action to safely finish assigning the existing staff.'
      });
    } finally {
      setIsSettingUpBranches(false);
    }
  };

  const handleBranchToggle = async (staff: UserProfile, branchId: string) => {
    if (!firestore || !profile || staff.role === 'CLIENT') return;
    const currentIds = staff.branchIds || [];
    const branchIds = currentIds.includes(branchId)
      ? currentIds.filter(id => id !== branchId)
      : [...currentIds, branchId];
    const activeBranchId = staff.activeBranchId && branchIds.includes(staff.activeBranchId)
      ? staff.activeBranchId
      : branchIds[0] || null;
    try {
      await updateDoc(doc(firestore, 'users', staff.uid), { branchIds, activeBranchId });
      toast({ title: 'Branch access updated', description: `${staff.displayName} can access ${branchIds.length} branch(es).` });
    } catch {
      toast({ variant: 'destructive', title: 'Branch assignment failed' });
    }
  };

  const handleUnitToggle = async (user: UserProfile, unitVal: BusinessUnit) => {
    if (!firestore || !profile) return;
    const currentUnits = user.assignedUnits || [];
    const updatedUnits = currentUnits.includes(unitVal)
      ? currentUnits.filter(u => u !== unitVal)
      : [...currentUnits, unitVal];
      
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        assignedUnits: updatedUnits
      });
      toast({ title: "Authorization Updated", description: `${user.displayName} synchronized across nodes.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  if (!mounted) return null;
  if (!isSuperAdmin) return null;

  return (
    <div className="admin-hub ua-compact-page space-y-5 pb-28 sm:space-y-8 sm:pb-24 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-2 pt-2 sm:pt-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">System Governance</span>
          </div>
          <PageHeader title="Administration" breadcrumb={["Admin", "Administration"]} className="mb-0" />
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className="h-11 w-full sm:w-auto px-4 sm:px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-2 transition-all active:scale-95"
          >
            {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-primary" />}
            Save OS Changes
          </Button>
        </div>
      </div>

      {isSuperAdmin && branchSetupNeeded && (
        <Card className="mx-2 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black text-zinc-900">Complete your branch setup</h2>
                  <Badge className="border-amber-200 bg-amber-100 text-amber-800">Action required</Badge>
                </div>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600">
                  Urban Address is currently one business expanding to multiple locations. Set up <strong>Default - Naka Branch</strong> as the primary location and assign all existing staff accounts to it. Their current roles and station permissions will remain unchanged.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:min-w-[230px]">
              <Button onClick={setupDefaultNakaBranch} disabled={isSettingUpBranches || !branches || !allStaff} className="h-11 rounded-xl bg-zinc-900 px-4 text-[10px] font-black uppercase tracking-wider text-white hover:bg-zinc-800">
                {isSettingUpBranches ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />}
                {isSettingUpBranches ? 'Setting up branch…' : 'Set up Naka branch'}
              </Button>
              <a href="/admin/branches" className="text-center text-[10px] font-bold text-zinc-600 underline underline-offset-4 hover:text-zinc-950">Review branches and add locations</a>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="w-full">
        <div className="px-2 overflow-x-auto no-scrollbar pb-2">
          <TabsList className="bg-white p-1 rounded-xl sm:rounded-[1.5rem] h-12 sm:h-14 mb-3 sm:mb-4 shadow-sm border border-zinc-100 flex w-max min-w-full lg:w-full">
            <TabsTrigger value="matrix" className="rounded-lg sm:rounded-xl h-full px-3 sm:px-5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Access Matrix</TabsTrigger>
            <TabsTrigger value="staff" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Staff Registry</TabsTrigger>
            <TabsTrigger value="broadcasting" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Internal Alerts</TabsTrigger>
            <TabsTrigger value="stations" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">POS Stations</TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Global Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matrix" className="px-2">
          <section className="space-y-5">
            <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Access governance</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-zinc-950 sm:text-2xl">Role permissions</h2>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-zinc-500">Choose which operational areas each role can open. Changes remain local until you save OS changes.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-zinc-500">
                <span className="rounded-md border border-zinc-200 px-2.5 py-1.5">{ROLES.length} roles</span>
                <span className="rounded-md border border-zinc-200 px-2.5 py-1.5">{ACCESS_PAGES.length} modules</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {ROLES.map(role => {
                const enabledCount = ACCESS_PAGES.filter(page => !page.superOnly && localPerms?.[role]?.includes(page.href)).length;
                const groupedPages = ACCESS_PAGES.reduce<Record<string, typeof ACCESS_PAGES>>((groups, page) => {
                  (groups[page.group] ||= []).push(page);
                  return groups;
                }, {});
                return (
                  <article key={role} className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                    <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700"><ShieldCheck className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-black uppercase tracking-[0.12em] text-zinc-900">{role}</h3>
                          <p className="mt-0.5 text-[11px] text-zinc-500">{enabledCount} of {ACCESS_PAGES.length} modules enabled</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-700">{Math.round((enabledCount / ACCESS_PAGES.length) * 100)}%</span>
                    </header>
                    <div className="divide-y divide-zinc-100">
                      {Object.entries(groupedPages).map(([group, pages]) => (
                        <section key={group} className="px-4 py-3 sm:px-5">
                          <h4 className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary">{group}</h4>
                          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {pages.map(page => {
                              const allowed = page.superOnly || Boolean(localPerms?.[role]?.includes(page.href));
                              return (
                                <button key={page.href} type="button" aria-pressed={allowed} disabled={page.superOnly} onClick={() => { if (!page.superOnly) togglePermission(role, page.href); }}
                                  className={cn("flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", allowed ? "border-primary/30 bg-orange-50/40 text-zinc-900" : "border-transparent bg-zinc-50/70 text-zinc-500 hover:border-zinc-200 hover:bg-white")}>
                                  <span className="flex min-w-0 items-center gap-2">
                                    <page.icon className={cn("h-3.5 w-3.5 shrink-0", allowed ? "text-primary" : "text-zinc-400")} />
                                    <span className="truncate text-[10px] font-bold">{page.label}{page.superOnly ? ' · Super admin only' : ''}</span>
                                  </span>
                                  <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", allowed ? "border-primary bg-primary text-white" : "border-zinc-300 bg-white text-transparent")}>
                                    {allowed && <Check className="h-3 w-3 stroke-[3]" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="text-[11px] leading-5 text-zinc-500">Security note: this matrix controls role-based page visibility. Sensitive operations must continue to enforce authorization in their own server-side or Firestore security rules.</p>
          </section>
        </TabsContent>

        <TabsContent value="staff" className="px-2">
           <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white overflow-hidden border border-zinc-100">
              <div className="p-4 sm:p-8 border-b border-zinc-50 flex flex-wrap items-center justify-between gap-3">
                 <h3 className="text-sm font-black uppercase tracking-widest">Personnel Registry</h3>
                 <div className="flex items-center gap-3">
                   <Badge className="bg-zinc-100 text-zinc-400 uppercase font-black text-[8px] px-3">{allStaff?.length} Members</Badge>
                   <a href="/employees" className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[9px] font-black uppercase border border-zinc-100 text-zinc-400 bg-white hover:text-primary hover:border-primary/30 transition-colors">
                     Manage Team
                   </a>
                 </div>
              </div>
              <div className="hidden overflow-x-auto md:block">
              <div className="overflow-x-auto">
                <Table>
                   <TableHeader className="bg-zinc-50/50">
                      <TableRow>
                         <TableHead className="pl-8 h-14 text-[10px] font-black uppercase">Identity</TableHead>
                         <TableHead className="h-14 text-[10px] font-black uppercase text-center">System Role</TableHead>
                         <TableHead className="h-14 text-[10px] font-black uppercase text-center">Station Authorization</TableHead>
                         <TableHead className="h-14 text-[10px] font-black uppercase text-center">Branch Access</TableHead>
                         <TableHead className="pr-8 h-14 text-[10px] font-black uppercase text-right">Joined On</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {allStaff?.map(s => {
                        const currentUnits = s.assignedUnits || [];
                        return (
                          <TableRow key={s.uid} className="hover:bg-zinc-50/50 transition-colors">
                             <TableCell className="pl-8 py-4">
                                <div className="flex items-center gap-3">
                                   <div>
                                      <p className="text-xs font-black uppercase text-zinc-900">{s.displayName}</p>
                                      <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{s.email}</p>
                                   </div>
                                </div>
                             </TableCell>
                             <TableCell className="text-center"><Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-200 px-3">{s.role}</Badge></TableCell>
                             <TableCell className="text-center">
                               <Popover>
                                 <PopoverTrigger asChild>
                                   <Button variant="outline" className="h-9 px-3 rounded-xl border-zinc-100 bg-white shadow-sm flex items-center gap-2 mx-auto">
                                      {currentUnits.length === 0 ? (
                                        <span className="text-[8px] font-black text-zinc-400 uppercase">All Stations</span>
                                      ) : (
                                        <div className="flex gap-1">
                                          {currentUnits.map(u => (
                                            <Badge key={u} className="bg-primary text-white border-none h-4 px-1.5 text-[6px] font-black">{u}</Badge>
                                          ))}
                                        </div>
                                      )}
                                      <ChevronDown className="w-3 h-3 text-zinc-300" />
                                   </Button>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-56 p-2 rounded-2xl border-none shadow-2xl bg-white">
                                    <div className="p-3 border-b border-zinc-50">
                                       <p className="text-[9px] font-black uppercase text-zinc-400">Authorize Stations</p>
                                    </div>
                                    <div className="py-2 space-y-1">
                                       {UNITS.map(u => (
                                         <button
                                           key={u.value}
                                           onClick={() => handleUnitToggle(s, u.value)}
                                           className={cn(
                                             "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                                             currentUnits.includes(u.value) ? "bg-primary/5 text-primary" : "text-zinc-400 hover:bg-zinc-50"
                                           )}
                                         >
                                            <span className="text-[10px] font-black uppercase">{u.label}</span>
                                            {currentUnits.includes(u.value) && <Check className="w-4 h-4" />}
                                         </button>
                                       ))}
                                    </div>
                                 </PopoverContent>
                               </Popover>
                             </TableCell>
                             <TableCell className="text-center">
                               {s.role === 'CLIENT' ? <span className="text-[9px] text-zinc-300">Customer</span> : (
                                 <Popover>
                                   <PopoverTrigger asChild>
                                     <Button variant="outline" className="mx-auto flex h-9 max-w-[190px] items-center gap-2 rounded-lg border-zinc-200 px-3 text-[9px] font-bold">
                                       <span className="truncate">{(s.branchIds || []).length ? `${(s.branchIds || []).length} branch(es)` : 'No branch assigned'}</span>
                                       <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" />
                                     </Button>
                                   </PopoverTrigger>
                                   <PopoverContent align="center" className="w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
                                     <p className="px-3 py-2 text-[9px] font-black uppercase text-zinc-400">Assign branch access</p>
                                     {(branches || []).filter(branch => branch.status === 'ACTIVE').map(branch => {
                                       const assigned = (s.branchIds || []).includes(branch.id);
                                       return <button key={branch.id} type="button" onClick={() => handleBranchToggle(s, branch.id)} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-bold", assigned ? "bg-primary/5 text-primary" : "text-zinc-600 hover:bg-zinc-50")}>
                                         <span className="min-w-0"><span className="block truncate">{branch.name}</span><span className="text-[9px] font-normal text-zinc-400">{branch.location?.town}, {branch.location?.county}</span></span>
                                         {assigned && <Check className="h-4 w-4 shrink-0" />}
                                       </button>;
                                     })}
                                     {!(branches || []).length && <p className="px-3 py-4 text-xs text-zinc-400">Create a branch before assigning staff.</p>}
                                   </PopoverContent>
                                 </Popover>
                               )}
                             </TableCell>
                             <TableCell className="pr-8 text-right text-[10px] font-bold text-zinc-400">{new Date(s.createdAt).toLocaleDateString('en-KE')}</TableCell>
                          </TableRow>
                        );
                      })}
                   </TableBody>
                </Table>
      
              </div>
              <div className="grid gap-3 p-3 md:hidden">
                {allStaff?.length ? allStaff.map(s => {
                  const currentUnits = s.assignedUnits || [];
                  return (
                    <article key={s.uid} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black uppercase text-zinc-900">{s.displayName}</p>
                          <p className="mt-1 break-all text-[11px] text-zinc-500">{s.email}</p>
                          <div className="mt-2"><Badge variant="outline" className="text-[9px] font-bold uppercase">{s.role}</Badge></div>
                        </div>
                        <span className="shrink-0 text-[10px] text-zinc-400">{new Date(s.createdAt).toLocaleDateString('en-KE')}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {currentUnits.length ? currentUnits.map(u => <Badge key={u} className="h-5 border-none bg-primary/10 px-2 text-[8px] text-primary">{u}</Badge>) : <span className="text-[9px] font-bold uppercase text-zinc-400">All Stations</span>}
                        </div>
                        {s.role !== 'CLIENT' && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="h-10 shrink-0 rounded-lg px-3 text-[9px] font-bold uppercase">Branches <ChevronDown className="ml-1 h-3 w-3"/></Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
                              <p className="px-3 py-2 text-[9px] font-black uppercase text-zinc-400">Assign branch access</p>
                              {(branches || []).filter(branch => branch.status === 'ACTIVE').map(branch => {
                                const assigned = (s.branchIds || []).includes(branch.id);
                                return <button key={branch.id} type="button" onClick={() => handleBranchToggle(s, branch.id)} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-bold", assigned ? "bg-primary/5 text-primary" : "text-zinc-600 hover:bg-zinc-50")}>
                                  <span className="min-w-0"><span className="block truncate">{branch.name}</span><span className="text-[9px] font-normal text-zinc-400">{branch.location?.town}, {branch.location?.county}</span></span>
                                  {assigned && <Check className="h-4 w-4 shrink-0" />}
                                </button>;
                              })}
                              {!(branches || []).length && <p className="px-3 py-4 text-xs text-zinc-400">Create a branch before assigning staff.</p>}
                            </PopoverContent>
                          </Popover>
                        )}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-10 shrink-0 rounded-lg px-3 text-[9px] font-bold uppercase">Stations <ChevronDown className="ml-1 h-3 w-3"/></Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 rounded-xl border border-zinc-200 bg-white p-2 shadow-xl">
                            <p className="px-3 py-2 text-[9px] font-black uppercase text-zinc-400">Authorize Stations</p>
                            {UNITS.map(u => (
                              <button key={u.value} onClick={() => handleUnitToggle(s, u.value)} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-xs font-bold", currentUnits.includes(u.value) ? "bg-primary/5 text-primary" : "text-zinc-600 hover:bg-zinc-50")}>
                                {u.label}
                                {currentUnits.includes(u.value) && <Check className="h-4 w-4"/>}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </article>
                  );
                }) : <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-xs text-zinc-400">No staff records available.</div>}
              </div>        </div>
           </Card>
        </TabsContent>
        
        <TabsContent value="broadcasting" className="px-2">
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <Card className="lg:col-span-4 rounded-[2.5rem] border-none shadow-mobile bg-white p-8 sm:p-10 space-y-6 border border-zinc-100">
                 <div className="text-center space-y-1 mb-2">
                   <h2 className="text-xl font-black uppercase font-headline">Internal Dispatch</h2>
                   <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-1">Station Network Alerts</p>
                 </div>
                 <form onSubmit={handleBroadcast} className="space-y-5">
                    <div className="space-y-4 ua-compact-page">
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Target Personnel</Label>
                          <Select value={broadcastTarget} onValueChange={setBroadcastTarget}>
                             <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold uppercase text-[10px]">
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="ALL_STAFF" className="text-[10px] font-black uppercase">Broadcast All</SelectItem>
                                {ROLES.map(r => <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">{r} Only</SelectItem>)}
                             </SelectContent>
                          </Select>
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Subject Header</Label>
                          <Input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="e.g. Schedule Update" className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" required />
                       </div>
                       <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Detailed Message</Label>
                          <Textarea value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} placeholder="Enter briefing details..." className="h-32 bg-zinc-50 border-none rounded-2xl px-6 py-4 font-medium text-xs resize-none" required />
                       </div>
                    </div>
                    <Button type="submit" disabled={isBroadcasting} className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all gap-3 active:scale-95">
                       {isBroadcasting ? 'Dispatching...' : 'Send Alert'}
                    </Button>
                 </form>
              </Card>

              <Card className="lg:col-span-8 rounded-[2.5rem] border-none shadow-mobile bg-white border border-zinc-100 overflow-hidden flex flex-col">
                 <CardHeader className="p-6 sm:p-8 border-b border-zinc-50 flex flex-row items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Alert History</h3>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Recently dispatched node messages.</p>
                    </div>
                    <Badge className="bg-primary/5 text-primary border-none text-[8px] font-black px-3 h-6 uppercase tracking-widest">Archive</Badge>
                 </CardHeader>
                 <CardContent className="p-0 flex-1 overflow-y-auto no-scrollbar">
                    <div className="divide-y divide-zinc-50">
                       {broadcastHistory?.map((log) => {
                         const detailsMatch = log.details.match(/\[(.*?)\] (.*?): (.*)/);
                         const target = detailsMatch?.[1] || 'ALL';
                         const subject = detailsMatch?.[2] || log.details.split(':')[0];
                         const message = detailsMatch?.[3] || log.details.split(':').slice(1).join(':').trim();

                         return (
                           <div key={log.id} className="p-5 sm:p-6 flex items-start justify-between group hover:bg-zinc-50/50 transition-colors">
                              <div className="flex items-start gap-4">
                                 <div>
                                    <div className="flex items-center gap-2 mb-1">
                                       <span className="text-xs font-black uppercase text-zinc-900 line-clamp-1">{subject}</span>
                                       <Badge variant="outline" className="text-[7px] font-bold border-zinc-200 uppercase shrink-0">{target}</Badge>
                                    </div>
                                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-tight line-clamp-2 leading-relaxed">
                                       {message}
                                    </p>
                                 </div>
                              </div>
                              <div className="flex flex-col items-end gap-3 shrink-0 ml-4">
                                 <div className="text-right">
                                    <p className="text-[10px] font-black text-zinc-900 uppercase">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-1">{new Date(log.timestamp).toLocaleDateString('en-KE')}</p>
                                 </div>
                                 <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  onClick={() => {
                                    setBroadcastTarget(target);
                                    setBroadcastTitle(subject);
                                    setBroadcastMessage(message);
                                    toast({ title: "Template Loaded" });
                                  }}
                                  className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest bg-zinc-50 text-zinc-400 hover:text-primary hover:bg-primary/5 transition-all gap-1.5"
                                 >
                                    <Copy className="w-3 h-3" /> Reuse
                                 </Button>
                              </div>
                           </div>
                         );
                       })}
                    </div>
                 </CardContent>
              </Card>
           </div>
</TabsContent>
        <TabsContent value="stations" className="px-2"><section className="space-y-4">
<div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-base font-semibold text-zinc-900">POS Stations</h2><p className="mt-1 text-sm text-zinc-500">Register and manage terminals used by Lounge, Store and Carwash teams.</p></div><Badge variant="outline" className="w-fit">{terminals?.length || 0} registered stations</Badge></div>
<Card className="rounded-lg border border-zinc-200 shadow-sm"><CardContent className="p-4 sm:p-5"><form onSubmit={(event) => { event.preventDefault(); void handleProvisionStation(); }} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
<div className="space-y-1.5"><Label htmlFor="new-terminal-name">Station name</Label><Input id="new-terminal-name" value={newTerminalName} onChange={(event) => setNewTerminalName(event.target.value)} placeholder="e.g. Store Counter 02" className="h-10 rounded-md" required /></div>
<div className="space-y-1.5"><Label htmlFor="new-terminal-unit">Business unit</Label><Select value={newTerminalUnit} onValueChange={(value) => setNewTerminalUnit(value as BusinessUnit)}><SelectTrigger id="new-terminal-unit" className="h-10 rounded-md"><SelectValue placeholder="Select unit" /></SelectTrigger><SelectContent>{UNITS.map(unit => <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>)}</SelectContent></Select></div>
<Button type="submit" disabled={!newTerminalName.trim()} className="h-10 rounded-md px-5">Register station</Button></form></CardContent></Card>
<Card className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"><CardHeader className="border-b border-zinc-100 px-4 py-3 sm:px-5"><CardTitle className="text-sm font-semibold">Registered terminals</CardTitle><CardDescription className="text-xs">Availability and last activity from the terminal registry.</CardDescription></CardHeader><CardContent className="p-0"><div className="divide-y divide-zinc-100">
{(terminals || []).length ? terminals!.map((terminal) => <div key={terminal.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600"><Monitor className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-zinc-900">{terminal.name || "Unnamed station"}</p><p className="mt-0.5 text-xs text-zinc-500">{UNITS.find(unit => unit.value === terminal.unit)?.label || terminal.unit} · {terminal.lastActive ? "Last active " + new Date(terminal.lastActive).toLocaleString("en-KE") : "No activity recorded"}</p></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><Badge variant="outline" className={cn("rounded-md text-[10px]", terminal.status === "OPEN" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-600")}>{terminal.status || "UNKNOWN"}</Badge><Button type="button" variant="outline" size="sm" className="h-9 rounded-md text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setTerminalToDelete({ id: terminal.id, name: terminal.name || "Unnamed station" })}><Trash2 className="mr-2 h-3.5 w-3.5" />Remove</Button></div></div>) : <div className="px-5 py-12 text-center text-sm text-zinc-500">No POS stations have been registered yet.</div>}
</div></CardContent></Card></section></TabsContent>
<TabsContent value="config" className="px-2"><section className="space-y-4">
<div className="rounded-lg border border-zinc-200 bg-white p-4 sm:px-5"><h2 className="text-base font-semibold text-zinc-900">Global Settings</h2><p className="mt-1 text-sm text-zinc-500">Configure business-wide rates, payment credentials and workspace appearance.</p></div>
<Card className="rounded-lg border border-zinc-200 bg-white shadow-sm"><CardHeader className="border-b border-zinc-100 px-4 py-4 sm:px-5"><CardTitle className="text-sm font-semibold">Operational rates</CardTitle><CardDescription className="text-xs">Rates are stored in the shared system configuration.</CardDescription></CardHeader><CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5"><div className="space-y-1.5"><Label htmlFor="commission-standard">Standard commission (KES)</Label><Input id="commission-standard" inputMode="decimal" value={localConfig.commissionStandard} onChange={event => setLocalConfig(prev => ({ ...prev, commissionStandard: event.target.value }))} className="h-10 rounded-md" /></div><div className="space-y-1.5"><Label htmlFor="commission-night">Night shift commission (KES)</Label><Input id="commission-night" inputMode="decimal" value={localConfig.commissionNightShift} onChange={event => setLocalConfig(prev => ({ ...prev, commissionNightShift: event.target.value }))} className="h-10 rounded-md" /></div></CardContent></Card>
<Card className="rounded-lg border border-zinc-200 bg-white shadow-sm"><CardHeader className="border-b border-zinc-100 px-4 py-4 sm:px-5"><CardTitle className="text-sm font-semibold">Payment gateway</CardTitle><CardDescription className="text-xs">Secret credentials are masked while editing.</CardDescription></CardHeader><CardContent className="grid grid-cols-1 gap-4 p-4 sm:p-5"><div className="space-y-1.5"><Label htmlFor="paystack-public-key">Paystack public key</Label><Input id="paystack-public-key" value={localConfig.paystackPublicKeyLive} onChange={event => setLocalConfig(prev => ({ ...prev, paystackPublicKeyLive: event.target.value }))} placeholder="pk_live_…" className="h-10 rounded-md font-mono text-xs" /></div><div className="space-y-1.5"><Label htmlFor="paystack-secret-key">Paystack secret key</Label><Input id="paystack-secret-key" type="password" autoComplete="new-password" value={localConfig.paystackSecretKeyLive} onChange={event => setLocalConfig(prev => ({ ...prev, paystackSecretKeyLive: event.target.value }))} placeholder="Enter a new secret key to replace the stored value" className="h-10 rounded-md font-mono text-xs" /></div></CardContent></Card>
<Card className="rounded-lg border border-zinc-200 bg-white shadow-sm"><CardHeader className="border-b border-zinc-100 px-4 py-4 sm:px-5"><CardTitle className="text-sm font-semibold">Workspace appearance</CardTitle><CardDescription className="text-xs">Choose the global seasonal visual treatment.</CardDescription></CardHeader><CardContent className="p-4 sm:p-5"><div className="max-w-sm space-y-1.5"><Label htmlFor="visual-theme">Visual theme</Label><Select value={localConfig.visualTheme} onValueChange={value => setLocalConfig(prev => ({ ...prev, visualTheme: value }))}><SelectTrigger id="visual-theme" className="h-10 rounded-md"><SelectValue placeholder="Select appearance" /></SelectTrigger><SelectContent><SelectItem value="NONE">Standard</SelectItem><SelectItem value="SNOW">Snowfall</SelectItem><SelectItem value="CELEBRATION">Celebration</SelectItem></SelectContent></Select></div></CardContent></Card>
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-zinc-500">Save changes to synchronize the shared system configuration.</p><Button type="button" onClick={handleSaveAll} disabled={isSubmitting} className="h-10 rounded-md px-5">{isSubmitting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save global settings</Button></div>
</section></TabsContent>
<AlertDialog open={!!terminalToDelete} onOpenChange={(open) => { if (!open) setTerminalToDelete(null); }}><AlertDialogContent className="rounded-lg"><AlertDialogHeader><AlertDialogTitle>Remove POS station?</AlertDialogTitle><AlertDialogDescription>This removes {terminalToDelete?.name || "this station"} from the registered terminal list. The action is recorded in the audit log.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteTerminal} className="rounded-md bg-red-600 text-white hover:bg-red-700">Remove station</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </Tabs>
    </div>
  );
}

function KPIBox({ title, value, sub, icon: Icon, color = "text-zinc-900" }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white p-8 border border-zinc-100">
       <div className="flex items-center gap-3 mb-3">
          <Icon className={cn("w-5 h-5", color)} />
          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{title}</p>
       </div>
       <h3 className={cn("text-3xl font-black font-headline tracking-tighter leading-none", color)}>{value}</h3>
       <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-2">{sub}</p>
    </Card>
  );
}

function UnitPill({ label, active, onClick, icon: Icon }: any) {
  return (
    <button onClick={onClick} className={cn("h-11 px-6 rounded-xl flex items-center gap-2.5 transition-all text-[9px] font-black uppercase tracking-widest", active ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}>
       <Icon className={cn("w-3.5 h-3.5", active ? "text-primary" : "text-zinc-200")} />
       {label}
    </button>
  );
}

function DatePill({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={cn("h-11 px-6 rounded-xl transition-all text-[9px] font-black uppercase tracking-widest", active ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}>
       {label}
    </button>
  );
}
