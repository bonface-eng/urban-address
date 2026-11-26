"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Trade {
  id: string;
  price: number;
  amount: number;
  time: string;
  type: 'buy' | 'sell';
}

const generateTrade = (lastPrice: number): Trade => {
  const type = Math.random() > 0.5 ? 'buy' : 'sell';
  const price = lastPrice * (1 + (Math.random() - 0.5) * 0.0005);
  return {
    id: crypto.randomUUID(),
    price,
    amount: Math.random() * 0.5,
    time: new Date().toLocaleTimeString(),
    type,
  };
};

export function MarketTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [lastPrice, setLastPrice] = useState(68000);

  useEffect(() => {
    const interval = setInterval(() => {
      const newTrade = generateTrade(lastPrice);
      setLastPrice(newTrade.price);
      setTrades(prev => [newTrade, ...prev.slice(0, 49)]);
    }, 1500);
    return () => clearInterval(interval);
  }, [lastPrice]);

  return (
    <Card className="h-full flex flex-col border-0 rounded-none lg:rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="font-headline text-lg">Market Trades</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 text-xs">
        <ScrollArea className="h-full">
            <div className="grid grid-cols-3 px-4 py-2 font-semibold text-muted-foreground">
                <span>Price (USD)</span>
                <span>Amount (BTC)</span>
                <span className="text-right">Time</span>
            </div>
          <div className="px-4">
            {trades.map((trade) => (
                <div key={trade.id} className="grid grid-cols-3 py-0.5">
                    <span className={cn(trade.type === 'buy' ? 'text-green-500' : 'text-red-500')}>
                        {trade.price.toFixed(2)}
                    </span>
                    <span>{trade.amount.toFixed(4)}</span>
                    <span className="text-right text-muted-foreground">{trade.time}</span>
                </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
