'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
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
import { UserRole, AuditLog, BusinessUnit, UserProfile, POSTerminal } from '@/lib/types';
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

const ACCESS_PAGES = [
  // Hub 1: Operations
  { label: 'Dashboard Overview', href: '/dashboard', icon: LayoutDashboard, group: 'Operations' },
  { label: 'Kitchen Board', href: '/kds', icon: ChefHat, group: 'Operations' },
  { label: 'Lounge Station', href: '/lounge', icon: Coffee, group: 'Operations' },
  { label: 'Retail Station', href: '/store', icon: Store, group: 'Operations' },
  { label: 'Carwash Station', href: '/carwash/pos', icon: MonitorPlay, group: 'Operations' },
  
  // Hub 2: Intelligence
  { label: 'Intelligence Hub', href: '/admin/hubs/intelligence', icon: LayoutGrid, group: 'Intelligence' },
  { label: 'AI Analyst', href: '/admin/intelligence', icon: Bot, group: 'Intelligence' },
  { label: 'Security Monitoring', href: '/reports/fraud', icon: ShieldAlert, group: 'Intelligence' },
  { label: 'System Health', href: '/admin/database', icon: HardDrive, group: 'Intelligence' },

  // Hub 3: Staff
  { label: 'Staff Hub', href: '/admin/hubs/staff', icon: Users, group: 'Staff' },
  { label: 'Team List', href: '/employees', icon: Users, group: 'Staff' },
  { label: 'Team Metrics', href: '/attendants', icon: UserCircle, group: 'Staff' },
  { label: 'Staff Payroll', href: '/admin/payroll', icon: Banknote, group: 'Staff' },

  // Hub 4: Finance
  { label: 'Finance Hub', href: '/admin/hubs/finance', icon: DollarSign, group: 'Finance' },
  { label: 'Sales', href: '/sales-history', icon: ClipboardList, group: 'Finance' },
  { label: 'Petty Cash', href: '/finance', icon: Receipt, group: 'Finance' },
  { label: 'Business Reports', href: '/reports', icon: BarChart3, group: 'Finance' },
  { label: 'Customer CRM', href: '/customers', icon: Contact, group: 'Finance' },

  // Hub 5: Logistics
  { label: 'Logistics Hub', href: '/admin/hubs/logistics', icon: Package, group: 'Logistics' },
  { label: 'Inventory Catalog', href: '/inventory', icon: Package, group: 'Logistics' },
  { label: 'Supplier Network', href: '/suppliers', icon: Truck, group: 'Logistics' },
  { label: 'Service Queue', href: '/carwash', icon: Car, group: 'Logistics' },

  // Hub 6: Governance
  { label: 'Governance Hub', href: '/admin/hubs/governance', icon: ShieldCheck, group: 'Governance' },
  { label: 'Access Matrix', href: '/admin', icon: Terminal, group: 'Governance' },
  { label: 'Support Inbox', href: '/admin/support', icon: MessageSquare, group: 'Governance' },
  { label: 'OS Documents', href: '/admin/documents', icon: FileText, group: 'Governance' },
  { label: 'Operations Guide', href: '/admin/help', icon: BookOpen, group: 'Governance' },
];

