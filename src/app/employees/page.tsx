'use client';
import { useManagementRead } from '@/hooks/use-management-read';
import { PosReadNotice } from '@/components/pos/read-notice';

import React, { useMemo, useState } from 'react';
import { 
  Users, 
  Search, 
  Trash2, 
  Edit2, 
  RefreshCcw,
  Download,
  Plus,
  UserPlus,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldAlert,
  Banknote,
  Hash,
  RotateCcw,
  Smartphone,
  UserMinus,
  Building2,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { UserProfile, UserRole, BusinessUnit } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { exportAsReceiptText } from '@/lib/csv-export';
import { adminResetUserPassword, adminDeleteUser, adminCreateUser } from '@/lib/actions';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN'];
const UNITS: { label: string; value: BusinessUnit }[] = [
  { label: 'Lounge & Bar', value: 'LOUNGE' },
  { label: 'Auto Accessories', value: 'STORE' },
  { label: 'Carwash Detailing', value: 'CARWASH' }
];

export default function StaffDirectory() {
  const firestore = useFirestore();
  const { profile, isSuperAdmin } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('staff');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [assignedUnits, setAssignedUnits] = useState<BusinessUnit[]>([]);
  const [baseSalary, setBaseSalary] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const primaryRead = useManagementRead<UserProfile>('directory');
  const { data: allUsers, loading } = primaryRead;

  const staffList = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.role !== 'CLIENT' && u.role !== undefined);
  }, [allUsers]);

  const clientList = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => u.role === 'CLIENT' || u.role === undefined);
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    const baseList = activeTab === 'staff' ? staffList : clientList;
    return baseList.filter(s => 
      s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staffList, clientList, searchTerm, activeTab]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const toggleUnit = (unit: BusinessUnit) => {
    setAssignedUnits(prev => 
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    );
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile) return;
    setIsSubmitting(true);
    try {
      const res = await adminCreateUser({
        email: email.toLowerCase().trim(),
        password,
        displayName,
        role: role as UserRole,
        assignedUnits: assignedUnits,
        baseSalary: Number(baseSalary) || 0
      });

      if (!res.success) throw new Error(res.message);

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'STAFF_PROVISIONED',
        userId: profile.uid,
        details: `Created new ${role} account: ${displayName} (${email}). Assigned Stations: ${assignedUnits.join(', ') || 'Global'}`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      setIsAddOpen(false);
      resetForm();
      toast({ title: "Account Created", description: `${displayName} added.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedUser || !profile) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'users', selectedUser.uid), {
        displayName,
        role: role as UserRole,
        assignedUnits: assignedUnits,
        baseSalary: Number(baseSalary) || 0,
        mpesaNumber: mpesaNumber || null
      });
      setIsEditOpen(false);
      toast({ title: "Profile Updated" });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setDisplayName(user.displayName);
    setRole(user.role || 'CLIENT');
    // Normalize assignedUnits - handle legacy field if present
    setAssignedUnits(user.assignedUnits || []);
    setBaseSalary(user.baseSalary?.toString() || '0');
    setMpesaNumber(user.mpesaNumber || '');
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setDisplayName(''); setEmail(''); setPassword(''); setRole(''); setAssignedUnits([]);
    setBaseSalary(''); setMpesaNumber(''); setSelectedUser(null);
  };

  if (primaryRead.error) return <div className="p-6"><PosReadNotice label="Management records" error={primaryRead.error} onRetry={primaryRead.refresh} /></div>;

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <PosReadNotice label="Staff directory" error={primaryRead.error} onRetry={primaryRead.refresh} />
      <button type="button" onClick={primaryRead.refresh} className="px-4 py-2 border rounded-lg text-sm">Refresh records</button>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 pt-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Personnel</h1>
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">Manage staff accounts and POS access</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="h-11 px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl gap-2 transition-all">
             <Plus className="w-4 h-4 text-primary" /> Add Staff
           </Button>
        </div>
      </div>

      <Tabs defaultValue="staff" className="w-full" onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-zinc-100 mb-6 mx-2">
          <TabsList className="bg-zinc-100/50 p-1.5 rounded-2xl h-14 w-full sm:w-auto">
            <TabsTrigger value="staff" className="rounded-xl h-full px-6 text-[10px] font-black uppercase tracking-widest flex-1 sm:flex-none">Staff</TabsTrigger>
            <TabsTrigger value="clients" className="rounded-xl h-full px-6 text-[10px] font-black uppercase tracking-widest flex-1 sm:flex-none">Customers</TabsTrigger>
          </TabsList>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input placeholder="Search records..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="pl-12 h-14 bg-zinc-50 border-none rounded-2xl font-bold w-full" />
          </div>
        </div>

        <TabsContent value="staff" className="m-0 px-2">
          <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100">
             <CardContent className="p-0">
                <Table>
                   <TableHeader className="bg-zinc-50/50">
                      <TableRow>
                        <TableHead className="pl-8 h-16 text-[10px] uppercase font-black text-zinc-400">Identity</TableHead>
                        <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Role</TableHead>
                        <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Salary</TableHead>
                        <TableHead className="pr-8 h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Actions</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {paginatedUsers.map(user => (
                        <TableRow key={user.uid} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                           <TableCell className="pl-8 py-4">
                              <div className="flex items-center gap-4">
                                 <Avatar className="h-10 w-10 rounded-xl">
                                    <AvatarImage src={user.photoURL || undefined} />
                                    <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{user.displayName?.[0]}</AvatarFallback>
                                 </Avatar>
                                 <div>
                                    <p className="text-sm font-black uppercase text-zinc-900">{user.displayName}</p>
                                    <p className="text-[9px] font-bold text-zinc-400 uppercase">{user.email}</p>
                                 </div>
                              </div>
                           </TableCell>
                           <TableCell className="text-center"><Badge variant="outline" className="text-[9px] font-black uppercase border-zinc-200">{user.role}</Badge></TableCell>
                           <TableCell className="text-right font-black">KES {(user.baseSalary || 0).toLocaleString()}</TableCell>
                           <TableCell className="text-right pr-8">
                              <Button onClick={() => openEdit(user)} variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-900"><Edit2 className="w-4 h-4" /></Button>
                           </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-8 py-4 border-t border-zinc-50">
                    <p className="text-[10px] font-black uppercase text-zinc-400">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-9 rounded-xl"><ChevronLeft className="w-4 h-4" /></Button>
                      <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-9 rounded-xl"><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- ADD DIALOG --- */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-h-[90vh] overflow-y-auto">
           <div className="bg-zinc-900 p-8 text-center border-b border-white/10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4"><UserPlus className="w-7 h-7" /></div>
              <DialogTitle className="font-headline uppercase tracking-widest text-lg text-white">New Staff Member</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-zinc-400 uppercase mt-1">Provision a new station operator account.</DialogDescription>
           </div>
           <form onSubmit={handleCreateStaff} className="p-8 space-y-6">
              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Full Name</Label>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Samuel Maina" className="h-12 bg-zinc-50 border-none rounded-xl font-bold" required />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Email Address</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@urban.co.ke" className="h-12 bg-zinc-50 border-none rounded-xl font-bold" required />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Temporary Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className="h-12 bg-zinc-50 border-none rounded-xl font-bold" required />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Primary Role</Label>
                    <Select value={role} onValueChange={(v: any) => setRole(v)} required>
                       <SelectTrigger className="h-12 bg-zinc-50 border-none rounded-xl font-bold uppercase"><SelectValue placeholder="Select" /></SelectTrigger>
                       <SelectContent className="rounded-xl border-none shadow-2xl">
                          {ROLES.map(r => <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">{r}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>
                 
                 <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Station Authorization</Label>
                    <div className="grid grid-cols-1 gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                       {UNITS.map(u => (
                         <div key={u.value} className="flex items-center justify-between group cursor-pointer" onClick={() => toggleUnit(u.value)}>
                            <span className={cn("text-[10px] font-black uppercase transition-colors", assignedUnits.includes(u.value) ? "text-primary" : "text-zinc-400")}>{u.label}</span>
                            <div className={cn("w-5 h-5 rounded-md flex items-center justify-center border transition-all", assignedUnits.includes(u.value) ? "bg-primary border-primary text-white" : "bg-white border-zinc-200")}>
                               {assignedUnits.includes(u.value) && <Check className="w-3.5 h-3.5" />}
                            </div>
                         </div>
                       ))}
                    </div>
                    <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest px-1">Select all stations this user is authorized to operate.</p>
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Base Monthly Salary (KES)</Label>
                    <Input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="0" className="h-12 bg-zinc-50 border-none rounded-xl font-black" />
                 </div>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">
                {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Authorize Staff Member'}
              </Button>
           </form>
        </DialogContent>
      </Dialog>

      {/* --- EDIT DIALOG --- */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-h-[90vh] overflow-y-auto">
           <div className="bg-primary/5 p-8 text-center border-b border-primary/10">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary mx-auto mb-4"><Edit2 className="w-7 h-7" /></div>
              <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">Synchronize Profile</DialogTitle>
              <DialogDescription className="text-[10px] font-bold text-zinc-400 uppercase mt-1">Update personnel variables and access nodes.</DialogDescription>
           </div>
           <form onSubmit={handleUpdateRole} className="p-8 space-y-6">
              <div className="space-y-4">
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Display Name</Label>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-12 bg-zinc-50 border-none rounded-xl font-bold" required />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">System Role</Label>
                    <Select value={role} onValueChange={(v: any) => setRole(v)} required>
                       <SelectTrigger className="h-12 bg-zinc-50 border-none rounded-xl font-bold uppercase"><SelectValue /></SelectTrigger>
                       <SelectContent className="rounded-xl">
                          {ROLES.map(r => <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">{r}</SelectItem>)}
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="space-y-3">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Station Authorization</Label>
                    <div className="grid grid-cols-1 gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                       {UNITS.map(u => (
                         <div key={u.value} className="flex items-center justify-between group cursor-pointer" onClick={() => toggleUnit(u.value)}>
                            <span className={cn("text-[10px] font-black uppercase transition-colors", assignedUnits.includes(u.value) ? "text-primary" : "text-zinc-400")}>{u.label}</span>
                            <div className={cn("w-5 h-5 rounded-md flex items-center justify-center border transition-all", assignedUnits.includes(u.value) ? "bg-primary border-primary text-white" : "bg-white border-zinc-200")}>
                               {assignedUnits.includes(u.value) && <Check className="w-3.5 h-3.5" />}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">M-Pesa Number</Label>
                    <Input value={mpesaNumber} onChange={e => setMpesaNumber(e.target.value)} className="h-12 bg-zinc-50 border-none rounded-xl font-mono font-bold" />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Base Salary (KES)</Label>
                    <Input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} className="h-12 bg-zinc-50 border-none rounded-xl font-black" />
                 </div>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Save Changes</Button>
           </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
