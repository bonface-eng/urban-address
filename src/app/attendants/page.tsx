'use client';

import { PageHeader } from '@/components/shared/page-layout';
import { FullPageEditor } from '@/components/admin/full-page-editor';

import { useBusinessClock } from '@/hooks/use-business-clock';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Edit2, 
  Star, 
  Mail, 
  User as UserIcon, 
  Banknote, 
  RefreshCcw, 
  XCircle, 
  ShieldAlert, 
  Key, 
  TrendingUp, 
  Coins, 
  Printer, 
  Calendar, 
  ChevronDown, 
  FileText,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useDb, useCollection } from '@/lib/data';
import { collection, query, where, doc, addDoc, updateDoc } from '@/lib/db';
import { UserProfile, CarwashJob } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { exportAsReceiptText } from '@/lib/csv-export';
import { adminCreateUser, adminDeleteUser } from '@/lib/actions';
import { HardwareService } from '@/lib/hardware-service';
import { ReceiptPreview } from '@/components/pos/receipt-preview';

export default function AttendantsPage() {
  const firestore = useDb();
  const { profile, isSuperAdmin } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [payoutData, setPayoutData] = useState<any>(null);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const attendantsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'ATTENDANT'));
  }, [firestore]);

  const jobsQuery = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'carwash_jobs');
  }, [firestore]);

  const { data: staff, loading } = useCollection<UserProfile>(attendantsQuery);
  const { data: allActiveJobs } = useCollection<CarwashJob>(jobsQuery);

  const { startOfToday } = useBusinessClock();

  const filteredJobsByTime = useMemo(() => {
    if (!allActiveJobs) return [];
    const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
    const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);

    return allActiveJobs.filter(job => {
      if (dateFilter === 'CUSTOM') {
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
        return job.timestamp >= start && job.timestamp <= end;
      }
      if (dateFilter === 'TODAY') return job.timestamp >= startOfToday;
      if (dateFilter === 'YESTERDAY') return job.timestamp >= startOfYesterday && job.timestamp < startOfToday;
      if (dateFilter === 'WEEK') return job.timestamp >= startOfWeek;
      return true;
    });
  }, [allActiveJobs, dateFilter, startDate, endDate, startOfToday]);

  const filteredStaff = useMemo(() => {
    if (!staff) return [];
    return staff.filter(s => 
      s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const getAttendantStats = (attendant: UserProfile) => {
    const jobs = filteredJobsByTime.filter(j => j.attendantId === attendant.uid || j.attendantId === attendant.displayName);
    const revenue = jobs.reduce((sum, j) => sum + (j.price || 0), 0);
    const commissions = jobs.reduce((sum, j) => sum + (j.commission || 0), 0);
    const tips = jobs.reduce((sum, j) => sum + (j.tip || 0), 0);
    return { 
      revenue, 
      commissions, 
      tips, 
      totalYield: commissions + tips, 
      count: jobs.length, 
      jobs 
    };
  };

  const totals = useMemo(() => {
    const revenue = filteredJobsByTime.reduce((sum, j) => sum + (j.price || 0), 0);
    const commissions = filteredJobsByTime.reduce((sum, j) => sum + (j.commission || 0), 0);
    const tips = filteredJobsByTime.reduce((sum, j) => sum + (j.tip || 0), 0);
    return { revenue, commissions, tips, totalPayouts: commissions + tips };
  }, [filteredJobsByTime]);

  const handlePrintPayout = (attendant: UserProfile) => {
    const stats = getAttendantStats(attendant);
    if (stats.count === 0) {
      toast({ variant: "destructive", title: "No Work Found", description: "This staff member has no completed jobs for the selected time." });
      return;
    }

    const data = {
      type: 'COMMISSION-VOUCHER',
      attendantName: attendant.displayName,
      total: stats.totalYield,
      commissionPortion: stats.commissions,
      tipPortion: stats.tips,
      jobCount: stats.count,
      timestamp: Date.now(),
      period: dateFilter === 'CUSTOM' ? `${startDate} to ${endDate}` : dateFilter,
      items: stats.jobs.map(j => ({
        name: j.service,
        plate: j.plateNumber,
        price: (j.commission || 0) + (j.tip || 0), 
        time: new Date(j.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    };

    setPayoutData(data);
    setIsPreviewOpen(true);
  };

  const handlePrintAllCommissions = () => {
    if (!staff || staff.length === 0) return;
    
    const payoutItems = staff.map(attendant => {
      const stats = getAttendantStats(attendant);
      return {
        name: attendant.displayName,
        price: stats.totalYield,
        quantity: 1,
        count: stats.count
      };
    }).filter(item => item.price > 0);

    if (payoutItems.length === 0) {
      toast({ variant: "destructive", title: "No Activity", description: "No commissions earned in this period." });
      return;
    }

    const consolidatedReport = {
      type: 'SYSTEM-REPORT',
      reportType: 'CONSOLIDATED-PAYOUT',
      total: totals.totalPayouts,
      timestamp: Date.now(),
      period: dateFilter === 'CUSTOM' ? `${startDate} to ${endDate}` : dateFilter,
      items: payoutItems
    };

    setPayoutData(consolidatedReport);
    setIsPreviewOpen(true);
  };

  const handleExportPayroll = () => {
    if (!staff || staff.length === 0) return;
    
    const exportData = staff.map(attendant => {
      const stats = getAttendantStats(attendant);
      return {
        name: attendant.displayName,
        email: attendant.email,
        period: dateFilter === 'CUSTOM' ? `${startDate} to ${endDate}` : dateFilter,
        jobs: stats.count,
        revenue: stats.revenue,
        commission: stats.commissions,
        tips: stats.tips,
        total: stats.totalYield
      };
    });

    const headers = {
      name: 'Name',
      email: 'Email',
      period: 'Period',
      jobs: 'Jobs',
      revenue: 'Revenue',
      commission: 'Commission',
      tips: 'Tips',
      total: 'Total'
    };

    exportAsReceiptText(exportData, `Staff_Pay_${dateFilter}`, headers);
    toast({ title: "Export Saved" });
  };

  const handleSaveAttendant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile || !email || isSubmitting) return;

    setIsSubmitting(true);
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      if (editingStaff) {
        const userRef = doc(firestore, 'users', editingStaff.uid);
        await updateDoc(userRef, {
          displayName: displayName,
          updatedAt: Date.now(),
        });
        toast({ title: "Name Updated" });
      } else {
        const res = await adminCreateUser({
          email: normalizedEmail,
          password: password,
          displayName: displayName || email.split('@')[0],
          role: 'ATTENDANT',
          assignedUnits: ['CARWASH']
        });
        if (!res.success) throw new Error(res.message);
        toast({ title: "Staff Member Added" });
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!firestore || !userToDelete || !profile || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await adminDeleteUser(userToDelete.uid);
      if (!res.success) throw new Error(res.message);
      toast({ title: "Staff Member Removed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSubmitting(false);
      setUserToDelete(null);
    }
  };

  const openEdit = (s: UserProfile) => {
    setEditingStaff(s);
    setEmail(s.email);
    setDisplayName(s.displayName);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setPassword('');
    setEditingStaff(null);
  };

  return (
    <div className="ua-compact-page ua-attendance-page mx-auto w-full max-w-[1600px] space-y-4 overflow-x-hidden px-1 pb-24 sm:space-y-6 sm:px-2">
      <div className="flex flex-col gap-3 px-1 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-2 sm:pt-4">
        <div>
          <PageHeader title="Attendant Performance" breadcrumb={["Staff", "Attendant Performance"]} className="mb-0" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mt-1">Personnel & Commissions</p>
        </div>
        <div className="ua-attendance-filters flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <div className="ua-attendance-date-presets flex w-full min-w-0 gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-sm no-scrollbar sm:w-auto sm:gap-2 sm:p-1.5">
             {['TODAY', 'YESTERDAY', 'WEEK', 'ALL', 'CUSTOM'].map((f) => (
               <Button 
                key={f}
                onClick={() => setDateFilter(f as any)}
                className={cn("h-9 shrink-0 rounded-md px-3 text-[9px] font-black uppercase tracking-widest transition-all sm:h-10 sm:rounded-none sm:px-4", dateFilter === f ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}
               >{f.toLowerCase()}</Button>
             ))}
          </div>
          {dateFilter === 'CUSTOM' && (
            <div className="ua-attendance-custom-range flex w-full min-w-0 flex-col items-stretch gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:w-auto sm:flex-row sm:items-center sm:p-1.5">
               <div className="flex min-w-0 flex-wrap items-center gap-2 px-1 sm:flex-nowrap sm:px-2">
                 <CalendarDays className="w-3.5 h-3.5 text-primary" />
                 <Input 
                   type="date" 
                   value={startDate} 
                   onChange={e => setStartDate(e.target.value)}
                   className="h-10 min-w-0 flex-1 border-none bg-zinc-50 text-[10px] font-bold sm:h-8 sm:w-32 sm:flex-none sm:rounded-none"
                 />
                 <span className="text-[9px] font-black text-zinc-300">TO</span>
                 <Input 
                   type="date" 
                   value={endDate} 
                   onChange={e => setEndDate(e.target.value)}
                   className="h-10 min-w-0 w-full flex-1 border-none bg-zinc-50 text-[10px] font-bold sm:h-8 sm:w-32 sm:flex-none"
                 />
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-2 sm:gap-4 sm:px-2 lg:grid-cols-4">
        <KPICard title="Revenue" value={totals.revenue.toLocaleString()} icon={TrendingUp} prefix="KES " />
        <KPICard title="Pay Volume" value={totals.totalPayouts.toLocaleString()} icon={Coins} prefix="KES " color="text-green-600" />
        <KPICard title="Staff Count" value={staff?.length.toString() || '0'} icon={Users} />
        <KPICard title="Status" value="REAL-TIME" icon={ShieldAlert} color="text-primary" />
      </div>

      <div className="mx-1 flex flex-col gap-3 border border-zinc-100 bg-white p-3 shadow-sm sm:mx-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
           <Input 
             placeholder="Search staff..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="h-11 border-none bg-zinc-50 pl-11 font-semibold sm:h-14 sm:rounded-none sm:font-bold" 
           />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button 
            onClick={handlePrintAllCommissions}
            variant="outline" 
            className="h-11 w-full rounded-md border-zinc-100 px-3 text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 sm:h-14 sm:w-auto sm:rounded-none sm:px-8 sm:text-[10px]"
          >
            <Printer className="w-4 h-4 text-primary" /> Print All
          </Button>

          <Button 
            onClick={handleExportPayroll}
            variant="outline" 
            className="h-11 w-full rounded-md border-zinc-100 px-3 text-[9px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 sm:h-14 sm:w-auto sm:rounded-none sm:px-8 sm:text-[10px]"
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>

          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="col-span-2 h-11 w-full rounded-md bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-white shadow-md transition-all active:scale-95 hover:bg-zinc-800 sm:col-span-1 sm:h-14 sm:w-auto sm:rounded-none sm:px-8 sm:text-[10px]">
                <Plus className="w-5 h-5 text-primary" /> Add Staff
              </Button>
          <FullPageEditor open={isDialogOpen} title={editingStaff ? "Edit attendant" : "Add attendant"} description="Manage attendant account details." onClose={() => { setIsDialogOpen(false); resetForm(); }}>

              

            <div className="w-full">
              <div className="border-b border-primary/10 bg-primary/5 p-5 text-center sm:p-10">
                 <div className="w-16 h-16 rounded-none bg-white shadow-xl flex items-center justify-center text-primary mb-6 mx-auto">
                    {editingStaff ? <Edit2 className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
                 </div>
                 <DialogHeader>
                    <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">
                      {editingStaff ? 'Edit Staff' : 'New Staff'}
                    </DialogTitle>
                    <DialogDescription className="text-xs uppercase font-bold text-zinc-400">
                      Manage staff member details.
                    </DialogDescription>
                 </DialogHeader>
              </div>
              <form onSubmit={handleSaveAttendant} className="space-y-4 p-5 sm:space-y-6 sm:p-8">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-11 bg-zinc-50 px-4 font-semibold sm:h-14 sm:rounded-none sm:px-5 sm:font-bold" required disabled={!!editingStaff} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-none px-5 font-bold" required />
                </div>
                {!editingStaff && (
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Temp Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-none px-5 font-bold" required />
                  </div>
                )}
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-none shadow-xl active:scale-95 transition-all">
                    {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Save Staff'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </FullPageEditor>
        </div>
      </div>

      <div className="ua-attendance-staff-list mx-0 grid min-w-0 grid-cols-1 gap-3 lg:hidden">
  {filteredStaff.map((attendant) => {
    const stats = getAttendantStats(attendant);
    return (
      <Card key={attendant.uid} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-11 w-11 shrink-0 rounded-lg border border-zinc-100"><AvatarImage src={attendant.photoURL || undefined} /><AvatarFallback className="rounded-lg bg-primary/5 text-xs font-bold text-primary">{attendant.displayName?.[0]}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-900">{attendant.displayName}</p><p className="truncate text-xs text-zinc-500">{attendant.email}</p></div>
          <Badge variant="outline" className="shrink-0 border-zinc-200 text-[10px]">{stats.count} jobs</Badge>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-zinc-100 py-3">
          <div className="min-w-0"><p className="text-[10px] text-zinc-400">Commission</p><p className="mt-1 truncate text-xs font-semibold text-zinc-800">KES {(stats.commissions || 0).toLocaleString()}</p></div>
          <div className="min-w-0"><p className="text-[10px] text-zinc-400">Tips</p><p className="mt-1 truncate text-xs font-semibold text-zinc-800">KES {(stats.tips || 0).toLocaleString()}</p></div>
          <div className="min-w-0"><p className="text-[10px] text-zinc-400">Total pay</p><p className="mt-1 truncate text-xs font-bold text-green-700">KES {(stats.totalYield || 0).toLocaleString()}</p></div>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
          <Button onClick={() => handlePrintPayout(attendant)} variant="outline" className="h-10 min-w-0 px-2 text-xs"><Printer className="mr-1.5 h-3.5 w-3.5" /> Pay slip</Button>
          <Button onClick={() => openEdit(attendant)} variant="outline" size="icon" className="h-10 w-10" aria-label={"Edit " + attendant.displayName}><Edit2 className="h-4 w-4" /></Button>
          <Button onClick={() => setUserToDelete(attendant)} variant="outline" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" aria-label={"Remove " + attendant.displayName}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </Card>
    );
  })}
  {!loading && filteredStaff.length === 0 && <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500">No attendants match this search.</div>}
</div>
<Card className="mx-0 hidden min-w-0 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm lg:block">
        <CardContent className="p-0">
          <Table className="min-w-[820px]">
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="hover:bg-transparent border-zinc-100">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Staff Member</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Commission</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Tips</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Total Pay</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-center text-zinc-400">Jobs</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((attendant) => {
                const stats = getAttendantStats(attendant);
                return (
                  <TableRow key={attendant.uid} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 rounded-none border border-zinc-100 shadow-sm">
                          <AvatarImage src={attendant.photoURL || undefined} />
                          <AvatarFallback className="rounded-none bg-primary/5 text-primary text-[10px] font-black uppercase">{attendant.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-black text-zinc-900 uppercase leading-none mb-1">{attendant.displayName}</p>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{attendant.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-bold text-zinc-500">KES {(stats.commissions || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-bold text-zinc-500">KES {(stats.tips || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-black text-green-600">KES {(stats.totalYield || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-zinc-50 text-zinc-500 border-none font-black text-[9px] px-3 h-6 rounded-none">{stats.count}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          onClick={() => handlePrintPayout(attendant)}
                          variant="outline" 
                          className="h-10 px-4 border-zinc-200 text-zinc-400 hover:text-primary gap-2 text-[9px] font-black uppercase rounded-none bg-white shadow-sm active:scale-95 transition-all"
                        >
                          <Printer className="w-3.5 h-3.5" /> Pay Slip
                        </Button>
                        <Button onClick={() => openEdit(attendant)} variant="ghost" size="icon" className="h-10 w-10 text-zinc-200 hover:text-zinc-900 bg-zinc-50/50 rounded-none transition-all"><Edit2 className="w-4 h-4" /></Button>
                        <Button onClick={() => setUserToDelete(attendant)} variant="ghost" size="icon" className="h-10 w-10 text-zinc-200 hover:text-red-500 bg-zinc-50/50 rounded-none transition-all"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!userToDelete} onOpenChange={(o) => !o && !isSubmitting && setUserToDelete(null)}>
         <AlertDialogContent className="max-h-[90dvh] w-[calc(100vw-1.25rem)] max-w-[420px] overflow-y-auto rounded-xl border-none bg-white p-5 text-center shadow-2xl sm:rounded-none sm:p-10">
            <div className="w-20 h-20 rounded-none bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-8 shadow-inner ring-8 ring-white">
               {isSubmitting ? <RefreshCcw className="w-10 h-10 animate-spin" /> : <XCircle className="w-10 h-10" />}
            </div>
            <AlertDialogHeader className="text-center space-y-4">
               <AlertDialogTitle className="font-headline uppercase tracking-tighter text-2xl text-zinc-900">Remove Staff</AlertDialogTitle>
               <AlertDialogDescription className="text-xs font-bold uppercase text-zinc-400 leading-relaxed px-4">
                  Delete <span className="text-zinc-900 font-black">"{userToDelete?.displayName}"</span> from the team?
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-10 flex-col sm:flex-row gap-4">
               <AlertDialogCancel disabled={isSubmitting} className="h-14 rounded-none uppercase font-black text-[10px] tracking-widest border-zinc-100 w-full hover:bg-zinc-50 transition-all">Cancel</AlertDialogCancel>
               <AlertDialogAction 
                  onClick={(e) => { e.preventDefault(); handleDeleteStaff(); }}
                  disabled={isSubmitting}
                  className="h-14 rounded-none bg-red-500 hover:bg-red-600 text-white uppercase font-black text-[10px] tracking-widest w-full shadow-lg transition-all active:scale-95"
               >
                  Confirm Delete
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
         <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-md overflow-y-auto border-none bg-transparent p-0 shadow-none">
            <div className="sr-only">
               <DialogTitle>Preview</DialogTitle>
            </div>
            <ReceiptPreview 
              data={payoutData} 
              onClose={() => setIsPreviewOpen(false)} 
              className="w-full"
            />
         </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({ title, value, icon: Icon, prefix = "", color = "text-zinc-900" }: any) {
  return (
    <Card className="min-w-0 rounded-lg border border-zinc-100 bg-white p-3 shadow-sm sm:rounded-none sm:p-6">
      <div className="flex items-center gap-3 mb-2">
         <Icon className={cn("w-4 h-4", color)} />
         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{title}</p>
      </div>
      <h3 className={cn("break-words text-lg font-black font-headline tracking-tight sm:text-2xl sm:tracking-tighter", color)}>{prefix}{value}</h3>
    </Card>
  );
}