export default function AdminPanel() {
  const { isSuperAdmin, profile } = useProfile();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [terminalToDelete, setTerminalToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<string | 'ALL_STAFF'>('ALL_STAFF');

  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalUnit, setNewTerminalUnit] = useState<BusinessUnit>('STORE');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Guard document requests with user session to prevent permission errors
  const permissionsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'permissions');
  }, [firestore, user]);

  const configRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'system', 'config');
  }, [firestore, user]);

  const { data: permMap } = useDoc<any>(permissionsRef);
  const { data: remoteConfig } = useDoc<any>(configRef);

  const [localPerms, setLocalPerms] = useState<Record<string, string[]>>({});
  const [isPermsLoaded, setIsPermsLoaded] = useState(false);

  const [localConfig, setLocalConfig] = useState({
    commissionStandard: '30.00',
    commissionNightShift: '50.00',
    paystackPublicKeyLive: '',
    paystackSecretKeyLive: '',
    visualTheme: 'NONE'
  });
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const terminalsRef = useMemo(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'pos_terminals');
  }, [firestore, user]);

  const { data: terminals } = useCollection<POSTerminal>(terminalsRef);

  const staffQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
  const { data: allStaff } = useCollection<UserProfile>(staffQuery);

  const broadcastHistoryQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'audit_logs'),
      where('action', '==', 'INTERNAL_BROADCAST'),
      orderBy('timestamp', 'desc'),
      limit(15)
    );
  }, [firestore, user]);
  const { data: broadcastHistory } = useCollection<AuditLog>(broadcastHistoryQuery);

  useEffect(() => {
    if (permMap && !isPermsLoaded) {
      setLocalPerms(permMap);
      setIsPermsLoaded(true);
    }
  }, [permMap, isPermsLoaded]);

  useEffect(() => {
    if (remoteConfig && !isConfigLoaded) {
      setLocalConfig(prev => ({ ...prev, ...remoteConfig }));
      setIsConfigLoaded(true);
    }
  }, [remoteConfig, isConfigLoaded]);

  const togglePermission = (role: string, href: string) => {
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
    <div className="space-y-8 pb-24 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2 pt-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">System Governance</span>
          </div>
          <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">ADMIN HUB</h1>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className="h-12 px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-2 transition-all active:scale-95"
          >
            {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-primary" />}
            Save OS Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="matrix" className="w-full">
        <div className="px-2 overflow-x-auto no-scrollbar pb-2">
          <TabsList className="bg-white p-1 rounded-[1.5rem] h-14 mb-4 shadow-sm border border-zinc-100 flex w-max min-w-full lg:w-full">
            <TabsTrigger value="matrix" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Access Matrix</TabsTrigger>
            <TabsTrigger value="staff" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Staff Registry</TabsTrigger>
            <TabsTrigger value="broadcasting" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Internal Alerts</TabsTrigger>
            <TabsTrigger value="stations" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">POS Stations</TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl h-full px-5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Global Settings</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="matrix" className="px-2">
           <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100">
             <div className="p-6 sm:p-8 border-b border-zinc-50">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Permission Registry</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Define role-based visibility across operational hubs.</p>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                         <th className="p-4 sm:p-6 text-[10px] font-black uppercase text-zinc-400 tracking-widest min-w-[220px] sticky left-0 bg-zinc-50 z-10">Module Identifier</th>
                         {ROLES.map(role => (
                           <th key={role} className="p-4 sm:p-6 text-[10px] font-black uppercase text-zinc-900 tracking-widest text-center min-w-[90px]">{role}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-50">
                      {ACCESS_PAGES.map((page, pIdx) => {
                        const showGroupLabel = pIdx === 0 || ACCESS_PAGES[pIdx - 1].group !== page.group;
                        return (
                          <React.Fragment key={page.href}>
                            {showGroupLabel && (
                              <tr className="bg-zinc-50/50">
                                <td colSpan={ROLES.length + 1} className="p-3 px-6">
                                   <span className="text-[9px] font-black uppercase text-primary tracking-[0.3em]">{page.group} HUB</span>
                                </td>
                              </tr>
                            )}
                            <tr className="group hover:bg-zinc-50/50 transition-colors">
                               <td className="p-4 sm:p-6 sticky left-0 bg-white group-hover:bg-zinc-50/50 transition-colors z-10">
                                  <div className="flex items-center gap-3">
                                     <page.icon className="w-4 h-4 text-zinc-300" />
                                     <span className="text-[11px] font-black uppercase text-zinc-600 whitespace-nowrap">{page.label}</span>
                                  </div>
                               </td>
                               {ROLES.map(role => {
                                 const isAllowed = localPerms && localPerms[role] && localPerms[role].includes(page.href);
                                 return (
                                   <td key={role} className="p-4 sm:p-6 text-center">
                                      <button 
                                        onClick={() => togglePermission(role, page.href)}
                                        className={cn(
                                          "w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all shadow-sm border",
                                          isAllowed ? "bg-primary border-primary shadow-primary/20 text-white" : "bg-white border-zinc-100 text-zinc-200"
                                        )}
                                      >
                                         {isAllowed ? <Check className="w-4 h-4 stroke-[3] text-white" /> : <Zap className="w-4 h-4" />}
                                      </button>
                                   </td>
                                 );
                               })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                   </tbody>
                </table>
             </div>
           </Card>
        </TabsContent>

        <TabsContent value="staff" className="px-2">
           <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white overflow-hidden border border-zinc-100">
              <div className="p-6 sm:p-8 border-b border-zinc-50 flex items-center justify-between">
                 <h3 className="text-sm font-black uppercase tracking-widest">Personnel Registry</h3>
                 <div className="flex items-center gap-3">
                   <Badge className="bg-zinc-100 text-zinc-400 uppercase font-black text-[8px] px-3">{allStaff?.length} Members</Badge>
                   <a href="/employees" className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[9px] font-black uppercase border border-zinc-100 text-zinc-400 bg-white hover:text-primary hover:border-primary/30 transition-colors">
                     Manage Team
                   </a>
                 </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                   <TableHeader className="bg-zinc-50/50">
                      <TableRow>
                         <TableHead className="pl-8 h-14 text-[10px] font-black uppercase">Identity</TableHead>
                         <TableHead className="h-14 text-[10px] font-black uppercase text-center">System Role</TableHead>
                         <TableHead className="h-14 text-[10px] font-black uppercase text-center">Station Authorization</TableHead>
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
                                        <span className="text-[8px] font-black text-zinc-400 uppercase">Global Hub</span>
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
                             <TableCell className="pr-8 text-right text-[10px] font-bold text-zinc-400">{new Date(s.createdAt).toLocaleDateString('en-KE')}</TableCell>
                          </TableRow>
                        );
                      })}
                   </TableBody>
                </Table>
              </div>
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
                    <div className="space-y-4">
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
