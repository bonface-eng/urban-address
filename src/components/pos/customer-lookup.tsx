
'use client';

import React, { useState, useMemo } from 'react';
import { Search, User, X, Check, Award, Phone, Mail, UserPlus, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDb, useCollection } from '@/lib/data';
import { collection, query, where, limit } from '@/lib/db';
import { UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCardReader } from '@/hooks/use-card-reader';

interface CustomerLookupProps {
  onSelect: (customer: UserProfile | null) => void;
  selectedCustomer: UserProfile | null;
  className?: string;
}

export function CustomerLookup({ onSelect, selectedCustomer, className }: CustomerLookupProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useDb();

  const customersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'CLIENT'), limit(20));
  }, [firestore]);

  const { data: customers } = useCollection<UserProfile>(customersQuery);

  const results = useMemo(() => {
    if (!searchTerm || !customers) return [];
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
      c.displayName?.toLowerCase().includes(term) || 
      c.phoneNumber?.includes(term) ||
      c.email?.toLowerCase().includes(term)
    );
  }, [searchTerm, customers]);

  // Support for Loyalty Card Swiping
  useCardReader((data) => {
    if (data.type === 'LOYALTY' && customers) {
      const match = customers.find(c => c.uid === data.id || c.email === data.id);
      if (match) {
        onSelect(match);
        setIsOpen(false);
        setSearchTerm('');
        toast({ title: "Member Identified", description: `${match.displayName} connected via card swipe.` });
      } else {
        toast({ variant: "destructive", title: "Unrecognized Card", description: "This loyalty card is not yet registered." });
      }
    }
  });

  return (
    <div className={cn("relative", className)}>
      {selectedCustomer ? (
        <div className="flex items-center justify-between p-2 md:p-3 bg-primary/5 border border-primary/20 rounded-lg md:rounded-xl animate-in zoom-in-95 duration-300">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm border border-primary/10">
                 <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                 <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black uppercase text-zinc-900 truncate">{selectedCustomer.displayName}</p>
                    <Badge className="bg-primary text-white border-none text-[7px] font-black h-4 px-1.5">{selectedCustomer.loyaltyPoints || 0} PTS</Badge>
                 </div>
                 <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{selectedCustomer.phoneNumber || 'No Contact'}</p>
              </div>
           </div>
           <Button variant="ghost" size="icon" onClick={() => onSelect(null)} className="h-8 w-8 text-zinc-300 hover:text-red-500 rounded-lg">
              <X className="w-4 h-4" />
           </Button>
        </div>
      ) : (
        <div className="relative group">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search by member name or phone, or swipe card" 
            value={searchTerm}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 md:h-12 bg-white border-zinc-100 rounded-lg md:rounded-xl font-medium text-[11px] md:text-[10px] tracking-normal focus:ring-2 focus:ring-primary/5 placeholder:text-zinc-400 shadow-sm"
          />
          {isOpen && results.length > 0 && (
            <div className="absolute z-[100] left-0 right-0 top-[calc(100%+8px)] bg-white border border-zinc-100 rounded-2xl shadow-2xl overflow-hidden py-1 max-h-[300px] overflow-y-auto no-scrollbar animate-in slide-in-from-top-2">
               {results.map(c => (
                 <button
                   key={c.uid}
                   onClick={() => {
                     onSelect(c);
                     setIsOpen(false);
                     setSearchTerm('');
                   }}
                   className="w-full px-3 md:px-5 py-3 md:py-4 text-left hover:bg-zinc-50 border-b border-zinc-50 last:border-0 flex items-center justify-between group"
                 >
                    <div className="flex items-center gap-4">
                       <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-primary transition-colors border border-zinc-100">
                          <Phone className="w-4 h-4" />
                       </div>
                       <div>
                          <p className="text-xs font-black uppercase text-zinc-900">{c.displayName}</p>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{c.phoneNumber || c.email}</p>
                       </div>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black text-primary border-primary/20 bg-primary/5">{c.loyaltyPoints || 0} PTS</Badge>
                 </button>
               ))}
            </div>
          )}
          {isOpen && searchTerm && results.length === 0 && (
            <div className="absolute z-[100] left-0 right-0 top-[calc(100%+8px)] bg-white border border-zinc-100 rounded-2xl shadow-2xl p-6 text-center space-y-3">
               <UserPlus className="w-8 h-8 text-zinc-200 mx-auto" />
               <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">No member matches found</p>
               <Button variant="outline" size="sm" className="h-8 rounded-lg text-[8px] font-black uppercase tracking-widest">Register New</Button>
            </div>
          )}
        </div>
      )}
      {isOpen && !searchTerm && (
        <div className="fixed inset-0 z-[90]" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
