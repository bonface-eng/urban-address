
'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  Database, 
  Activity, 
  RefreshCcw,
  Zap,
  HardDrive,
  History,
  Cloud,
  Wifi,
  Globe,
  HardDriveDownload,
  Fingerprint,
  ChevronRight,
  ClipboardList,
  Boxes,
  Users,
  UserCheck,
  Cpu,
  CreditCard,
  Camera,
  RotateCcw,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Progress } from '@/components/ui/progress';
import { AuditLog, Product, UserProfile } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { 
  reconcileHistoricalStock, 
  checkAdminStatus, 
  testCloudflareConnection,
  backupInventory,
  restoreInventory 
} from '@/lib/actions';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const HISTORICAL_SPLIT_TIMESTAMP = 1788522120000;

export default function DatabaseMetricsPage() {
  const firestore = useFirestore();
  const { isSuperAdmin, profile } = useProfile();
  const [mounted, setMounted] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isVerifyingCloud, setIsVerifyingCloud] = useState(false);
  const [adminStatus, setAdminStatus] = useState<{ active: boolean; label: string }>({ active: false, label: 'OFFLINE' });
  const [cfStatus, setCfStatus] = useState<'IDLE' | 'CONNECTED' | 'ERROR'>('IDLE');
  
  const [syncUnit, setSyncUnit] = useState<'ALL' | 'LOUNGE' | 'STORE'>('LOUNGE');
  const [syncDatePreset, setSyncDatePreset] = useState<'LAUNCH' | 'ALL_TIME' | '7_DAYS' | '30_DAYS'>('LAUNCH');

  useEffect(() => {
    setMounted(true);
    const verifyService = async () => {
      try {
        const res = await checkAdminStatus();
        setAdminStatus({ active: res.success, label: res.success ? 'ONLINE' : 'OFFLINE' });
      } catch {
        setAdminStatus({ active: false, label: 'OFFLINE' });
      }
    };

    void verifyService();
    void handleVerifyCloud();
    // Recheck actual service connectivity while the telemetry page remains open.
    const healthInterval = window.setInterval(() => {
      void verifyService();
      void handleVerifyCloud();
    }, 60_000);

    return () => window.clearInterval(healthInterval);
  }, []);

  const handleVerifyCloud = async () => {
    setIsVerifyingCloud(true);
    try {
      const res = await testCloudflareConnection();
      setCfStatus(res.success ? 'CONNECTED' : 'ERROR');
    } catch (e) {
      setCfStatus('ERROR');
    } finally {
      setIsVerifyingCloud(false);
    }
  };

  const getEffectiveStartTime = (): number => {
    if (syncDatePreset === 'LAUNCH') return HISTORICAL_SPLIT_TIMESTAMP;
    if (syncDatePreset === 'ALL_TIME') return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    if (syncDatePreset === '7_DAYS') return Date.now() - 7 * dayMs;
    if (syncDatePreset === '30_DAYS') return Date.now() - 30 * dayMs;
    return HISTORICAL_SPLIT_TIMESTAMP;
  };

  const auditQuery = useMemoFirebase(() => firestore && isSuperAdmin ? query(collection(firestore, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50)) : null, [firestore, isSuperAdmin]);
  const ordersQuery = useMemoFirebase(() => firestore && isSuperAdmin ? collection(firestore, 'orders') : null, [firestore, isSuperAdmin]);
  const inventoryQuery = useMemoFirebase(() => firestore && isSuperAdmin ? collection(firestore, 'inventory') : null, [firestore, isSuperAdmin]);
  const usersQuery = useMemoFirebase(() => firestore && isSuperAdmin ? collection(firestore, 'users') : null, [firestore, isSuperAdmin]);
  const backupsQuery = useMemoFirebase(() => firestore && isSuperAdmin ? query(collection(firestore, 'inventory_backups'), orderBy('timestamp', 'desc'), limit(5)) : null, [firestore, isSuperAdmin]);

  const { data: logs, loading: logsLoading, error: logsError } = useCollection<AuditLog>(auditQuery);
  const { data: orders, loading: ordersLoading, error: ordersError } = useCollection<any>(ordersQuery);
  const { data: inventory } = useCollection<Product>(inventoryQuery);
  const { data: users } = useCollection<UserProfile>(usersQuery);
  const { data: backups } = useCollection<any>(backupsQuery);

  const stats = useMemo(() => {
    const distribution = [
      { name: 'Audit Logs', value: logs?.length || 0, color: 'hsl(var(--primary))' },
      { name: 'Sales Orders', value: orders?.length || 0, color: 'hsl(240, 5.9%, 10%)' },
      { name: 'Inventory', value: inventory?.length || 0, color: 'hsl(240, 5.9%, 40%)' },
      { name: 'User Profiles', value: users?.length || 0, color: 'hsl(240, 5.9%, 70%)' },
    ];

    return { distribution };
  }, [logs, orders, inventory, users]);

  const handleRunReconciliation = async () => {
    const startTime = getEffectiveStartTime();
    const warningMsg = syncDatePreset === 'ALL_TIME' 
      ? "Proceed with ALL-TIME sync? This may double-deduct items already manually restocked."
      : `Sync confirmed from ${new Date(startTime).toLocaleDateString()}. Proceed?`;

    if (!confirm(warningMsg)) return;

    setIsReconciling(true);
    try {
      const result = await reconcileHistoricalStock(startTime, syncUnit);
      if (result.success) {
        toast({ title: "Inventory Handshake", description: result.message });
      } else {
        toast({ variant: "destructive", title: "Sync Interrupted", description: result.message });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action Blocked", description: "Node reported an internal processing error." });
    } finally {
      setIsReconciling(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!profile) return;
    setIsBackingUp(true);
    try {
      const res = await backupInventory(profile.uid, profile.displayName);
      if (res.success) {
        toast({ title: "Snapshot Captured", description: `Registry image #${res.id?.slice(-6).toUpperCase()} stored.` });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Backup Failed" });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!isSuperAdmin) return;
    if (!confirm("CRITICAL: This will overwrite your entire current inventory with the snapshot data. ALL changes made since the backup will be lost. Proceed?")) return;

    setIsRestoring(id);
    try {
      const res = await restoreInventory(id, profile?.uid || 'ADMIN');
      if (res.success) {
        toast({ title: "Node Restored", description: res.message });
      } else {
        throw new Error(res.message);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Restore Failed", description: e.message });
    } finally {
      setIsRestoring(null);
    }
  };

  if (!mounted) return null;
  if (!isSuperAdmin) return <div className="p-20 text-center uppercase font-black">Unauthorized Node</div>;

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto pt-4 px-2 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Fingerprint className="w-4 h-4 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Master Infrastructure Node</span>
          </div>
          <PageHeader title="System Telemetry" breadcrumb={["Admin", "System Telemetry"]} className="mb-0" />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn(
            "h-10 px-4 gap-2 font-black uppercase text-[9px] tracking-widest shadow-sm rounded-xl bg-white",
            adminStatus.active ? "border-green-100 text-green-600" : "border-red-100 text-red-600"
          )}>
             <div className={cn("w-1.5 h-1.5 rounded-full", adminStatus.active ? "bg-green-50 animate-pulse" : "bg-red-500")} />
             URBAN EXPRESS SERVER: {adminStatus.label}
          </Badge>
          <Badge variant="outline" className={cn(
            "h-10 px-4 gap-2 font-black uppercase text-[9px] tracking-widest shadow-sm rounded-xl bg-white",
            cfStatus === 'CONNECTED' ? "border-green-100 text-green-600" : "border-red-100 text-red-600"
          )}>
             <div className={cn("w-1.5 h-1.5 rounded-full", cfStatus === 'CONNECTED' ? "bg-green-500 animate-pulse" : "bg-red-500")} />
             CLOUDFLARE: {cfStatus}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-1">
         <InfrastructureMetric label="Operational order records" value={ordersLoading ? '—' : (orders?.length ?? 0).toLocaleString()} status={ordersError ? 'Listener error' : ordersLoading ? 'Connecting' : 'Live subscription'} healthy={!ordersError && !ordersLoading} icon={Database} />
         <InfrastructureMetric label="Inventory records" value={inventory?.length?.toLocaleString?.() ?? '—'} status="Live collection snapshot" healthy={Boolean(inventory)} icon={Boxes} />
         <InfrastructureMetric label="Staff profiles" value={users?.length?.toLocaleString?.() ?? '—'} status="Live collection snapshot" healthy={Boolean(users)} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-1">
        <Card className="lg:col-span-8 border-none shadow-mobile rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden border border-white/5 flex flex-col h-[600px]">
           <CardHeader className="p-8 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Live Server Request Log</CardTitle>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Real-time forensic synchronization stream</p>
              </div>
              <Activity className="w-5 h-5 text-zinc-600 animate-pulse" />
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                 <div className="divide-y divide-white/5">
                    {logs?.map((log) => (
                      <div key={log.id} className="p-5 flex items-start justify-between group hover:bg-white/5 transition-all">
                         <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/10",
                              log.severity === 'CRITICAL' ? "bg-red-500/10 text-red-500" :
                              log.severity === 'WARNING' ? "bg-amber-500/10 text-amber-500" :
                              "bg-white/5 text-zinc-400"
                            )}>
                               <History className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[11px] font-black uppercase text-white tracking-tighter">{log.action}</span>
                                  <Badge variant="outline" className="text-[7px] font-bold border-white/10 text-zinc-500 uppercase h-4 px-1.5">{log.severity}</Badge>
                               </div>
                               <p className="text-[10px] text-zinc-400 uppercase leading-relaxed line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                  {log.details}
                                </p>
                            </div>
                         </div>
                         <div className="text-right shrink-0 ml-6">
                            <p className="text-[10px] font-black text-zinc-300 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                            <div className="flex items-center justify-end gap-1.5 mt-1 text-zinc-600">
                               <UserCheck className="w-3 h-3" />
                               <span className="text-[8px] font-black uppercase tracking-tighter truncate max-w-[60px]">{log.userId.slice(0, 8)}</span>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </ScrollArea>
           </CardContent>
           <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0">
              <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Stream: {logsError ? 'Degraded' : logsLoading ? 'Connecting' : 'Subscribed'} • {logs?.length || 0} recent events</p>
              <div className="flex items-center gap-2">
                 <div className={cn('w-2 h-2 rounded-full', logsError ? 'bg-red-500' : logsLoading ? 'bg-amber-500' : 'bg-green-500 animate-pulse')} />
                 <span className={cn('text-[8px] font-black uppercase', logsError ? 'text-red-500' : logsLoading ? 'text-amber-500' : 'text-green-500')}>{logsError ? 'Listener Error' : logsLoading ? 'Connecting' : 'Live Feed'}</span>
              </div>
           </div>
        </Card>

        <Card className="lg:col-span-4 border-none shadow-mobile rounded-[2.5rem] bg-white border border-zinc-100 overflow-hidden flex flex-col h-[600px]">
           <CardHeader className="p-8 border-b border-zinc-50">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Node Data Weights</CardTitle>
           </CardHeader>
           <CardContent className="p-8 flex-1 flex flex-col items-center justify-center">
              <div className="h-[250px] w-full mb-8">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie data={stats.distribution} innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                          {stats.distribution.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                       </Pie>
                       <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', textTransform: 'uppercase' }} />
                    </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                 {stats.distribution.map((item) => (
                    <div key={item.name} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 group hover:border-primary/20 transition-all">
                       <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{item.name}</span>
                       </div>
                       <p className="text-xl font-black text-zinc-900">{item.value.toLocaleString()}</p>
                    </div>
                 ))}
              </div>
           </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-1">
        {/* SNAPSHOT MANAGEMENT */}
        <Card className="lg:col-span-5 border-none shadow-mobile rounded-[2.5rem] bg-white border border-zinc-100 overflow-hidden flex flex-col">
           <CardHeader className="p-8 border-b border-zinc-50 flex items-center justify-between">
              <div>
                 <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Inventory Snapshots</CardTitle>
                 <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Registry backup & restore nodes</p>
              </div>
              <Camera className="w-5 h-5 text-primary" />
           </CardHeader>
           <CardContent className="p-8 space-y-6 flex-1">
              <Button 
                onClick={handleCreateBackup} 
                disabled={isBackingUp}
                className="w-full h-14 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest shadow-xl gap-2 active:scale-95"
              >
                 {isBackingUp ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 text-primary" />}
                 Capture Current Registry
              </Button>

              <div className="space-y-3">
                 <p className="text-[8px] font-black uppercase text-zinc-300 tracking-widest px-1">Recent Snapshots</p>
                 <div className="space-y-2">
                    {backups?.map((b: any) => (
                      <div key={b.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:border-primary/20 transition-all">
                         <div className="min-w-0">
                            <p className="text-[10px] font-black text-zinc-900 uppercase truncate">#{b.id.slice(-6).toUpperCase()} • {b.itemCount} Items</p>
                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                              {new Date(b.timestamp).toLocaleDateString()} • By {b.createdByName?.split(' ')[0]}
                            </p>
                         </div>
                         <Button 
                           onClick={() => handleRestore(b.id)} 
                           disabled={!!isRestoring}
                           variant="ghost" 
                           className="h-9 px-3 text-primary hover:bg-primary/5 rounded-xl gap-2 text-[9px] font-black uppercase"
                         >
                            {isRestoring === b.id ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Restore
                         </Button>
                      </div>
                    ))}
                    {(!backups || backups.length === 0) && (
                      <div className="py-12 text-center opacity-20 border-2 border-dashed border-zinc-100 rounded-2xl">
                         <p className="text-[9px] font-black uppercase">No backups recorded</p>
                      </div>
                    )}
                 </div>
              </div>
           </CardContent>
        </Card>

        {/* RECONCILIATION WITH SAFETY NET */}
        <Card className="lg:col-span-7 border-none shadow-mobile rounded-[2.5rem] bg-white border border-zinc-100 overflow-hidden flex flex-col">
           <CardHeader className="p-8 border-b border-zinc-50">
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900">Maintenance & Reconciliation</CardTitle>
           </CardHeader>
           <CardContent className="p-8 space-y-6 flex-1 flex flex-col justify-center">
              <div className="p-6 bg-zinc-50 rounded-[2.5rem] border border-zinc-100 space-y-6">
                 <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary shrink-0 border border-zinc-50">
                       <RefreshCcw className="w-6 h-6" />
                    </div>
                    <div>
                       <h4 className="text-sm font-black uppercase text-zinc-900">Historical Stock Sync</h4>
                       <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed mt-1">
                         Re-calculates physical stock balances using historical "PAID" records. 
                         <span className="text-amber-600 block mt-1">SAFETY NET: Sync is gated by temporal range to avoid erasing manual restocks.</span>
                       </p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Dept. Scope</Label>
                       <Select value={syncUnit} onValueChange={(v: any) => setSyncUnit(v)}>
                          <SelectTrigger className="h-12 bg-white border-zinc-200 rounded-xl text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                             <SelectItem value="LOUNGE" className="text-[10px] font-black">LOUNGE STATION</SelectItem>
                             <SelectItem value="STORE" className="text-[10px] font-black">RETAIL STATION</SelectItem>
                             <SelectItem value="ALL" className="text-[10px] font-black">ALL LOCATIONS</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Temporal Range (Checkpoint)</Label>
                       <Select value={syncDatePreset} onValueChange={(v: any) => setSyncDatePreset(v)}>
                          <SelectTrigger className="h-12 bg-white border-zinc-200 rounded-xl text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                             <SelectItem value="LAUNCH" className="text-[10px] font-black">SINCE SYSTEM LAUNCH</SelectItem>
                             <SelectItem value="7_DAYS" className="text-[10px] font-black">LAST 7 DAYS ONLY</SelectItem>
                             <SelectItem value="30_DAYS" className="text-[10px] font-black">LAST 30 DAYS ONLY</SelectItem>
                             <SelectItem value="ALL_TIME" className="text-[10px] font-black text-red-500">FULL HISTORY (DANGEROUS)</SelectItem>
                          </SelectContent>
                       </Select>
                    </div>
                 </div>

                 <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[8px] font-bold text-amber-700 uppercase leading-relaxed">
                       CAUTION: Synchronizing with "Full History" will recalculate every sale ever made. 
                       If you performed manual stock-takes recently, choose "Last 7 Days" to avoid double-deductions.
                    </p>
                 </div>

                 <Button 
                    onClick={handleRunReconciliation}
                    disabled={isReconciling}
                    className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95 gap-3"
                 >
                    {isReconciling ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4 text-primary" />}
                    {isReconciling ? 'SYNCHRONIZING NODE...' : 'Execute Checked Stock Sync'}
                 </Button>
              </div>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfrastructureMetric({ label, value, status, healthy, icon: Icon }: any) {
  return (
    <Card className="border border-zinc-100 shadow-sm rounded-2xl bg-white p-5 flex flex-col justify-between min-h-[132px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
        <Icon className="w-4 h-4 text-zinc-400" />
      </div>
      <p className="text-2xl font-black tracking-tight text-zinc-900 tabular-nums">{value}</p>
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', healthy ? 'bg-emerald-500' : 'bg-amber-500')} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{status}</span>
      </div>
    </Card>
  );
}
