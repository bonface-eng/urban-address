'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { PieChart as PieChartIcon, Layers, Sparkles } from 'lucide-react';

export interface ComparisonItem {
  name: string;
  value: number;
  count?: number;
  color: string;
}

export interface ComparisonData {
  byType: ComparisonItem[];       // Services vs Products
  byDepartment: ComparisonItem[]; // Lounge vs Store vs Carwash
  topItems?: ComparisonItem[];    // Top individual services/products sold
}

interface AIBriefingProps {
  sales: number;
  lowStock: number;
  orderCount: number;
  userName?: string;
  className?: string;
  comparisonData?: ComparisonData;
}

export function AIBriefing({ 
  sales, 
  lowStock, 
  orderCount, 
  userName, 
  className,
  comparisonData 
}: AIBriefingProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const name = userName?.split(' ')[0] || 'Operator';

  const [viewMode, setViewMode] = useState<'TYPE' | 'UNIT' | 'ITEMS'>('TYPE');

  const insight = useMemo(() => {
    if (lowStock > 5) return { text: `${lowStock} products require restocking soon.`, color: 'text-primary' };
    if (sales > 100000) return { text: "Sales velocity is high today. Performance is strong.", color: 'text-green-500' };
    return { text: "System is running normally. All departments are active.", color: 'text-zinc-400' };
  }, [sales, lowStock]);

  // Resolve current active data for the pie chart
  const activeData = useMemo(() => {
    if (!comparisonData) return [];
    if (viewMode === 'UNIT') {
      return comparisonData.byDepartment.filter(d => d.value > 0);
    }
    if (viewMode === 'ITEMS') {
      return (comparisonData.topItems || []).filter(d => d.value > 0);
    }
    // Default: 'TYPE' (Services vs Products)
    return comparisonData.byType.filter(d => d.value > 0);
  }, [comparisonData, viewMode]);

  // Fallback data if everything is 0 or empty
  const displayData = useMemo(() => {
    if (activeData.length > 0) return activeData;
    if (comparisonData) {
      if (viewMode === 'UNIT') return comparisonData.byDepartment;
      if (viewMode === 'ITEMS') return comparisonData.topItems || [];
      return comparisonData.byType;
    }
    return [];
  }, [activeData, comparisonData, viewMode]);

  const totalChartVolume = useMemo(() => {
    return displayData.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [displayData]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ComparisonItem;
      const percent = totalChartVolume > 0 ? ((data.value / totalChartVolume) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white p-2.5 rounded-xl border border-zinc-200 shadow-xl text-[9px]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
            <span className="font-black uppercase text-zinc-900">{data.name}</span>
          </div>
          <div className="font-bold text-zinc-700">
            KES {data.value.toLocaleString()} ({percent}%)
          </div>
          {data.count !== undefined && data.count > 0 && (
            <div className="text-[8px] text-zinc-400 uppercase mt-0.5 font-bold">
              {data.count} unit{data.count === 1 ? '' : 's'} sold
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={cn("border-none shadow-mobile rounded-[2.5rem] bg-white overflow-hidden border border-zinc-100 group transition-all hover:border-primary/20", className)}>
       <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
             <div>
                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Daily Update</p>
                <h3 className="text-xl font-black uppercase text-zinc-900 tracking-tighter leading-none mt-0.5">{greeting}, {name}.</h3>
             </div>
             <Badge className="bg-primary/5 text-primary border-none text-[8px] font-black uppercase px-3 h-5">System Online</Badge>
          </div>

          {/* AI Insights Card */}
          <div className="p-6 bg-zinc-50 rounded-[2rem] border border-zinc-100 relative overflow-hidden">
             <div className="space-y-1 relative z-10">
                <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">AI Insights</p>
                <p className={cn("text-[11px] font-bold uppercase leading-relaxed tracking-tight", insight.color)}>
                  {insight.text}
                </p>
             </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
             <BriefingMetric label="Total Sales" value={`KES ${sales.toLocaleString()}`} />
             <BriefingMetric label="Orders" value={orderCount.toString()} />
             <BriefingMetric label="Low Stock" value={lowStock.toString()} danger={lowStock > 0} />
          </div>

          {/* Pie Chart: Services vs Products Sold Comparison */}
          <div className="pt-5 border-t border-zinc-100 space-y-3.5">
             <div className="flex items-center justify-between">
                <div>
                   <p className="text-[9px] font-black uppercase text-zinc-900 tracking-widest flex items-center gap-1.5">
                      <PieChartIcon className="w-3 h-3 text-primary" />
                      Sales Comparison
                   </p>
                   <p className="text-[8px] font-bold uppercase tracking-wider text-zinc-400 mt-0.5">
                      Services vs Products Share
                   </p>
                </div>

                {/* View Switcher Pills */}
                <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg text-[8px] font-black uppercase">
                   <button
                      onClick={() => setViewMode('TYPE')}
                      className={cn(
                        "px-2 py-1 rounded-md transition-all",
                        viewMode === 'TYPE' ? "bg-white text-zinc-900 shadow-xs font-black" : "text-zinc-500 hover:text-zinc-900"
                      )}
                      title="Services vs Products"
                   >
                      Type
                   </button>
                   <button
                      onClick={() => setViewMode('UNIT')}
                      className={cn(
                        "px-2 py-1 rounded-md transition-all",
                        viewMode === 'UNIT' ? "bg-white text-zinc-900 shadow-xs font-black" : "text-zinc-500 hover:text-zinc-900"
                      )}
                      title="By Department / Station"
                   >
                      Unit
                   </button>
                   {comparisonData?.topItems && comparisonData.topItems.length > 0 && (
                     <button
                        onClick={() => setViewMode('ITEMS')}
                        className={cn(
                          "px-2 py-1 rounded-md transition-all",
                          viewMode === 'ITEMS' ? "bg-white text-zinc-900 shadow-xs font-black" : "text-zinc-500 hover:text-zinc-900"
                        )}
                        title="Top Sold Items"
                     >
                        Items
                     </button>
                   )}
                </div>
             </div>

             {/* Chart Display */}
             {totalChartVolume === 0 ? (
                <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200">
                   <div className="w-9 h-9 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center mb-2">
                      <PieChartIcon className="w-4 h-4 text-zinc-400" />
                   </div>
                   <p className="text-[9px] font-black uppercase tracking-wider text-zinc-700">No Sales in Period</p>
                   <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                      Services and products comparison will populate once sales occur.
                   </p>
                </div>
             ) : (
                <div className="space-y-3">
                   {/* Donut Chart with center total */}
                   <div className="h-[170px] w-full relative">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                               data={activeData.length > 0 ? activeData : [{ name: 'None', value: 1, color: '#e4e4e7' }]}
                               cx="50%"
                               cy="50%"
                               innerRadius={46}
                               outerRadius={68}
                               paddingAngle={activeData.length > 1 ? 4 : 0}
                               dataKey="value"
                            >
                               {(activeData.length > 0 ? activeData : [{ name: 'None', value: 1, color: '#e4e4e7' }]).map((entry, index) => (
                                  <Cell 
                                     key={`pie-cell-${index}`} 
                                     fill={entry.color} 
                                     stroke="#ffffff"
                                     strokeWidth={2}
                                  />
                               ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                         </PieChart>
                      </ResponsiveContainer>

                      {/* Donut Hole Center Summary */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                         <span className="text-[7px] font-black uppercase tracking-widest text-zinc-400">Total</span>
                         <span className="text-xs font-black text-zinc-900 tracking-tight">
                            KES {totalChartVolume.toLocaleString()}
                         </span>
                      </div>
                   </div>

                   {/* Data Legend Breakdown List */}
                   <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar pr-0.5">
                      {displayData.map((item, idx) => {
                         const percent = totalChartVolume > 0 ? Math.round((item.value / totalChartVolume) * 100) : 0;
                         return (
                            <div 
                               key={idx} 
                               className="flex items-center justify-between text-[9px] py-1.5 px-2.5 rounded-xl bg-zinc-50/80 hover:bg-zinc-100/80 transition-colors border border-zinc-100/60"
                            >
                               <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  <span className="font-black text-zinc-800 uppercase truncate text-[8px]">
                                     {item.name}
                                  </span>
                                  {item.count !== undefined && item.count > 0 && (
                                     <span className="text-[7px] font-bold text-zinc-400 uppercase shrink-0">
                                        • {item.count} sold
                                     </span>
                                  )}
                               </div>
                               <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-black text-zinc-900 text-[8px]">
                                     KES {item.value.toLocaleString()}
                                  </span>
                                  <Badge 
                                     variant="outline" 
                                     className="text-[7px] font-black uppercase px-1.5 py-0 h-4 border-zinc-200 text-zinc-600 bg-white"
                                  >
                                     {percent}%
                                  </Badge>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>
             )}
          </div>
       </CardContent>
    </Card>
  );
}

function BriefingMetric({ label, value, danger }: any) {
  return (
    <div className="space-y-0.5 border-l-2 border-zinc-50 pl-3">
       <p className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">{label}</p>
       <p className={cn("text-xs font-black uppercase", danger ? "text-primary" : "text-zinc-900")}>{value}</p>
    </div>
  );
}
