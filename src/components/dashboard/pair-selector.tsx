"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { CurrencyPair, MarketPoint } from "@/lib/types"
import { CURRENCY_PAIRS } from "@/lib/constants"
import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"

interface PairSelectorProps {
  isOpen: boolean
  onClose: () => void
  pairs: CurrencyPair[]
  currentPair: CurrencyPair
  onSelect: (pair: CurrencyPair) => void
  marketData: Record<string, MarketPoint[]>
}

export function PairSelector({ isOpen, onClose, pairs, currentPair, onSelect, marketData }: PairSelectorProps) {
  const [search, setSearch] = useState("")

  const filteredPairs = useMemo(() => {
    return pairs.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.symbol.toLowerCase().includes(search.toLowerCase()))
  }, [search, pairs])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="font-headline">Select Market</DialogTitle>
        </DialogHeader>
        <div className="p-4">
            <Input 
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
            {filteredPairs.map(pair => {
                const history = marketData[pair.id];
                const lastPoint = history && history.length > 0 ? history[history.length - 1] : null;
                const price = lastPoint?.close ?? pair.basePrice;
                const prevPrice = history && history.length > 1 ? history[history.length - 2].close : price;
                const priceChange = price - prevPrice;
                
                return (
                    <div
                        key={pair.id}
                        className={cn(
                            "flex items-center justify-between p-4 cursor-pointer hover:bg-muted",
                            currentPair.id === pair.id && "bg-muted"
                        )}
                        onClick={() => onSelect(pair)}
                    >
                        <div className="flex items-center gap-3">
                            <pair.icon className="h-6 w-6"/>
                            <div>
                                <p className="font-semibold">{pair.symbol}</p>
                                <p className="text-xs text-muted-foreground">{pair.name}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className={cn("font-semibold", priceChange >= 0 ? 'text-green-500' : 'text-red-500')}>
                                {price.toFixed(price > 100 ? 2: 4)}
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
