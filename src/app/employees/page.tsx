'use client';

import { PageHeader } from '@/components/shared/page-layout';
import { FullPageEditor } from '@/components/admin/full-page-editor';
import Link from 'next/link';

import React, { useMemo, useState } from 'react';
import { getAuth } from '@/lib/db';
import { notifyTelegramClientEvent } from '@/lib/telegram/client-events';
import {
  Search,
  Trash2,
  Edit2,
  RefreshCcw,
  Plus,
  UserPlus,
  KeyRound,
  UserMinus,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Monitor,
  Settings2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDb, useCollection } from '@/lib/data';
import { collection, query, orderBy, addDoc } from '@/lib/db';
import { UserProfile, UserRole, BusinessUnit, BusinessBranch } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import {
  adminCreateUser,
  adminUpdateStaff,
  adminResetUserPassword,
  adminSetStaffActiveStatus,
  adminSuspendUser,
  adminReactivateUser,
  adminDeleteUser,
} from '@/lib/actions';

const ALL_STAFF_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN'];
const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN'];
const UNITS: { label: string; value: BusinessUnit }[] = [
  { label: 'Lounge & Bar', value: 'LOUNGE' },
  { label: 'Auto Accessories', value: 'STORE' },
  { label: 'Carwash Detailing', value: 'CARWASH' },
];

