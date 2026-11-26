'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useMemo, useState } from 'react';
import { 
  MessageSquare, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  RefreshCcw, 
  ChevronRight, 
  ChevronLeft,
  Mail, 
  User, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Archive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';

export default function AdminSupportInbox() {
  const firestore = useFirestore();
  const { profile, isSuperAdmin } = useProfile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const queriesQuery = useMemo(() => {
    if (!firestore || !isSuperAdmin) return null;
    return query(collection(firestore, 'support_queries'), orderBy('timestamp', 'desc'));
  }, [firestore, isSuperAdmin]);

  const { data: queries, loading } = useCollection<any>(queriesQuery);

  const filteredQueries = useMemo(() => {
    if (!queries) return [];
    return queries.filter(q => {
      const matchesSearch = q.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          q.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          q.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [queries, searchTerm, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredQueries.length / itemsPerPage);
  const paginatedQueries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQueries.slice(start, start + itemsPerPage);
  }, [filteredQueries, currentPage]);

  const handleResolve = async (id: string) => {
    if (!firestore || !profile) return;
    try {
      await updateDoc(doc(firestore, 'support_queries', id), {
        status: 'RESOLVED',
        resolvedBy: profile.displayName || profile.uid,
        resolvedAt: Date.now()
      });
      toast({ title: "Inquiry Resolved" });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="h-[80vh] flex items-center justify-center p-6 text-center">
         <div className="space-y-4 ua-compact-page">
            <ShieldCheck className="w-16 h-16 text-primary mx-auto opacity-20" />
            <h2 className="text-xl font-black uppercase font-headline">Access Restricted</h2>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto pt-4 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <PageHeader title="Support Inbox" breadcrumb={["Admin", "Support Inbox"]} className="mb-0" />
          <p className="text-zinc-500 mt-2 uppercase text-[10px] font-bold tracking-widest">Customer inquiries registry</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-zinc-100 mx-2">
        <div className="relative flex-1 w-full">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
           <Input 
             placeholder="Search inquiries..." 
             value={searchTerm}
             onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
             className="pl-12 h-14 bg-zinc-50 border-none rounded-2xl font-bold" 
           />
        </div>
        <div className="flex gap-2 bg-zinc-50 p-1.5 rounded-2xl">
          {['ALL', 'NEW', 'RESOLVED'].map((s) => (
            <Button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              className={cn(
                "h-11 px-6 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                statusFilter === s ? "bg-white text-primary shadow-sm" : "bg-transparent text-zinc-400 hover:text-zinc-900"
              )}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100 mx-2">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-100 hover:bg-transparent">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black text-zinc-400">Customer Identity</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400">Subject</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black text-zinc-400 text-center">Status</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black text-zinc-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQueries.map((q) => (
                <TableRow key={q.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="pl-8 py-5">
                    <div>
                      <p className="text-xs font-black uppercase text-zinc-900 leading-none mb-1">{q.name}</p>
                      <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{q.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-black uppercase text-zinc-900 truncate max-w-md">{q.subject}</p>
                    <p className="text-[10px] text-zinc-400 uppercase leading-relaxed line-clamp-1 mt-0.5">{q.message}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-[8px] font-black uppercase px-3 h-5 border-none",
                      q.status === 'NEW' ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"
                    )}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                       {q.status !== 'RESOLVED' && (
                         <Button onClick={() => handleResolve(q.id)} variant="ghost" size="icon" className="h-9 w-9 text-zinc-300 hover:text-green-600"><CheckCircle2 className="w-4 h-4" /></Button>
                       )}
                       <Button onClick={async () => { if(confirm('Delete permanently?')) await deleteDoc(doc(firestore!, 'support_queries', q.id)); }} variant="ghost" size="icon" className="h-9 w-9 text-zinc-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
             <div className="flex items-center justify-between px-8 py-4 bg-white border-t border-zinc-50">
                <p className="text-[10px] font-black uppercase text-zinc-400">Page {currentPage} of {totalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-9 px-4 rounded-xl"><ChevronLeft className="w-4 h-4 mr-1" /> Prev</Button>
                  <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-9 px-4 rounded-xl">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </div>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
