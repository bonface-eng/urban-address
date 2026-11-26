"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CurrencyPair } from '@/lib/types';

interface TradePanelProps {
  pair: CurrencyPair;
  currentPrice: number;
  balance: number;
  onTrade: (type: 'BUY' | 'SELL', quantity: number) => void;
}

export function TradePanel({ pair, currentPrice, balance, onTrade }: TradePanelProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('1000');
  const [quantity, setQuantity] = useState('');

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTradeAmount(value);
    if (currentPrice > 0) {
      setQuantity((Number(value) / currentPrice).toFixed(6));
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuantity(value);
    setTradeAmount((Number(value) * currentPrice).toFixed(2));
  };
  
  const handleTrade = () => {
    const tradeQuantity = parseFloat(quantity);
    if (isNaN(tradeQuantity) || tradeQuantity <= 0) {
      return;
    }
    onTrade(activeTab.toUpperCase() as 'BUY' | 'SELL', tradeQuantity);
  }

  const baseAsset = pair.baseAsset;
  const quoteAsset = pair.quoteAsset;

  return (
    <Card className="h-full flex flex-col border-0 rounded-none lg:rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="font-headline text-lg">Trade</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'buy' | 'sell')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">Buy</TabsTrigger>
            <TabsTrigger value="sell">Sell</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-4 mt-4 flex-1">
          <div>
            <Label htmlFor="trade-amount" className="text-xs">Amount ({quoteAsset})</Label>
            <Input id="trade-amount" type="number" value={tradeAmount} onChange={handleAmountChange} className="mt-1"/>
          </div>
          <div>
            <Label htmlFor="quantity" className="text-xs">Quantity ({baseAsset})</Label>
            <Input id="quantity" type="number" value={quantity} onChange={handleQuantityChange} className="mt-1"/>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Available Balance:</span>
              <span>{balance.toFixed(2)} {quoteAsset}</span>
            </div>
            <div className="flex justify-between">
              <span>Est. Margin:</span>
              <span>{(Number(tradeAmount) * 0.01).toFixed(2)} {quoteAsset}</span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleTrade}
          className={cn(
            'w-full font-bold mt-4',
            activeTab === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
            'text-white'
          )}
        >
          {activeTab === 'buy' ? `Buy ${baseAsset}` : `Sell ${baseAsset}`}
        </Button>
      </CardContent>
    </Card>
  );
}