export default function StaffDirectory() {
  const firestore = useDb();
  const { profile, isSuperAdmin } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('staff');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string>('');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [branchId, setBranchId] = useState<string>('ALL');
  const [pin, setPin] = useState('');
  const [assignedUnits, setAssignedUnits] = useState<BusinessUnit[]>([]);
  const [baseSalary, setBaseSalary] = useState('');
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [newPasswordReset, setNewPasswordReset] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const usersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const branchesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'branches'), orderBy('createdAt', 'asc'));
  }, [firestore]);

  const { data: allUsers, loading } = useCollection<UserProfile>(usersQuery);
  const { data: branches } = useCollection<BusinessBranch>(branchesQuery);

  const staffList = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((u) => u.role !== 'CLIENT' && u.role !== undefined);
  }, [allUsers]);

  const clientList = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((u) => u.role === 'CLIENT' || u.role === undefined);
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    const baseList = activeTab === 'staff' ? staffList : clientList;
    return baseList.filter((s) => {
      const matchesSearch =
        !searchTerm ||
        s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole =
        roleFilter === 'ALL' ||
        (roleFilter === 'SUPER_ADMIN' ? (s.isSuperAdmin || s.role === 'SUPER_ADMIN') : s.role === roleFilter);
      const isSuspended = s.status === 'suspended' || s.disabled === true;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'SUSPENDED' ? isSuspended : !isSuspended);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staffList, clientList, searchTerm, activeTab, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(start, start + itemsPerPage);
  }, [filteredUsers, currentPage]);

  const toggleUnit = (unit: BusinessUnit) => {
    setAssignedUnits((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    );
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile || !role) return;
    if (pin && !/^\d{4}$/.test(pin)) {
      toast({ variant: 'destructive', title: 'Invalid PIN', description: 'Optional PIN must be exactly 4 digits.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await adminCreateUser({
        email: email.toLowerCase().trim(),
        password,
        displayName: displayName.trim(),
        role: role as UserRole,
        branchId: branchId !== 'ALL' ? branchId : null,
        assignedUnits,
        baseSalary: Number(baseSalary) || 0,
        mpesaNumber: mpesaNumber.trim() || null,
        pin: pin.trim() || null,
        idToken,
      });

      if (!res.success) throw new Error(res.message);

      void notifyTelegramClientEvent(getAuth().currentUser, { type: 'EMPLOYEE_CREATED', name: displayName, role });
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'STAFF_PROVISIONED',
        userId: profile.uid,
        details: `Created new ${role} account: ${displayName} (${email}). Assigned Stations: ${assignedUnits.join(', ') || 'Global'}`,
        timestamp: Date.now(),
        severity: 'INFO',
      }).catch(() => undefined);

      setIsAddOpen(false);
      resetForm();
      toast({ title: 'Staff Account Created', description: `${displayName} can now sign in immediately.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not create staff', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !selectedUser || !profile || !role) return;
    if (pin && !/^\d{4}$/.test(pin)) {
      toast({ variant: 'destructive', title: 'Invalid PIN', description: 'Optional PIN must be exactly 4 digits.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await adminUpdateStaff({
        uid: selectedUser.uid,
        displayName: displayName.trim(),
        role: role as UserRole,
        branchId: branchId !== 'ALL' ? branchId : null,
        assignedUnits,
        baseSalary: Number(baseSalary) || 0,
        mpesaNumber: mpesaNumber.trim() || null,
        pin: pin.trim() || null,
        idToken,
      });
      if (!res.success) throw new Error(res.message);

      void notifyTelegramClientEvent(getAuth().currentUser, {
        type: 'EMPLOYEE_ROLE_CHANGED',
        name: displayName,
        role,
        previousRole: selectedUser.role,
      });
      setIsEditOpen(false);
      resetForm();
      toast({ title: 'Staff Profile Updated' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message || 'Could not update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPasswordReset || isSubmitting) return;
    if (newPasswordReset.length < 8) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Use at least 8 characters.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await adminResetUserPassword(selectedUser.uid, newPasswordReset, idToken);
      if (!res.success) throw new Error(res.message);
      setNewPasswordReset('');
      toast({ title: 'Password Reset', description: `Password updated for ${selectedUser.displayName}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Password Reset Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDeactivate = async () => {
    if (!selectedUser || isSubmitting) return;
    const isCurrentlySuspended = selectedUser.status === 'suspended' || selectedUser.disabled === true;
    setIsSubmitting(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      if (isCurrentlySuspended) {
        const res = await adminReactivateUser(selectedUser.uid, idToken);
        if (!res.success) throw new Error(res.message);
        setSelectedUser({ ...selectedUser, disabled: false, status: 'active' });
        toast({
          title: 'Account Reactivated',
          description: `${selectedUser.displayName} can now sign in normally.`,
        });
      } else {
        const res = await adminSuspendUser(selectedUser.uid, suspendReason || 'Suspended by administrator', idToken);
        if (!res.success) throw new Error(res.message);
        setSelectedUser({ ...selectedUser, disabled: true, status: 'suspended' });
        toast({
          title: 'Account Suspended',
          description: `${selectedUser.displayName} is now barred from signing in.`,
        });
      }
      setSuspendReason('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Status Change Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!selectedUser || isSubmitting) return;
    if (deleteConfirmEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase()) {
      toast({ variant: 'destructive', title: 'Confirmation Mismatch', description: 'Type the exact email address to confirm deletion.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await adminDeleteUser(selectedUser.uid, { confirmEmail: deleteConfirmEmail.trim().toLowerCase(), idToken });
      if (!res.success) throw new Error(res.message);
      setIsEditOpen(false);
      setIsConfirmDeleteOpen(false);
      resetForm();
      toast({ 
        title: res.mode === 'soft-deleted' ? 'Account Archived (Soft-Deleted)' : 'Account Permanently Deleted', 
        description: res.message || `${selectedUser.displayName} was successfully removed.` 
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setDisplayName(user.displayName || '');
    setRole(user.role || 'CLIENT');
    setBranchId(user.activeBranchId || user.branchIds?.[0] || 'ALL');
    setPin('');
    setAssignedUnits(user.assignedUnits || []);
    setBaseSalary(user.baseSalary?.toString() || '0');
    setMpesaNumber(user.mpesaNumber || '');
    setNewPasswordReset('');
    setSuspendReason(user.suspendedReason || '');
    setDeleteConfirmEmail('');
    setIsConfirmDeleteOpen(false);
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('');
    setBranchId('ALL');
    setPin('');
    setAssignedUnits([]);
    setBaseSalary('');
    setMpesaNumber('');
    setNewPasswordReset('');
    setSuspendReason('');
    setDeleteConfirmEmail('');
    setIsConfirmDeleteOpen(false);
    setSelectedUser(null);
  };

  const renderUserTable = (list: UserProfile[]) => (
    <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100">
      <CardContent className="p-0">
        <div className="grid gap-3 px-3 py-3 md:hidden">
          {loading ? (
            <div className="py-10 text-center text-xs font-semibold text-zinc-400">Loading personnel...</div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-xs text-zinc-400">
              No matching records found.
            </div>
          ) : (
            list.map((user) => {
              const isSuspended = user.status === 'suspended' || user.disabled === true;
              const isSuper = user.isSuperAdmin || user.role === 'SUPER_ADMIN' || user.email === 'gackstoneb@gmail.com';
              const isAdmin = isSuper || user.role === 'ADMIN' || user.email === 'bonfacewana3072@gmail.com';
              return (
                <article key={user.uid} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0 rounded-xl">
                      <AvatarImage src={user.photoURL || undefined} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">
                        {user.displayName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="break-words text-sm font-black uppercase text-zinc-900">{user.displayName}</p>
                        {user.email === 'gackstoneb@gmail.com' && (
                          <span className="text-[9px] bg-purple-100 text-purple-900 font-extrabold px-1.5 py-0.5 rounded">ROOT</span>
                        )}
                      </div>
                      <p className="mt-1 break-all text-[11px] font-medium text-zinc-500">{user.email}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isSuper ? (
                          <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-[9px] font-black uppercase">
                            SUPER ADMIN
                          </Badge>
                        ) : isAdmin ? (
                          <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[9px] font-black uppercase">
                            ADMIN
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] font-bold uppercase">
                            {user.role || 'CLIENT'}
                          </Badge>
                        )}
                        {isSuspended ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[8px] font-black uppercase">
                            SUSPENDED
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[8px] font-black uppercase">
                            ACTIVE
                          </Badge>
                        )}
                        {user.hasPin && (
                          <Badge variant="secondary" className="text-[9px] font-bold uppercase">
                            PIN Set
                          </Badge>
                        )}
                        <span className="text-[11px] font-semibold text-zinc-600">
                          KES {(user.baseSalary || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      aria-label={`Edit ${user.displayName}`}
                      onClick={() => openEdit(user)}
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-lg"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow>
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black text-zinc-400">Identity</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Role</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Status</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Salary</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((user) => {
                const isSuspended = user.status === 'suspended' || user.disabled === true;
                const isSuper = user.isSuperAdmin || user.role === 'SUPER_ADMIN' || user.email === 'gackstoneb@gmail.com';
                const isAdmin = isSuper || user.role === 'ADMIN' || user.email === 'bonfacewana3072@gmail.com';
                return (
                  <TableRow key={user.uid} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 rounded-xl">
                          <AvatarImage src={user.photoURL || undefined} />
                          <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                            {user.displayName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black uppercase text-zinc-900">{user.displayName}</p>
                            {user.email === 'gackstoneb@gmail.com' && (
                              <span className="text-[9px] bg-purple-100 text-purple-900 font-extrabold px-1.5 py-0.5 rounded">ROOT</span>
                            )}
                          </div>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {isSuper ? (
                        <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-[9px] font-black uppercase">
                          SUPER ADMIN
                        </Badge>
                      ) : isAdmin ? (
                        <Badge className="bg-blue-100 text-blue-900 border-blue-300 text-[9px] font-black uppercase">
                          ADMIN
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-zinc-200">
                          {user.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        {isSuspended ? (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[8px] font-black uppercase">
                            SUSPENDED
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[8px] font-black uppercase">
                            ACTIVE
                          </Badge>
                        )}
                        {user.hasPin && (
                          <Badge variant="secondary" className="text-[8px] font-black uppercase">
                            PIN
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black">KES {(user.baseSalary || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right pr-8">
                      <Button
                        aria-label={`Edit ${user.displayName}`}
                        onClick={() => openEdit(user)}
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-zinc-400 hover:text-zinc-900"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-4 border-t border-zinc-50">
            <p className="text-[10px] font-black uppercase text-zinc-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="h-10 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="h-10 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="staff-directory ua-compact-page space-y-5 pb-12 sm:space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 pt-4">
        <div>
          <PageHeader title="Employee Management" breadcrumb={['Staff', 'Employee Management']} className="mb-0" />
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">
            Manage staff accounts and POS access
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <>
              <Button asChild variant="outline" className="h-10 rounded-md border-zinc-200 px-3 text-[10px] font-semibold">
                <Link href="/admin?tab=stations">
                  <Monitor className="mr-2 h-3.5 w-3.5" />
                  POS Stations
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-md border-zinc-200 px-3 text-[10px] font-semibold">
                <Link href="/admin?tab=config">
                  <Settings2 className="mr-2 h-3.5 w-3.5" />
                  Global Settings
                </Link>
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="h-10 w-full sm:w-auto rounded-md px-5 sm:px-6 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-semibold gap-2 transition-all"
          >
            <Plus className="w-4 h-4 text-primary" /> Add Staff
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="staff"
        className="w-full"
        onValueChange={(v) => {
          setActiveTab(v);
          setCurrentPage(1);
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl sm:rounded-[2rem] shadow-sm border border-zinc-100 mb-6 mx-2">
          <TabsList className="bg-zinc-100/50 p-1 rounded-xl h-12 w-full sm:w-auto">
            <TabsTrigger value="staff" className="rounded-xl h-full px-6 text-[10px] font-black uppercase tracking-widest flex-1 sm:flex-none">
              Staff
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-xl h-full px-6 text-[10px] font-black uppercase tracking-widest flex-1 sm:flex-none">
              Customers
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-11 h-12 bg-zinc-50 border-none rounded-xl font-bold w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-12 w-36 bg-zinc-50 border-none rounded-xl font-bold text-[10px] uppercase">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="text-[10px] font-black uppercase">All Roles</SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="SUPER_ADMIN" className="text-[10px] font-black uppercase">Super Admin</SelectItem>
                  )}
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">{r}</SelectItem>
                  ))}
                  <SelectItem value="CLIENT" className="text-[10px] font-black uppercase">Client</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-12 w-32 bg-zinc-50 border-none rounded-xl font-bold text-[10px] uppercase">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL" className="text-[10px] font-black uppercase">All Status</SelectItem>
                  <SelectItem value="ACTIVE" className="text-[10px] font-black uppercase">Active</SelectItem>
                  <SelectItem value="SUSPENDED" className="text-[10px] font-black uppercase">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TabsContent value="staff" className="m-0 px-2">
          {renderUserTable(paginatedUsers)}
        </TabsContent>
        <TabsContent value="clients" className="m-0 px-2">
          {renderUserTable(paginatedUsers)}
        </TabsContent>
      </Tabs>

      {/* --- ADD STAFF DIALOG --- */}
      <FullPageEditor
        open={isAddOpen}
        title="New staff member"
        description="Create a staff account and assign role, branch, station access, and optional POS PIN."
        onClose={() => {
          setIsAddOpen(false);
          resetForm();
        }}
      >
        <div className="w-full">
          <div className="bg-zinc-900 p-8 text-center border-b border-white/10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
              <UserPlus className="w-7 h-7" />
            </div>
            <h3 className="font-headline uppercase tracking-widest text-lg text-white">New Staff Member</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1">
              Provision a ready-to-use staff account (immediate login, no verification blockers).
            </p>
          </div>
          <form onSubmit={handleCreateStaff} className="p-4 sm:p-8 space-y-5 sm:space-y-6">
            <div className="space-y-4 ua-compact-page">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Full Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Samuel Maina"
                  className="h-12 bg-zinc-50 border-none rounded-xl font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@urban.co.ke"
                  className="h-12 bg-zinc-50 border-none rounded-xl font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Temporary Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className="h-12 bg-zinc-50 border-none rounded-xl font-bold"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Primary Role</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)} required>
                    <SelectTrigger className="h-12 bg-zinc-50 border-none rounded-xl font-bold uppercase">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {(isSuperAdmin ? ALL_STAFF_ROLES : ROLES).map((r) => (
                        <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Assigned Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="h-12 bg-zinc-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="ALL" className="text-[10px] font-black uppercase">
                        All / Default Branch
                      </SelectItem>
                      {(branches || []).map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-[10px] font-black uppercase">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">
                  Optional 4-Digit Terminal PIN (for fast POS switching)
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder="Leave blank or enter 4 digits (e.g. 1234)"
                  className="h-12 bg-zinc-50 border-none rounded-xl font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Station Authorization</Label>
                <div className="grid grid-cols-1 gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  {UNITS.map((u) => (
                    <div
                      key={u.value}
                      className="flex items-center justify-between group cursor-pointer"
                      onClick={() => toggleUnit(u.value)}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase transition-colors',
                          assignedUnits.includes(u.value) ? 'text-primary' : 'text-zinc-400'
                        )}
                      >
                        {u.label}
                      </span>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center border transition-all',
                          assignedUnits.includes(u.value)
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-zinc-200'
                        )}
                      >
                        {assignedUnits.includes(u.value) && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Base Monthly Salary (KES)</Label>
                  <Input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="0"
                    className="h-12 bg-zinc-50 border-none rounded-xl font-black"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">M-Pesa Number (Optional)</Label>
                  <Input
                    value={mpesaNumber}
                    onChange={(e) => setMpesaNumber(e.target.value)}
                    placeholder="07..."
                    className="h-12 bg-zinc-50 border-none rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
            >
              {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Authorize Staff Member'}
            </Button>
          </form>
        </div>
      </FullPageEditor>

      {/* --- EDIT STAFF DIALOG --- */}
      <FullPageEditor
        open={isEditOpen}
        title="Edit staff profile"
        description="Update role, branch, PIN, password, or account status."
        onClose={() => {
          setIsEditOpen(false);
          resetForm();
        }}
      >
        <div className="w-full">
          <div className="bg-primary/5 p-8 text-center border-b border-primary/10">
            <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary mx-auto mb-4">
              <Edit2 className="w-7 h-7" />
            </div>
            <h3 className="font-headline uppercase tracking-widest text-lg text-zinc-900">Synchronize Profile</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1">{selectedUser?.email}</p>
          </div>
          <form onSubmit={handleUpdateRole} className="p-4 sm:p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 bg-zinc-50 border-none rounded-xl font-bold"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">System Role</Label>
                  <Select 
                    value={role} 
                    onValueChange={(v: any) => setRole(v)} 
                    disabled={selectedUser?.email === 'gackstoneb@gmail.com'}
                    required
                  >
                    <SelectTrigger className="h-12 bg-zinc-50 border-none rounded-xl font-bold uppercase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(isSuperAdmin ? [...ALL_STAFF_ROLES, 'CLIENT' as UserRole] : [...ROLES, 'CLIENT' as UserRole]).map((r) => (
                        <SelectItem key={r} value={r} className="text-[10px] font-black uppercase">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Assigned Branch</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger className="h-12 bg-zinc-50 border-none rounded-xl font-bold">
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ALL" className="text-[10px] font-black uppercase">
                        All / Default Branch
                      </SelectItem>
                      {(branches || []).map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-[10px] font-black uppercase">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">
                  Set / Change 4-Digit Terminal PIN (Optional)
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  placeholder={selectedUser?.hasPin ? 'PIN configured — enter 4 digits to replace' : 'Enter 4 digits to set a PIN'}
                  className="h-12 bg-zinc-50 border-none rounded-xl font-bold"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Station Authorization</Label>
                <div className="grid grid-cols-1 gap-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  {UNITS.map((u) => (
                    <div
                      key={u.value}
                      className="flex items-center justify-between group cursor-pointer"
                      onClick={() => toggleUnit(u.value)}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase transition-colors',
                          assignedUnits.includes(u.value) ? 'text-primary' : 'text-zinc-400'
                        )}
                      >
                        {u.label}
                      </span>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center border transition-all',
                          assignedUnits.includes(u.value)
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-zinc-200'
                        )}
                      >
                        {assignedUnits.includes(u.value) && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">M-Pesa Number</Label>
                  <Input
                    value={mpesaNumber}
                    onChange={(e) => setMpesaNumber(e.target.value)}
                    className="h-12 bg-zinc-50 border-none rounded-xl font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Base Salary (KES)</Label>
                  <Input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="h-12 bg-zinc-50 border-none rounded-xl font-black"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-zinc-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
            >
              {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>

            {/* Admin Security Controls: Password Reset, Suspend/Reactivate, Delete */}
            {selectedUser && (
              <div className="pt-6 border-t border-zinc-200 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-zinc-500 px-1">Reset Account Password</Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={newPasswordReset}
                      onChange={(e) => setNewPasswordReset(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="h-11 bg-zinc-50 border-zinc-200 rounded-xl font-bold flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting || newPasswordReset.length < 8}
                      onClick={() => void handleResetPassword()}
                      className="h-11 rounded-xl font-black uppercase text-[10px] tracking-widest gap-1.5"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Reset
                    </Button>
                  </div>
                </div>

                {/* Suspension reason input */}
                <div className="space-y-2 pt-2">
                  {selectedUser.status !== 'suspended' && !selectedUser.disabled && (
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-zinc-500 px-1">Suspension Reason (Optional)</Label>
                      <Input
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        placeholder="e.g. Policy violation / pending investigation"
                        className="h-11 bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting || selectedUser.email === 'gackstoneb@gmail.com' || selectedUser.uid === profile?.uid}
                      onClick={() => void handleToggleDeactivate()}
                      className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                    >
                      {(selectedUser.status === 'suspended' || selectedUser.disabled) ? (
                        <>
                          <UserCheck className="w-4 h-4 text-emerald-600" /> Reactivate Account
                        </>
                      ) : (
                        <>
                          <UserMinus className="w-4 h-4 text-amber-600" /> Suspend Account
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isSubmitting || selectedUser.email === 'gackstoneb@gmail.com' || selectedUser.email === 'bonfacewana3072@gmail.com' || selectedUser.uid === profile?.uid}
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="flex-1 h-11 rounded-xl font-black uppercase text-[10px] tracking-widest gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Account
                    </Button>
                  </div>
                </div>

                {/* Two-step delete confirmation panel */}
                {isConfirmDeleteOpen && (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-3">
                    <p className="text-xs font-bold text-red-900">
                      Confirm Deletion of {selectedUser.displayName} ({selectedUser.email})
                    </p>
                    <p className="text-[11px] text-red-700">
                      If this account has historical orders, sessions, or carwash jobs, it will be safely archived (soft-deleted) to preserve financial and audit integrity.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-[9px] font-black uppercase text-red-800">
                        Type &quot;{selectedUser.email}&quot; to confirm:
                      </Label>
                      <Input
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        placeholder={selectedUser.email}
                        className="h-10 bg-white border-red-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isSubmitting || deleteConfirmEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase()}
                        onClick={() => void handleDeleteStaff()}
                        className="h-10 text-[10px] font-black uppercase rounded-lg"
                      >
                        {isSubmitting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Confirm Delete
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsConfirmDeleteOpen(false);
                          setDeleteConfirmEmail('');
                        }}
                        className="h-10 text-[10px] font-bold uppercase rounded-lg"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </FullPageEditor>
    </div>
  );
}
