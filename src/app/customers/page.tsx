'use client';

import { PageHeader } from '@/components/shared/page-layout';
import Link from 'next/link';

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Award, 
  Car, 
  History, 
  TrendingUp, 
  Smartphone, 
  Mail, 
  Filter, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink,
  ShieldCheck,
  Star,
  Activity,
  CreditCard,
  Target,
  ArrowUpRight,
  Monitor,
  Settings2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserProfile, Order, CarwashJob } from '@/lib/types';
import { cn } from '@/lib/utils';
import { exportAsReceiptText } from '@/lib/csv-export';
import { toast } from '@/hooks/use-toast';
import { useProfile } from '@/hooks/use-profile';

export default function CustomerCRM() {
  const firestore = useFirestore();
  const { isSuperAdmin } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const customersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'CLIENT'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: customers, loading } = useCollection<UserProfile>(customersQuery);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phoneNumber?.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage]);

  return (
    <div className="ua-compact-page space-y-5 pb-12 max-w-[1600px] mx-auto px-2">
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader title="Customers" breadcrumb={["Operations", "Customers"]} className="mb-0" />
          <p className="mt-1 text-xs text-zinc-500">Master Member Registry</p>
        </div>
        {isSuperAdmin && <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="h-10 rounded-md border-zinc-200 px-3 text-[10px] font-semibold"><Link href="/admin?tab=stations"><Monitor className="mr-2 h-3.5 w-3.5" />POS Stations</Link></Button><Button asChild variant="outline" className="h-10 rounded-md border-zinc-200 px-3 text-[10px] font-semibold"><Link href="/admin?tab=config"><Settings2 className="mr-2 h-3.5 w-3.5" />Global Settings</Link></Button></div>}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-zinc-200">
        <div className="relative flex-1 max-w-xl">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
           <Input 
             placeholder="Search by name, phone or email..." 
             value={searchTerm}
             onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
             className="pl-12 h-14 bg-zinc-50 border-none rounded-2xl font-bold" 
           />
        </div>
      </div>

      <Card className="border-none shadow-mobile rounded-lg overflow-hidden bg-white border border-zinc-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="hover:bg-transparent border-zinc-100">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Customer Identity</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Points</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Lifetime Spent</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-right text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCustomers.map((member) => (
                <TableRow key={member.uid} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 rounded-xl">
                        <AvatarImage src={member.photoURL || undefined} />
                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black uppercase">{member.displayName?.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-black text-zinc-900 uppercase leading-none mb-1">{member.displayName}</p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{member.phoneNumber || member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs font-black text-primary uppercase">{(member.loyaltyPoints || 0).toLocaleString()} PTS</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-black text-zinc-900">KES {(member.totalSpent || 0).toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                     <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-300 hover:text-primary rounded-xl"><ChevronRight className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
             <div className="flex items-center justify-between px-8 py-4 bg-white border-t border-zinc-50">
                <p className="text-[10px] font-black uppercase text-zinc-400">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-9 px-4 rounded-xl transition-all"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-9 px-4 rounded-xl transition-all">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
