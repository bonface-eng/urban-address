"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, X, FileText, Activity, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BotConfig, BotLog } from '@/lib/types';
import { Dialog, DialogContent } from '../ui/dialog';

interface TradingBotProps {
  isOpen: boolean;
  onClose: () => void;
  config: BotConfig;
  onConfigChange: (config: BotConfig) => void;
  logs: BotLog[];
}

export function TradingBot({ isOpen, onClose, config, onConfigChange, logs }: TradingBotProps) {
  
  const handleConfigChange = (key: keyof BotConfig, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const getLogIcon = (type: BotLog['type']) => {
    switch(type) {
      case 'INFO': return <FileText className="h-3 w-3 text-blue-400" />;
      case 'ACTION': return <Activity className="h-3 w-3 text-green-400" />;
      case 'ERROR': return <AlertCircle className="h-3 w-3 text-red-400" />;
      default: return null;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0" onInteractOutside={(e) => e.preventDefault()}>
        <Card className="border-0 shadow-none">
          <CardHeader className="p-6">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Bot className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle className="font-headline text-2xl">Trading Bot</CardTitle>
                        <CardDescription>Automate your trading strategy.</CardDescription>
                    </div>
                </div>
                 <Button variant="ghost" size="icon" onClick={onClose} className="-mt-2 -mr-2">
                    <X className="h-4 w-4" />
                </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="bot-active" className="text-base">Bot Status</Label>
                  <p className="text-sm text-muted-foreground">{config.isActive ? 'Active' : 'Inactive'}</p>
                </div>
                <Switch
                  id="bot-active"
                  checked={config.isActive}
                  onCheckedChange={(value) => handleConfigChange('isActive', value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="strategy">Strategy</Label>
                <Select
                  value={config.strategy}
                  onValueChange={(value) => handleConfigChange('strategy', value)}
                >
                  <SelectTrigger id="strategy">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TREND_FOLLOWING">Trend Following</SelectItem>
                    <SelectItem value="MEAN_REVERSION">Mean Reversion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trade-amount">Trade Amount (USD)</Label>
                <Input
                  id="trade-amount"
                  type="number"
                  value={config.tradeAmount}
                  onChange={(e) => handleConfigChange('tradeAmount', Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interval">Interval (ms)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={config.intervalMs}
                  onChange={(e) => handleConfigChange('intervalMs', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium mb-2">Bot Logs</h3>
              <ScrollArea className="h-40 w-full rounded-md border">
                <div className="p-4 font-code text-xs">
                  {logs.length > 0 ? (
                    [...logs].reverse().map(log => (
                      <div key={log.id} className="flex items-start gap-2 mb-1">
                        <span className="text-muted-foreground mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="mt-0.5">{getLogIcon(log.type)}</span>
                        <p className={cn({
                          "text-blue-400": log.type === 'INFO',
                          "text-green-400": log.type === 'ACTION',
                          "text-red-400": log.type === 'ERROR'
                        })}>
                          {log.message}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center p-4">No logs yet. Activate the bot to start seeing activity.</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
