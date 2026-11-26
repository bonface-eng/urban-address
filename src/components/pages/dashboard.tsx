"use client"

import React from 'react'
import { TradePanel } from '@/components/dashboard/trade-panel'
import { ChartArea } from '@/components/dashboard/chart-area'
import { PositionsTable } from '@/components/dashboard/positions-table'
import { OrderBook } from '@/components/dashboard/order-book'
import { MarketTrades } from '@/components/dashboard/market-trades'
import type { CurrencyPair, MarketPoint, Position, TimeFrame } from '@/lib/types'

interface DashboardProps {
  pair: CurrencyPair;
  currentPrice: number;
  balance: number;
  onTrade: (type: 'BUY' | 'SELL', quantity: number) => void;
  activeHistory: MarketPoint[];
  timeFrame: TimeFrame;
  onTimeFrameChange: (tf: TimeFrame) => void;
  positions: Position[];
  currentPrices: Record<string, number>;
  onClosePosition: (id: string) => void;
}

export default function Dashboard({
  pair,
  currentPrice,
  balance,
  onTrade,
  activeHistory,
  timeFrame,
  onTimeFrameChange,
  positions,
  currentPrices,
  onClosePosition
}: DashboardProps) {
  return (
    <div className="flex-1 p-1 lg:p-2 overflow-hidden h-full">
      <div className="h-full grid grid-cols-12 grid-rows-6 lg:grid-rows-1 gap-2">
        <div className="col-span-12 lg:col-span-3 xl:col-span-2 row-span-2 lg:row-span-1 h-full min-h-[300px] lg:min-h-0">
          <TradePanel pair={pair} currentPrice={currentPrice} balance={balance} onTrade={onTrade} />
        </div>
        <div className="col-span-12 lg:col-span-6 xl:col-span-7 row-span-4 lg:row-span-1 h-full flex flex-col gap-2 min-h-[600px] lg:min-h-0">
          <div className="flex-[3] min-h-[300px]">
            <ChartArea data={activeHistory} pair={pair} timeFrame={timeFrame} onTimeFrameChange={onTimeFrameChange} />
          </div>
          <div className="flex-[2] min-h-[200px]">
            <PositionsTable positions={positions} currentPrices={currentPrices} onClosePosition={onClosePosition} />
          </div>
        </div>
        <div className="hidden lg:flex col-span-3 xl:col-span-3 h-full flex-col gap-2">
          <div className="flex-1">
            <OrderBook currentPrice={currentPrice} pairId={pair.id} />
          </div>
          <div className="flex-1">
            <MarketTrades />
          </div>
        </div>
      </div>
    </div>
  )
}
