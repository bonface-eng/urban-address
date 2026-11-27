'use client';

import React, { useMemo, useState } from 'react';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  Receipt,
  AlertTriangle,
  Clock,
  Filter,
  Download,
  Calculator,
  Banknote,
  TextQuote,
  RefreshCcw,
  ShieldCheck,
  CheckCircle2,
  Printer,
  FileText,
  Check,
  X,
  XCircle,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, addDoc, where, doc, updateDoc } from 'firebase/firestore';
import { PettyCashRequest, Order, Reconciliation } from '@/lib/types';
import { useProfile } from '@/hooks/use-profile';
import { toast } from '@/hooks/use-toast';
import { exportAsReceiptText } from '@/lib/csv-export';
import { ReceiptPreview } from '@/components/pos/receipt-preview';

export default function FinanceDashboard() {
  const firestore = useFirestore();
  const { profile, role, isSuperAdmin } = useProfile();
  const canManageExpenses = isSuperAdmin || role === 'ADMIN' || role === 'MANAGER' || role === 'SUPERVISOR';
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDenyDialogOpen, setIsDenyDialogOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [voucherData, setVoucherData] = useState<any>(null);
  const [requestToDeny, setRequestToDeny] = useState<PettyCashRequest | null>(null);
  const [denialReason, setDenialReason] = useState('');

  const requestsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'petty_cash'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return query(
      collection(firestore, 'orders'),
      where('timestamp', '>=', today.getTime()),
      where('paymentMethod', '==', 'CASH'),
      where('status', '==', 'PAID')
    );
  }, [firestore]);

  const reconciliationsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reconciliations'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore]);

  const { data: requests, loading } = useCollection<PettyCashRequest>(requestsQuery);
  const { data: todayCashOrders } = useCollection<Order>(ordersQuery);
  const { data: reconciliations } = useCollection<Reconciliation>(reconciliationsQuery);

  const expectedCash = useMemo(() => {
    return todayCashOrders?.reduce((sum, o) => sum + o.total, 0) || 0;
  }, [todayCashOrders]);

  const pendingCount = requests?.filter(r => r.status === 'PENDING').length || 0;
  const totalSpend = requests?.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.amount, 0) || 0;

  const handlePrintVoucher = (request: PettyCashRequest) => {
    const data = {
      type: 'PETTY_CASH',
      id: `EXP-${request.id?.slice(-6).toUpperCase()}`,
      reason: request.reason,
      total: request.amount,
      cashierName: request.requesterName,
      timestamp: request.timestamp,
      items: [{ name: request.reason, quantity: 1, price: request.amount }]
    };
    setVoucherData(data);
    setIsPreviewOpen(true);
  };

  const handleApproveRequest = async (request: PettyCashRequest) => {
    if (!firestore || !profile || !canManageExpenses) return;
    try {
      await updateDoc(doc(firestore, 'petty_cash', request.id!), {
        status: 'APPROVED',
        approvedBy: profile.displayName || profile.email,
        approvedAt: Date.now()
      });

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PETTY_CASH_APPROVED',
        userId: profile.uid,
        details: `Approved KES ${request.amount} for "${request.reason}" requested by ${request.requesterName}.`,
        timestamp: Date.now(),
        severity: 'INFO'
      });

      toast({ title: "Authorized", description: `KES ${request.amount.toLocaleString()} approved.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    }
  };

  const handleDenyRequest = async () => {
    if (!firestore || !profile || !requestToDeny) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'petty_cash', requestToDeny.id!), {
        status: 'DENIED',
        deniedBy: profile.displayName || profile.email,
        deniedAt: Date.now(),
        denialReason
      });

      await addDoc(collection(firestore, 'audit_logs'), {
        action: 'PETTY_CASH_DENIED',
        userId: profile.uid,
        details: `Denied KES ${requestToDeny.amount} for "${requestToDeny.reason}" requested by ${requestToDeny.requesterName}. Reason: ${denialReason}`,
        timestamp: Date.now(),
        severity: 'WARNING'
      });

      setIsDenyDialogOpen(false);
      setRequestToDeny(null);
      setDenialReason('');
      toast({ title: "Request Denied" });
    } catch (err) {
      toast({ variant: "destructive", title: "Action Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile || !amount || !reason) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'petty_cash'), {
        amount: Number(amount),
        reason,
        status: 'PENDING',
        requesterId: profile.uid,
        requesterName: profile.displayName,
        timestamp: Date.now()
      });
      setIsDialogOpen(false);
      setAmount('');
      setReason('');
      toast({ title: "Request Logged" });
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !profile || !actualCash) return;
    setIsReconciling(true);
    const variance = Number(actualCash) - expectedCash;
    try {
      await addDoc(collection(firestore, 'reconciliations'), {
        userId: profile.uid,
        timestamp: Date.now(),
        expectedCash,
        actualCash: Number(actualCash),
        variance,
        status: Math.abs(variance) < 1 ? 'STABLE' : 'DISCREPANCY',
      });
      setIsReconcileOpen(false);
      setActualCash('');
      toast({ title: "Audit Sync Complete", description: `Variance: KES ${variance}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2 pt-4">
        <div>
          <h1 className="text-3xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Financial Treasury</h1>
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">Expense management and shift reconciliation</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsReconcileOpen(true)} variant="outline" className="h-11 px-6 text-[10px] font-black uppercase tracking-widest border-zinc-200 bg-white shadow-sm hover:bg-zinc-50">
            <Calculator className="w-4 h-4 mr-2 text-primary" /> Shift Audit
          </Button>
          <Button onClick={() => exportAsReceiptText(requests || [], 'PettyCash_Ledger', { reason: 'Memo', amount: 'KES', status: 'Status', requesterName: 'Operator', timestamp: 'Date' })} variant="outline" className="h-11 px-6 text-[10px] font-black uppercase tracking-widest border-zinc-200 bg-white">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-xl">
                <Plus className="w-4 h-4 mr-2 text-primary" /> New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
              <div className="bg-primary/5 p-10 border-b border-primary/10 text-center">
                 <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary mb-6 mx-auto">
                    <Banknote className="w-7 h-7" />
                 </div>
                 <DialogHeader>
                    <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">Petty Cash Request</DialogTitle>
                    <DialogDescription className="text-xs uppercase font-bold text-zinc-400">Log operational expenditure for approval.</DialogDescription>
                 </DialogHeader>
              </div>
              <form onSubmit={handleRequest} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Amount (KES)</Label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="h-14 bg-zinc-50 border-none rounded-2xl font-black px-6" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Reason / Memo</Label>
                  <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Office Supplies" className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" required />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl">
                  {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : 'Submit Request'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
        <FinanceStatCard title="Approved Spend" value={`KES ${totalSpend.toLocaleString()}`} icon={ArrowUpRight} color="text-primary" />
        <FinanceStatCard title="Pending Review" value={pendingCount.toString()} icon={Clock} color="text-amber-500" />
        <FinanceStatCard title="Expected Cash" value={`KES ${expectedCash.toLocaleString()}`} icon={Banknote} color="text-green-600" />
      </div>

      <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100 mx-2">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-8">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Expenditure Ledger</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-50 hover:bg-transparent">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Memo / Operator</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Volume</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-center">Status</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Control</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests?.map((request) => (
                <TableRow key={request.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                  <TableCell className="pl-8 py-5">
                    <div>
                      <span className="text-xs font-black text-zinc-900 uppercase block mb-1">{request.reason}</span>
                      <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">By {request.requesterName} • {new Date(request.timestamp).toLocaleDateString()}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-zinc-900">KES {request.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "text-[8px] font-black uppercase px-3 h-5 border-none", 
                      request.status === 'APPROVED' ? "bg-green-50 text-green-600" : 
                      request.status === 'DENIED' ? "bg-red-50 text-red-600" : 
                      "bg-amber-50 text-amber-600"
                    )}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                      {request.status === 'PENDING' && canManageExpenses && (
                        <>
                          <Button onClick={() => handleApproveRequest(request)} className="h-8 px-3 bg-green-500 hover:bg-green-600 text-white font-black text-[9px] uppercase rounded-xl gap-1 shadow-sm"><Check className="w-3 h-3" /> Approve</Button>
                          <Button onClick={() => { setRequestToDeny(request); setIsDenyDialogOpen(true); }} variant="outline" className="h-8 px-3 border-red-200 text-red-600 hover:bg-red-50 font-black text-[9px] uppercase rounded-xl gap-1 shadow-sm"><X className="w-3 h-3" /> Deny</Button>
                        </>
                      )}
                      <Button onClick={() => handlePrintVoucher(request)} variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-primary rounded-xl"><Printer className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white border border-zinc-100 mx-2">
        <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-50 p-8">
          <div>
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Shift Reconciliation History</CardTitle>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Audit log of blind drop cash counts versus system expectations</p>
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-200 bg-zinc-50">{reconciliations?.length || 0} AUDITS</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-50 hover:bg-transparent">
                <TableHead className="pl-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400">Timestamp</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Expected</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Counted Cash</TableHead>
                <TableHead className="h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Variance</TableHead>
                <TableHead className="pr-8 h-16 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliations?.map((rec) => (
                <TableRow key={rec.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="pl-8 py-5">
                    <span className="text-xs font-black text-zinc-900 uppercase block">{new Date(rec.timestamp).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-zinc-600">KES {(rec.expectedCash || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-black text-zinc-900">KES {(rec.actualCash || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn("font-black text-xs", (rec.variance || 0) < 0 ? "text-red-500" : (rec.variance || 0) > 0 ? "text-amber-600" : "text-green-600")}>
                      {(rec.variance || 0) >= 0 ? '+' : ''}KES {(rec.variance || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-center pr-8">
                    <Badge className={cn(
                      "text-[8px] font-black uppercase px-3 h-5 border-none",
                      rec.status === 'STABLE' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {rec.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!reconciliations || reconciliations.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">No shift reconciliations recorded yet</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Denial Reason Dialog */}
      <Dialog open={isDenyDialogOpen} onOpenChange={setIsDenyDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
          <div className="bg-red-50 p-10 border-b border-red-100 text-center">
             <DialogHeader>
                <DialogTitle className="font-headline uppercase tracking-widest text-lg text-red-900">Reject Request</DialogTitle>
                <DialogDescription className="text-xs uppercase font-bold text-red-700/60 mt-2">State the reason for rejecting this KES {requestToDeny?.amount} expense.</DialogDescription>
             </DialogHeader>
          </div>
          <div className="p-8 space-y-6">
             <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Reason for Denial</Label>
                <Input value={denialReason} onChange={e => setDenialReason(e.target.value)} placeholder="e.g. Budget Cap Reached" className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-bold" />
             </div>
             <Button onClick={handleDenyRequest} disabled={!denialReason || isSubmitting} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl active:scale-95">
                {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Confirm Denial'}
             </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReconcileOpen} onOpenChange={setIsReconcileOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
           <div className="bg-primary/5 p-10 border-b border-primary/10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center text-primary mx-auto mb-6">
                 <ShieldCheck className="w-8 h-8" />
              </div>
              <DialogTitle className="font-headline uppercase tracking-widest text-lg text-zinc-900">Blind Drop Audit</DialogTitle>
              <DialogDescription className="text-xs uppercase font-bold text-zinc-400">Count physical cash before system reveal.</DialogDescription>
           </div>
           <form onSubmit={handleReconcile} className="p-8 space-y-8">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1 text-center block w-full">Cash in Drawer (KES)</Label>
                 <Input type="number" value={actualCash} onChange={e => setActualCash(e.target.value)} placeholder="0.00" className="h-20 bg-zinc-50 border-none rounded-[1.5rem] text-4xl font-black text-center" required />
              </div>
              <Button type="submit" disabled={isReconciling} className="w-full h-16 bg-zinc-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl active:scale-95 transition-all">
                 {isReconciling ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : 'Complete Shift Audit'}
              </Button>
           </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
          <ReceiptPreview data={voucherData} onClose={() => setIsPreviewOpen(false)} className="w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanceStatCard({ title, value, icon: Icon, color = "text-zinc-900" }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white border border-zinc-100 p-8 group hover:bg-zinc-50 transition-colors">
      <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center mb-6 shadow-inner">
        <Icon className={cn("w-6 h-6", color)} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">{title}</p>
      <h3 className={cn("text-3xl font-black font-headline tracking-tighter", color)}>{value}</h3>
    </Card>
  );
}
