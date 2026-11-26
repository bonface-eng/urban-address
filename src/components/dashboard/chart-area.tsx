"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MarketPoint, CurrencyPair, TimeFrame } from '@/lib/types';

interface ChartAreaProps {
  data: MarketPoint[];
  pair: CurrencyPair;
  timeFrame: TimeFrame;
  onTimeFrameChange: (tf: TimeFrame) => void;
}

const timeFrames: TimeFrame[] = ['1h', '4h', '1d'];

export function ChartArea({ data, pair, timeFrame, onTimeFrameChange }: ChartAreaProps) {
  const lastPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const isUp = data.length > 1 ? data[data.length - 1].close >= data[data.length - 2].close : true;

  const chartColor = isUp ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";
  const gradientId = `colorPrice-${isUp ? 'up' : 'down'}`;

  const formatXAxis = (tickItem: number) => {
    return new Date(tickItem).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const domain = [
    (dataMin: number) => dataMin * 0.995,
    (dataMax: number) => dataMax * 1.005,
  ];

  return (
    <Card className="h-full flex flex-col border-0 rounded-none lg:rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between p-4 space-y-0">
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {timeFrames.map((tf) => (
              <Button
                key={tf}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 px-2 text-xs',
                  timeFrame === tf && 'bg-muted text-foreground'
                )}
                onClick={() => onTimeFrameChange(tf)}
              >
                {tf.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Last Price</p>
          <p className={cn("font-semibold", isUp ? "text-green-500" : "text-red-500")}>
            {lastPrice.toFixed(pair.symbol.includes('JPY') ? 3 : 5)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 pl-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              interval="preserveStartEnd"
            />
            <YAxis
              orientation="right"
              domain={domain}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => value.toFixed(pair.symbol.includes('JPY') ? 2 : 4)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
              itemStyle={{ color: chartColor }}
              formatter={(value: number) => [value.toFixed(5), 'Price']}
              labelFormatter={(label) => new Date(label).toLocaleString()}
            />
            <Area type="monotone" dataKey="close" stroke={chartColor} strokeWidth={2} fillOpacity={1} fill={`url(#${gradientId})`} />
            {data.length > 0 && (
                <ReferenceLine y={data[data.length-1].close} stroke={chartColor} strokeDasharray="3 3" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
