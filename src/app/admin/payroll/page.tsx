'use client';

import { PageHeader } from '@/components/shared/page-layout';

import { useBusinessClock } from '@/hooks/use-business-clock';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Banknote, 
  Coins, 
  Download, 
  Printer, 
  Search, 
  ShieldAlert, 
  TrendingUp, 
  Users, 
  Calendar,
  ChevronRight,
  Filter,
  RefreshCcw,
  UserCheck,
  History,
  Activity,
  FileText,
  Save,
  Wallet,
  Receipt,
  FileDown,
  Plus,
  ArrowDownCircle,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile, CarwashJob, Order } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { exportAsReceiptText } from '@/lib/csv-export';
import { ReceiptPreview } from '@/components/pos/receipt-preview';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription, 
  DialogHeader, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { createPaystackRecipient } from '@/lib/actions';

const PAYSTACK_TRANSFERS_URL = "https://dashboard.paystack.com/#/transfers";

export default function PayrollManagementPage() {
  const firestore = useFirestore();
  const { isSuperAdmin, profile } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL'>('TODAY');
  const [isExporting, setIsExporting] = useState(false);
  const [updatingSalaryId, setUpdatingSalaryId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
  const [isPayoutConfirmOpen, setIsPayoutConfirmOpen] = useState(false);
  const [payoutData, setPayoutData] = useState<any>(null);
  const [selectedStaffForPayout, setSelectedStaffForPayout] = useState<any>(null);
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);
  const [isSyncingPaystack, setIsSyncingPaystack] = useState<string | null>(null);
  const [initiatedPayouts, setInitiatedPayouts] = useState<Set<string>>(new Set());

  // Advance Form State
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceUserId, setAdvanceUserId] = useState('');

  const staffQuery = useMemoFirebase(() => {
    if (!firestore || !isSuperAdmin) return null;
    return query(collection(firestore, 'users'), where('role', '!=', 'CLIENT'));
  }, [firestore, isSuperAdmin]);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !isSuperAdmin) return null;
    return collection(firestore, 'carwash_jobs');
  }, [firestore, isSuperAdmin]);

  const advancesQuery = useMemoFirebase(() => {
    if (!firestore || !isSuperAdmin) return null;
    return query(collection(firestore, 'salary_advances'), orderBy('timestamp', 'desc'));
  }, [firestore, isSuperAdmin]);

  const { data: staff, loading: staffLoading } = useCollection<UserProfile>(staffQuery);
  const { data: allJobs } = useCollection<CarwashJob>(jobsQuery);
  const { data: advances } = useCollection<any>(advancesQuery);

  const { startOfToday } = useBusinessClock();

  const filteredJobsByTime = useMemo(() => {
    if (!allJobs) return [];
    const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
    const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);

    return allJobs.filter(job => {
      if (dateFilter === 'TODAY') return job.timestamp >= startOfToday;
      if (dateFilter === 'YESTERDAY') return job.timestamp >= startOfYesterday && job.timestamp < startOfToday;
      if (dateFilter === 'WEEK') return job.timestamp >= startOfWeek;
      return true;
    });
  }, [allJobs, dateFilter, startOfToday]);

  const payrollData = useMemo(() => {
    if (!staff) return [];
    
    return staff.map(member => {
      const staffJobs = filteredJobsByTime.filter(j => j.attendantId === member.uid || j.attendantId === member.displayName);
      const staffAdvances = advances?.filter((a: any) => a.userId === member.uid) || [];
      
      const isAttendant = member.role === 'ATTENDANT';
      const commissions = staffJobs.reduce((sum, j) => sum + (j.commission || 0), 0);
      const tips = staffJobs.reduce((sum, j) => sum + (j.tip || 0), 0);
      const totalAdvances = staffAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      
      const baseSalary = isAttendant ? 0 : (member.baseSalary || 0);
      const totalYield = baseSalary + commissions + tips - totalAdvances;
      
      return {
        ...member,
        baseSalary,
        commissions,
        tips,
        totalAdvances,
        totalYield,
        jobCount: staffJobs.length
      };
    }).filter(m => m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || m.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [staff, filteredJobsByTime, searchTerm, advances]);

  const totals = useMemo(() => {
    return payrollData.reduce((acc, curr) => ({
      baseSalary: acc.baseSalary + curr.baseSalary,
      commissions: acc.commissions + curr.commissions,
      tips: acc.tips + curr.tips,
      advances: acc.advances + curr.totalAdvances,
      yield: acc.yield + curr.totalYield
    }), { baseSalary: 0, commissions: 0, tips: 0, advances: 0, yield: 0 });
  }, [payrollData]);

  const handleSyncPaystack = async (member: any) => {
    if (!member.mpesaNumber) {
      toast({ variant: "destructive", title: "Missing Number", description: "Set an M-Pesa number in profile." });
      return;
    }

    setIsSyncingPaystack(member.uid);
    try {
      const res = await createPaystackRecipient({
        name: member.displayName,
        account_number: member.mpesaNumber,
        bank_code: 'MPESA',
        description: `Staff: ${member.role}`
      });

      if (res.status) {
        if (firestore) {
          await updateDoc(doc(firestore, 'users', member.uid), {
            paystackRecipientCode: res.data.recipient_code,
            paystackSyncedAt: Date.now()
          });
        }
        toast({ title: "Staff Synced", description: "Ready for payments." });
      } else {
        toast({ variant: "destructive", title: "Error", description: res.message });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "System Error" });
    } finally {
      setIsSyncingPaystack(null);
    }
  };

  const handleProcessPayout = async (member: any) => {
    if (!firestore || !profile) return;
    if (member.totalYield <= 0) {
      toast({ variant: "destructive", title: "Zero Balance", description: "No amount to pay." });
      return;
    }
    setSelectedStaffForPayout(member);
    setIsPayoutConfirmOpen(true);
  };

  const confirmPayoutRedirect = async () => {
    if (!firestore || !profile || !selectedStaffForPayout) return;
    const member = selectedStaffForPayout;

    try {
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PAYOUT_STARTED',
        userId: profile.uid,
        details: `Starting payout for ${member.displayName} (KES ${member.totalYield.toLocaleString()}).`,
        timestamp: Date.now(),
        severity: 'CRITICAL'
      });

      setInitiatedPayouts(prev => new Set(prev).add(member.uid));
      setIsPayoutConfirmOpen(false);
      window.open(PAYSTACK_TRANSFERS_URL, '_blank');
      toast({ title: "Transfer Portal Open" });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    }
  };

  const handleRecordAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile || !advanceUserId || !advanceAmount) return;
    
    setIsSubmittingAdvance(true);
    const selectedStaff = staff?.find(s => s.uid === advanceUserId);
    
    try {
      const advanceData = {
        userId: advanceUserId,
        userName: selectedStaff?.displayName || 'Unknown',
        amount: Number(advanceAmount),
        reason: advanceReason,
        date: advanceDate,
        timestamp: Date.now(),
        issuedBy: profile.uid,
        issuedByName: profile.displayName
      };

      const docRef = await addDoc(collection(firestore, 'salary_advances'), advanceData);

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'SALARY_ADVANCE',
        userId: profile.uid,
        details: `Issued KES ${advanceAmount} advance to ${selectedStaff?.displayName}.`,
        timestamp: Date.now(),
        severity: 'CRITICAL'
      });

      setPayoutData({
        type: 'ADVANCE-VOUCHER',
        id: `ADV-${docRef.id.slice(-6).toUpperCase()}`,
        userName: selectedStaff?.displayName,
        amount: Number(advanceAmount),
        reason: advanceReason,
        timestamp: Date.now(),
        items: [{ name: "Salary Advance", price: Number(advanceAmount), quantity: 1 }]
      });

      setIsAdvanceOpen(false);
      setIsPreviewOpen(true);
      resetAdvanceForm();
      toast({ title: "Advance Saved" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const resetAdvanceForm = () => {
    setAdvanceAmount('');
    setAdvanceReason('');
    setAdvanceUserId('');
  };

  if (!isSuperAdmin) {
    return (
      <div className="h-[80vh] flex items-center justify-center p-6 text-center">
         <div className="space-y-4 ua-compact-page">
            <h2 className="text-xl font-black uppercase font-headline">Access Restricted</h2>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto pt-4 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <div className="flex items-center gap-2 mb-2">
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">STAFF PAYROLL</span>
          </div>
          <PageHeader title="Payroll" breadcrumb={["Admin", "Payroll"]} className="mb-0" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 bg-white p-1.5 rounded-none border border-zinc-100 shadow-sm">
            {['TODAY', 'YESTERDAY', 'WEEK', 'ALL'].map((f) => (
              <Button 
                key={f}
                onClick={() => setDateFilter(f as any)}
                className={cn("h-10 px-4 rounded-none text-[9px] font-black uppercase tracking-widest transition-all", dateFilter === f ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}
              >{f.toLowerCase()}</Button>
            ))}
          </div>
          <Button onClick={() => setIsAdvanceOpen(true)} className="h-12 px-6 bg-primary hover:bg-orange-600 text-white font-black uppercase text-[10px] tracking-widest rounded-none shadow-xl gap-2 active:scale-95 transition-all">
             Issue Advance
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-2 ua-metric-strip">
        <KPICard title="Total Salaries" value={`KES ${totals.baseSalary.toLocaleString()}`} />
        <KPICard title="Commissions" value={`KES ${totals.commissions.toLocaleString()}`} color="text-primary" />
        <KPICard title="Staff Tips" value={`KES ${totals.tips.toLocaleString()}`} color="text-green-600" />
        <KPICard title="Total Advances" value={`KES ${totals.advances.toLocaleString()}`} color="text-red-600" />
        <KPICard title="Net Payouts" value={`KES ${totals.yield.toLocaleString()}`} color="text-blue-600" />
      </div>

      <Tabs defaultValue="payroll" className="w-full px-2">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-none shadow-sm border border-zinc-100 mb-6">
            <TabsList className="bg-zinc-100/50 p-1.5 rounded-none h-14">
               <TabsTrigger value="payroll" className="rounded-none h-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md">Staff List</TabsTrigger>
               <TabsTrigger value="advances" className="rounded-none h-full px-8 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md">Advance List</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-1 max-w-md relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
               <Input 
                 placeholder="Search staff..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-12 h-14 bg-zinc-50 border-none rounded-none font-bold" 
               />
            </div>

            <div className="flex gap-2">
               <Button onClick={() => window.open(PAYSTACK_TRANSFERS_URL, '_blank')} className="h-14 px-8 rounded-none bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl transition-all">
                 Pay Staff
               </Button>
               <Button onClick={() => exportAsReceiptText(payrollData, `Payroll_${dateFilter}`, { displayName: 'Name', role: 'Role', mpesaNumber: 'Phone', totalYield: 'Pay' })} variant="outline" className="h-14 px-8 rounded-none border-zinc-100 text-[10px] font-black uppercase tracking-widest bg-white shadow-sm transition-all">
                 Export
               </Button>
            </div>
         </div>

         <TabsContent value="payroll" className="m-0">
            <Card className="border-none shadow-sm rounded-none overflow-hidden bg-white border border-zinc-100">
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-zinc-50/50">
                        <TableRow className="border-zinc-100">
                           <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Name</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Phone</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-center">Status</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Net Pay</TableHead>
                           <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Actions</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {payrollData.map((member) => (
                           <TableRow key={member.uid} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                              <TableCell className="pl-8 py-5">
                                 <div className="flex items-center gap-4">
                                    <div>
                                       <p className="text-sm font-black text-zinc-900 uppercase leading-none mb-1">{member.displayName}</p>
                                       <Badge variant="outline" className="text-[7px] font-black uppercase px-2 h-4 border-zinc-200">{member.role}</Badge>
                                    </div>
                                 </div>
                              </TableCell>
                              <TableCell>
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-zinc-600 font-mono tracking-widest">
                                       {member.mpesaNumber || 'NOT SET'}
                                    </span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-center">
                                 <div className={cn(
                                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm",
                                    member.paystackRecipientCode ? "bg-green-50 border-green-100 text-green-600" : "bg-zinc-50 border-zinc-100 text-zinc-300"
                                 )}>
                                    <span className="text-[8px] font-black uppercase">{member.paystackRecipientCode ? 'READY' : 'NOT SYNCED'}</span>
                                 </div>
                              </TableCell>
                              <TableCell className="text-right">
                                 <span className="text-sm font-black text-zinc-900">KES {member.totalYield.toLocaleString()}</span>
                              </TableCell>
                              <TableCell className="text-right pr-8">
                                 <div className="flex items-center justify-end gap-2">
                                    <Button 
                                       onClick={() => handleSyncPaystack(member)}
                                       disabled={isSyncingPaystack === member.uid}
                                       variant="outline"
                                       className="h-9 px-3 border-zinc-100 text-zinc-400 hover:text-primary rounded-none transition-all"
                                    >
                                       Sync
                                    </Button>
                                    <Button 
                                       onClick={() => handleProcessPayout(member)}
                                       className={cn(
                                          "h-9 px-4 rounded-none text-[9px] font-black uppercase tracking-widest gap-2 transition-all",
                                          initiatedPayouts.has(member.uid) ? "bg-green-500 text-white" : "bg-zinc-900 text-white"
                                       )}
                                    >
                                       Pay Now
                                    </Button>
                                    <Button onClick={() => { setPayoutData({ type: 'COMMISSION-VOUCHER', attendantName: member.displayName, total: member.totalYield, items: [{ name: 'Net Pay', price: member.totalYield, quantity: 1 }] }); setIsPreviewOpen(true); }} variant="ghost" size="icon" className="h-9 w-9 text-zinc-200 hover:text-zinc-900 rounded-none transition-all">
                                       <Printer className="w-4 h-4" />
                                    </Button>
                                 </div>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         </TabsContent>

         <TabsContent value="advances" className="m-0">
            <Card className="border-none shadow-sm rounded-none overflow-hidden bg-white border border-zinc-100">
               <CardContent className="p-0">
                  <Table>
                     <TableHeader className="bg-zinc-50/50">
                        <TableRow className="border-zinc-100">
                           <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Date</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Name</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Reason</TableHead>
                           <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Amount</TableHead>
                           <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Action</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {advances?.map((adv: any) => (
                           <TableRow key={adv.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                              <TableCell className="pl-8 py-5">
                                 <span className="text-[10px] font-bold text-zinc-400 uppercase">{new Date(adv.timestamp).toLocaleDateString('en-KE')}</span>
                              </TableCell>
                              <TableCell><span className="text-xs font-black text-zinc-900 uppercase">{adv.userName}</span></TableCell>
                              <TableCell><span className="text-xs font-bold text-zinc-500 uppercase">{adv.reason || 'Salary Advance'}</span></TableCell>
                              <TableCell className="text-right"><span className="text-sm font-black text-red-500">KES {adv.amount.toLocaleString()}</span></TableCell>
                              <TableCell className="text-right pr-8">
                                 <div className="flex justify-end gap-2">
                                    <Button onClick={() => { setPayoutData({ type: 'ADVANCE-VOUCHER', id: `ADV-${adv.id.slice(-6).toUpperCase()}`, userName: adv.userName, amount: adv.amount, reason: adv.reason, timestamp: adv.timestamp, items: [{ name: "Salary Advance", price: adv.amount, quantity: 1 }] }); setIsPreviewOpen(true); }} variant="ghost" size="icon" className="h-9 w-9 text-zinc-300 hover:text-primary rounded-none"><Printer className="w-4 h-4" /></Button>
                                    <Button onClick={async () => { if(confirm('Delete this record?')) await deleteDoc(doc(firestore!, 'salary_advances', adv.id)); }} variant="ghost" size="icon" className="h-9 w-9 text-zinc-200 hover:text-red-500 rounded-none"><Trash2 className="w-4 h-4" /></Button>
                                 </div>
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </CardContent>
            </Card>
         </TabsContent>
      </Tabs>

      <Dialog open={isAdvanceOpen} onOpenChange={setIsAdvanceOpen}>
         <DialogContent className="sm:max-w-[450px] rounded-none border-none shadow-2xl p-0 overflow-hidden bg-white">
            <div className="bg-red-50 p-10 border-b border-red-100 text-center">
               <DialogHeader>
                  <DialogTitle className="font-headline uppercase tracking-widest text-lg text-red-900">Issue Salary Advance</DialogTitle>
                  <DialogDescription className="text-xs uppercase font-bold text-red-700/60">Record a prepayment for a staff member.</DialogDescription>
               </DialogHeader>
            </div>
            
            <form onSubmit={handleRecordAdvance} className="p-8 space-y-5">
               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Select Staff</Label>
                  <Select value={advanceUserId} onValueChange={setAdvanceUserId} required>
                     <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-none px-6 font-bold">
                        <SelectValue placeholder="Select Staff Member" />
                     </SelectTrigger>
                     <SelectContent className="rounded-none border-none shadow-2xl">
                        {staff?.map(s => <SelectItem key={s.uid} value={s.uid} className="text-xs font-black uppercase">{s.displayName}</SelectItem>)}
                     </SelectContent>
                  </Select>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Amount (KES)</Label>
                     <Input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-none px-6 font-black" required />
                  </div>
                  <div className="space-y-1.5">
                     <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Date</Label>
                     <Input type="date" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-none px-4 font-bold" required />
                  </div>
               </div>

               <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Reason</Label>
                  <Input value={advanceReason} onChange={e => setAdvanceReason(e.target.value)} placeholder="e.g. Personal request" className="h-14 bg-zinc-50 border-none rounded-none px-6 font-bold" required />
               </div>

               <Button type="submit" disabled={isSubmittingAdvance} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-none shadow-xl mt-4">
                  Save Advance
               </Button>
            </form>
         </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({ title, value, color = "text-zinc-900" }: any) {
  return (
    <Card className="border-none shadow-sm rounded-none bg-white border border-zinc-100 p-6 group hover:bg-zinc-50 transition-colors">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">{title}</p>
      <h3 className={cn("text-xl font-black font-headline tracking-tighter truncate", color)}>{value}</h3>
    </Card>
  );
}
