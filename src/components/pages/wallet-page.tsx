"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { Transaction, UserProfile } from '@/lib/types';

interface WalletPageProps {
  balance: number;
  transactions: Transaction[];
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
  userProfile: UserProfile;
}

export default function WalletPage({ balance, transactions, onDeposit, onWithdraw }: WalletPageProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-headline mb-8">Wallet</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Total Balance</CardTitle>
              <CardDescription>The total value of funds in your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Deposit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="deposit-amount">Amount</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={() => onDeposit(parseFloat(depositAmount) || 0)}>Deposit Funds</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Withdraw</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="withdraw-amount">Amount</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <Button className="w-full" variant="secondary" onClick={() => onWithdraw(parseFloat(withdrawAmount) || 0)}>Withdraw Funds</Button>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tx.type === 'DEPOSIT' ? 
                              <ArrowDownLeft className="h-4 w-4 text-green-500"/> : 
                              <ArrowUpRight className="h-4 w-4 text-red-500"/>}
                            <span>{tx.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>${tx.amount.toFixed(2)}</TableCell>
                        <TableCell><Badge variant="outline">{tx.status}</Badge></TableCell>
                        <TableCell className="text-right">{new Date(tx.timestamp).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                     {transactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">No transactions yet.</TableCell>
                      </TableRow>
                     )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
