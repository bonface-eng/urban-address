'use client';

import React, { useState, useMemo } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MoreVertical, 
  Building2,
  Filter,
  Download,
  Trash2,
  Edit2,
  User,
  Tags,
  RefreshCcw,
  ShieldAlert,
  UserMinus
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Supplier } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { exportAsReceiptText } from '@/lib/csv-export';

const CATEGORIES = ['Parts', 'Beverages', 'Food', 'Cleaning Supplies', 'Oils', 'Electronics', 'Other'];

export default function SuppliersPage() {
  const firestore = useFirestore();
  const { profile, isSuperAdmin } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [vendorToDelete, setVendorToDelete] = useState<{ id: string, name: string } | null>(null);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const suppliersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'suppliers'), orderBy('name', 'asc'));
  }, [firestore]);

  const { data: suppliers, loading } = useCollection<Supplier>(suppliersQuery);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => {
      const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [suppliers, searchTerm, categoryFilter]);

  const handleExportVendors = () => {
    if (!filteredSuppliers || filteredSuppliers.length === 0) return;
    
    const headers = {
      name: 'Vendor',
      contactPerson: 'Contact',
      category: 'Class',
      phone: 'Phone',
      email: 'Email',
      status: 'Status'
    };

    exportAsReceiptText(filteredSuppliers, 'Vendor_Network_Registry', headers);
    toast({ title: "Vendors Exported", description: "TXT file generated in POS layout." });
  };

  const handleRegisterVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile) return;

    setIsSubmitting(true);
    const vendorData = {
      name,
      contactPerson,
      phone,
      email,
      category: category || 'Other',
      status: 'ACTIVE' as const,
    };

    try {
      if (selectedSupplierId) {
        await updateDoc(doc(firestore, 'suppliers', selectedSupplierId), vendorData);
        await addDoc(collection(firestore, 'audit_logs'), {
          action: 'SUPPLIER_UPDATE',
          userId: profile.uid,
          details: `Synchronized vendor record for: ${name}`,
          timestamp: Date.now(),
          severity: 'INFO'
        });
        toast({ title: "Vendor Updated", description: "Procurement records synchronized." });
      } else {
        await addDoc(collection(firestore, 'suppliers'), vendorData);
        await addDoc(collection(firestore, 'audit_logs'), {
          action: 'SUPPLIER_REGISTER',
          userId: profile.uid,
          details: `Registered new vendor: ${name} (${category})`,
          timestamp: Date.now(),
          severity: 'INFO'
        });
        toast({ title: "Vendor Registered", description: `${name} added to global network.` });
      }

      setIsDialogOpen(false);
      setIsEditOpen(false);
      resetForm();
    } catch (err) {
      console.error('[SUPPLIER_SAVE_ERROR]', err);
      toast({ variant: "destructive", title: "Action Failed", description: "Failed to save vendor record." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id!);
    setName(supplier.name);
    setContactPerson(supplier.contactPerson);
    setPhone(supplier.phone);
    setEmail(supplier.email);
    setCategory(supplier.category);
    setIsEditOpen(true);
  };

  const handleExecuteDelete = async () => {
    if (!firestore || !profile || !isSuperAdmin || !vendorToDelete) return;

    try {
      await deleteDoc(doc(firestore, 'suppliers', vendorToDelete.id));
      
      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'SUPPLIER_DELETE',
        userId: profile.uid,
        details: `Permanently removed vendor: ${vendorToDelete.name}`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });

      setVendorToDelete(null);
      toast({ title: "Supplier Deleted", description: "Supplier record removed." });
    } catch (err) {
      toast({ variant: "destructive", title: "Access Denied", description: "Master governance rules blocked removal." });
    }
  };

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCategory('');
    setSelectedSupplierId(null);
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Supplier Network</h1>
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">Global procurement and vendor registry.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleExportVendors}
            variant="outline" 
            className="h-11 px-6 text-[10px] font-black uppercase tracking-widest border-zinc-200 bg-white shadow-sm active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if(!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button 
                className="h-11 px-8 bg-primary hover:bg-orange-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 mr-2" /> Register Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <div className="bg-primary/5 p-10 border-b border-primary/10">
                 <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary mb-6">
                    <Truck className="w-7 h-7" />
                 </div>
                 <DialogHeader>
                    <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">New Vendor Identity</DialogTitle>
                    <DialogDescription className="text-xs uppercase font-bold text-zinc-400">Add a new partner to the global procurement registry.</DialogDescription>
                 </DialogHeader>
              </div>
              <form onSubmit={handleRegisterVendor} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Legal Company Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shell Kenya" className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 font-bold" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Contact Person</Label>
                    <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Full Name" className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Category</Label>
                    <Select value={category} onValueChange={setCategory} required>
                      <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl px-5 text-[10px] font-black uppercase">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-[10px] font-black uppercase">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Phone Number</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254..." className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-mono font-bold" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Official Email</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" />
                  </div>
                </div>
                <DialogFooter className="pt-6">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all">
                    {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Authorize Vendor Status'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="relative flex-1 max-w-xl">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
           <Input 
             placeholder="Search vendor registry..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="pl-12 h-14 bg-zinc-50 border-none rounded-2xl font-bold" 
           />
        </div>
        <div className="w-full md:w-64">
           <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-14 bg-white border-zinc-200 rounded-2xl font-bold uppercase text-[10px] shadow-sm">
                 <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary" />
                    <SelectValue placeholder="All Categories" />
                 </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-none shadow-2xl">
                 <SelectItem value="ALL" className="font-bold uppercase text-[10px]">All Classes</SelectItem>
                 {CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-bold uppercase text-[10px]">{c}</SelectItem>)}
              </SelectContent>
           </Select>
        </div>
      </div>

      <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="hover:bg-transparent border-zinc-100">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400">Vendor / Company</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400">Class</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400">Official Contact</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 text-center">Status</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 border border-zinc-100 group-hover:bg-white shadow-sm transition-all group-hover:scale-110">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-zinc-900 uppercase leading-tight mb-1">{supplier.name}</p>
                        <p className="text-[9px] text-zinc-400 font-mono font-bold tracking-widest">{supplier.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-black uppercase border-zinc-200 bg-white px-3 shadow-sm">{supplier.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-bold text-zinc-600 uppercase">{supplier.contactPerson}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className={cn(
                      "inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm",
                      supplier.status === 'ACTIVE' ? "bg-green-50 border-green-100 text-green-600" : "bg-zinc-50 border-zinc-200 text-zinc-400"
                    )}>
                       <div className="w-1.5 h-1.5 rounded-full bg-current" />
                       <span className="text-[9px] font-black uppercase tracking-tighter">{supplier.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2 transition-all">
                      <Button onClick={() => openEdit(supplier)} variant="ghost" size="icon" className="h-10 w-10 text-zinc-400 hover:text-zinc-900 bg-white border border-zinc-100 shadow-sm rounded-xl active:scale-90 transition-all"><Edit2 className="w-4 h-4" /></Button>
                      <Button onClick={() => setVendorToDelete({ id: supplier.id!, name: supplier.name })} variant="ghost" size="icon" className="h-10 w-10 text-zinc-200 hover:text-red-500 bg-white border border-zinc-100 shadow-sm rounded-xl active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredSuppliers || filteredSuppliers.length === 0) && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-32 text-center opacity-30 font-black text-[11px] uppercase tracking-[0.4em]">
                    No vendor records found in OS nodes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(o) => { setIsEditOpen(o); if(!o) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <div className="bg-primary/5 p-10 border-b border-primary/10">
             <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary mb-6">
                <Edit2 className="w-7 h-7" />
             </div>
             <DialogHeader>
                <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">Synchronize Vendor</DialogTitle>
                <DialogDescription className="text-xs uppercase font-bold text-zinc-400">Update supplier credentials and procurement variables.</DialogDescription>
             </DialogHeader>
          </div>
          <form onSubmit={handleRegisterVendor} className="p-8 space-y-5">
             <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Legal Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <Input value={name} onChange={e => setName(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-2xl pl-12 font-bold" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Contact Person</Label>
                  <Input value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Category</Label>
                  <Select value={category} onValueChange={setCategory} required>
                    <SelectTrigger className="h-14 bg-zinc-50 border-none rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl">
                      {CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-[10px] font-black uppercase">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Official Phone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-mono font-bold" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">Official Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" />
                </div>
              </div>
              <DialogFooter className="pt-6">
                <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">
                  {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Finalize Registry Update'}
                </Button>
              </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!vendorToDelete} onOpenChange={(o) => !o && setVendorToDelete(null)}>
         <AlertDialogContent className="rounded-[3rem] border-none shadow-2xl p-10 max-w-[420px] bg-white">
            <div className="w-20 h-20 rounded-[2.5rem] bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-8 shadow-inner ring-8 ring-white">
               <ShieldAlert className="w-10 h-10" />
            </div>
            <AlertDialogHeader className="text-center space-y-4">
               <AlertDialogTitle className="font-headline uppercase tracking-tighter text-2xl text-zinc-900">Delete Supplier</AlertDialogTitle>
               <AlertDialogDescription className="text-xs font-bold uppercase text-zinc-400 leading-relaxed px-4">
                  Are you sure you want to permanently remove <span className="text-zinc-900 font-black">"{vendorToDelete?.name}"</span> from the global supplier network?
               </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-10 flex-col sm:flex-row gap-4">
               <AlertDialogCancel className="h-14 rounded-2xl uppercase font-black text-[10px] tracking-widest border-zinc-100 w-full hover:bg-zinc-50 shadow-sm transition-all">Abort Removal</AlertDialogCancel>
               <AlertDialogAction 
                  onClick={handleExecuteDelete}
                  className="h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white uppercase font-black text-[10px] tracking-widest w-full shadow-lg shadow-red-100 transition-all active:scale-95"
               >
                  Authorize Delete
               </AlertDialogAction>
            </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}