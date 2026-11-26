"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface OrderBookProps {
  currentPrice: number;
  pairId: string;
}

interface Order {
  price: number;
  amount: number;
  total: number;
}

const generateOrders = (price: number, count: number, type: 'bids' | 'asks') => {
  const orders: Order[] = [];
  let cumulativeTotal = 0;
  for (let i = 0; i < count; i++) {
    const priceDiff = (Math.random() * price * 0.001) * (i + 1);
    const orderPrice = type === 'bids' ? price - priceDiff : price + priceDiff;
    const amount = Math.random() * 5;
    cumulativeTotal += amount * orderPrice;
    orders.push({
      price: orderPrice,
      amount,
      total: cumulativeTotal,
    });
  }
  return orders;
};

export function OrderBook({ currentPrice, pairId }: OrderBookProps) {
  const [orders, setOrders] = useState<{ bids: Order[], asks: Order[] }>({ bids: [], asks: [] });

  useEffect(() => {
    const updateOrders = () => {
      setOrders({
        bids: generateOrders(currentPrice, 15, 'bids'),
        asks: generateOrders(currentPrice, 15, 'asks').sort((a, b) => a.price - b.price),
      });
    };
    updateOrders();
    const interval = setInterval(updateOrders, 2500);
    return () => clearInterval(interval);
  }, [currentPrice, pairId]);

  return (
    <Card className="h-full flex flex-col border-0 rounded-none lg:rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="font-headline text-lg">Order Book</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 text-xs">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price (USD)</TableHead>
                <TableHead>Amount (BTC)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
          <div className="flex flex-col-reverse">
            {orders.bids.map((order, i) => (
                <div key={i} className="relative grid grid-cols-3 p-1 px-4 hover:bg-muted">
                    <span className="text-green-500">{order.price.toFixed(2)}</span>
                    <span>{order.amount.toFixed(4)}</span>
                    <span className="text-right">{order.total.toLocaleString(undefined, { maximumFractionDigits: 0})}</span>
                    <div className="absolute top-0 left-0 h-full bg-green-500/10" style={{ width: `${(order.amount / 5) * 100}%` }} />
                </div>
            ))}
          </div>
          <div className="p-2 my-1 text-center font-bold text-lg border-y">
            <span className={cn(currentPrice > (orders.bids[0]?.price || 0) ? 'text-green-500' : 'text-red-500')}>{currentPrice.toFixed(2)}</span>
          </div>
          <div>
            {orders.asks.map((order, i) => (
                <div key={i} className="relative grid grid-cols-3 p-1 px-4 hover:bg-muted">
                    <span className="text-red-500">{order.price.toFixed(2)}</span>
                    <span>{order.amount.toFixed(4)}</span>
                    <span className="text-right">{order.total.toLocaleString(undefined, { maximumFractionDigits: 0})}</span>
                    <div className="absolute top-0 left-0 h-full bg-red-500/10" style={{ width: `${(order.amount / 5) * 100}%` }} />
                </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
