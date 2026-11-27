
'use client';
import { useManagementRead } from '@/hooks/use-management-read';
import { PosReadNotice } from '@/components/pos/read-notice';

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
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, doc, addDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, CarwashJob } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { exportAsReceiptText } from '@/lib/csv-export';
import { adminCreateUser, adminDeleteUser } from '@/lib/actions';
import { HardwareService } from '@/lib/hardware-service';
import { ReceiptPreview } from '@/components/pos/receipt-preview';

export default function AttendantsPage() {
  const firestore = useFirestore();
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

  const primaryRead = useManagementRead<UserProfile>('attendants');
  const { data: staff, loading } = primaryRead;
  const allActiveJobsRead = useManagementRead<CarwashJob>('jobs');
  const { data: allActiveJobs } = allActiveJobsRead;

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

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
          assignedUnit: 'CARWASH'
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
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <PosReadNotice label="jobs" error={allActiveJobsRead.error} onRetry={allActiveJobsRead.refresh} />
      <button type="button" onClick={primaryRead.refresh} className="px-4 py-2 border rounded-lg text-sm">Refresh records</button>
      <PosReadNotice label="Attendants" error={primaryRead.error} onRetry={primaryRead.refresh} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 pt-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-zinc-900 uppercase tracking-tighter">Team Performance</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mt-1">Personnel & Commissions</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex gap-2 bg-white p-1.5 rounded-none border border-zinc-100 shadow-sm overflow-x-auto no-scrollbar">
             {['TODAY', 'YESTERDAY', 'WEEK', 'ALL', 'CUSTOM'].map((f) => (
               <Button 
                key={f}
                onClick={() => setDateFilter(f as any)}
                className={cn("h-10 px-4 rounded-none text-[9px] font-black uppercase tracking-widest transition-all", dateFilter === f ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-900")}
               >{f.toLowerCase()}</Button>
             ))}
          </div>
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-none border border-zinc-100 shadow-sm">
               <div className="flex items-center gap-2 px-2">
                 <CalendarDays className="w-3.5 h-3.5 text-primary" />
                 <Input 
                   type="date" 
                   value={startDate} 
                   onChange={e => setStartDate(e.target.value)}
                   className="h-8 w-32 border-none bg-zinc-50 rounded-none text-[10px] font-bold"
                 />
                 <span className="text-[9px] font-black text-zinc-300">TO</span>
                 <Input 
                   type="date" 
                   value={endDate} 
                   onChange={e => setEndDate(e.target.value)}
                   className="h-8 w-32 border-none bg-zinc-50 rounded-none text-[10px] font-bold"
                 />
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-2">
        <KPICard title="Revenue" value={totals.revenue.toLocaleString()} icon={TrendingUp} prefix="KES " />
        <KPICard title="Pay Volume" value={totals.totalPayouts.toLocaleString()} icon={Coins} prefix="KES " color="text-green-600" />
        <KPICard title="Staff Count" value={staff?.length.toString() || '0'} icon={Users} />
        <KPICard title="Status" value="REAL-TIME" icon={ShieldAlert} color="text-primary" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-none shadow-sm border border-zinc-100 mx-2">
        <div className="relative flex-1 max-w-md">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
           <Input 
             placeholder="Search staff..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="pl-12 h-14 bg-zinc-50 border-none rounded-none font-bold" 
           />
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handlePrintAllCommissions}
            variant="outline" 
            className="h-14 px-8 rounded-none border-zinc-100 text-[10px] font-black uppercase tracking-widest bg-white shadow-sm active:scale-95 transition-all gap-2"
          >
            <Printer className="w-4 h-4 text-primary" /> Print All
          </Button>

          <Button 
            onClick={handleExportPayroll}
            variant="outline" 
            className="h-14 px-8 rounded-none border-zinc-100 text-[10px] font-black uppercase tracking-widest bg-white shadow-sm active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if(!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="h-14 px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-none shadow-xl active:scale-95 transition-all">
                <Plus className="w-5 h-5 text-primary" /> Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] rounded-none border-none shadow-2xl p-0 overflow-hidden bg-white">
              <div className="bg-primary/5 p-10 border-b border-primary/10 text-center">
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
              <form onSubmit={handleSaveAttendant} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-none px-5 font-bold" required disabled={!!editingStaff} />
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
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-none overflow-hidden bg-white border border-zinc-100 mx-2">
        <CardContent className="p-0">
          <Table>
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
         <AlertDialogContent className="rounded-none border-none shadow-2xl p-10 max-w-[420px] bg-white text-center">
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
         <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
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
    <Card className="border-none shadow-sm rounded-none bg-white p-6 border border-zinc-100">
      <div className="flex items-center gap-3 mb-2">
         <Icon className={cn("w-4 h-4", color)} />
         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">{title}</p>
      </div>
      <h3 className={cn("text-2xl font-black font-headline tracking-tighter", color)}>{prefix}{value}</h3>
    </Card>
  );
}
