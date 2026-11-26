"use client";

import { useMemo } from 'react';
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
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Position } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface PositionsTableProps {
  positions: Position[];
  currentPrices: Record<string, number>;
  onClosePosition: (id: string) => void;
}

export function PositionsTable({ positions, currentPrices, onClosePosition }: PositionsTableProps) {
  
  const positionsWithPnl = useMemo(() => {
    return positions.map(pos => {
      const currentPrice = currentPrices[pos.symbol] || pos.entryPrice;
      const pnl = (currentPrice - pos.entryPrice) * pos.quantity * (pos.type === 'BUY' ? 1 : -1);
      return { ...pos, pnl, currentPrice };
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [positions, currentPrices]);

  return (
    <Card className="h-full flex flex-col border-0 rounded-none lg:rounded-lg">
      <CardHeader className="p-4">
        <CardTitle className="font-headline text-lg">Open Positions ({positions.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>P/L</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positionsWithPnl.length > 0 ? (
                positionsWithPnl.map((pos) => (
                  <TableRow key={pos.id}>
                    <TableCell className="font-medium">{pos.symbol}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(pos.type === 'BUY' ? 'text-green-500 border-green-500' : 'text-red-500 border-red-500')}>
                        {pos.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{pos.quantity.toFixed(4)}</TableCell>
                    <TableCell>{pos.entryPrice.toFixed(4)}</TableCell>
                    <TableCell>{pos.currentPrice.toFixed(4)}</TableCell>
                    <TableCell className={cn(pos.pnl >= 0 ? 'text-green-500' : 'text-red-500')}>
                      {pos.pnl.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onClosePosition(pos.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No open positions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
