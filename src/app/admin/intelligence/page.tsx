'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Send,
  RefreshCcw,
  ChevronRight,
  FileDown,
  History,
  Trash2,
  Download,
  AlertCircle,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProfile } from '@/hooks/use-profile';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, limit, where, addDoc, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Order, Product } from '@/lib/types';
import { jarvisConsult, BIOutput } from '@/ai/flows/business-intelligence-flow';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { checkAiStatus } from '@/lib/actions';

const QUICK_PROMPTS = [
  { label: 'Sales Audit', query: "Audit today's sales and identify the top performing department." },
  { label: 'Stock Prediction', query: "Predict which products will run out in the next 48 hours based on sales velocity." },
  { label: 'Fraud Detection', query: "Scan the audit logs for suspicious void patterns or excessive refunds." },
  { label: 'Profit Summary', query: "Generate a summary of gross profit margins for the last 7 days." }
];

export default function UrbanAI() {
  const { isSuperAdmin, profile } = useProfile();
  const { user } = useUser();
  const firestore = useFirestore();
  const [queryText, setQueryText] = useState('');
  const [isConsulting, setIsProcessing] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ hasKey: boolean; status: string; message: string }>({ hasKey: false, status: 'CHECKING', message: 'Verifying link...' });
  
  const startOfToday = new Date().setHours(0,0,0,0);

  useEffect(() => {
    checkAiStatus().then(res => {
      setAiStatus(res);
    });
  }, []);

  // Context Queries
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'orders'), where('status', '==', 'PAID'), where('timestamp', '>=', startOfToday));
  }, [firestore, startOfToday]);

  const inventoryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'inventory');
  }, [firestore]);

  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'ai_chats'), orderBy('timestamp', 'desc'), limit(50));
  }, [firestore, user?.uid]);

  const { data: todayOrders } = useCollection<Order>(ordersQuery);
  const { data: inventory } = useCollection<Product>(inventoryQuery);
  const { data: chatHistory } = useCollection<any>(historyQuery);

  const contextData = useMemo(() => {
    const dailySales = todayOrders?.reduce((sum, o) => sum + o.total, 0) || 0;
    const inventoryAlerts = inventory?.filter(i => i.unit !== 'CARWASH' && (i.stockLevel || 0) <= (i.minStock || 0)).length || 0;
    
    return { dailySales, inventoryAlerts };
  }, [todayOrders, inventory]);

  const handleConsult = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = customQuery || queryText;
    if (!finalQuery.trim() || isConsulting || !user || !firestore) return;

    if (!aiStatus.hasKey) {
      toast({ 
        variant: "destructive", 
        title: "AI Node Offline", 
        description: "The Gemini API Key is missing. Please check your server environment variables." 
      });
      return;
    }

    setQueryText('');
    setIsProcessing(true);

    try {
      // 1. Add User Message to Persistence
      const chatRef = collection(firestore, 'users', user.uid, 'ai_chats');
      await addDoc(chatRef, {
        role: 'user',
        content: finalQuery,
        timestamp: Date.now()
      });

      // 2. Call AI Flow
      const result = await jarvisConsult({
        query: finalQuery,
        context: {
          dailySales: contextData.dailySales,
          inventoryAlerts: contextData.inventoryAlerts,
          pendingBills: 0
        }
      });

      // 3. Add AI Response to Persistence
      await addDoc(chatRef, {
        role: 'ai',
        content: result,
        timestamp: Date.now() + 1
      });

    } catch (err: any) {
      console.error('[URBAN_AI_FAILURE]', err);
      const errMsg = err.message || "";
      
      if (errMsg.includes("API key not valid")) {
        toast({ 
          variant: "destructive", 
          title: "Invalid API Key", 
          description: "The provided Gemini API Key is invalid. Please update your environment configuration." 
        });
      } else {
        toast({ 
          variant: "destructive", 
          title: "AI Analysis Failed", 
          description: err.message || "An error occurred during neural processing. Check the browser console for details." 
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadResult = (chat: any) => {
    const res = chat.content as BIOutput;
    const cols = 42;
    const sep = "-".repeat(cols);
    const dSep = "=".repeat(cols);
    
    const center = (text: string) => {
      const space = Math.max(0, Math.floor((cols - text.length) / 2));
      return " ".repeat(space) + text;
    };

    let content = "";
    content += center("URBAN AI RESULTS") + "\n";
    content += center(new Date(chat.timestamp).toLocaleString('en-KE')) + "\n";
    content += dSep + "\n";
    content += `SUMMARY:\n${res.summary}\n`;
    content += sep + "\n";
    content += `INSIGHTS:\n`;
    res.insights.forEach(i => content += `• ${i}\n`);
    content += sep + "\n";
    content += `RECOMMENDATION:\n${res.recommendation}\n`;
    content += dSep + "\n";
    content += center("URBAN EXPRESS BUSINESS OS") + "\n";

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UrbanAI_Result_${new Date(chat.timestamp).getTime()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Result Exported" });
  };

  const clearHistory = async () => {
    if (!firestore || !user || !chatHistory) return;
    if (!confirm("Permanently delete all AI conversation records?")) return;
    
    const batch = writeBatch(firestore);
    chatHistory.forEach(c => {
      batch.delete(doc(firestore, 'users', user.uid, 'ai_chats', c.id));
    });
    await batch.commit();
    toast({ title: "History Cleared" });
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-6 pb-20 max-w-[1600px] mx-auto pt-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <h1 className="text-4xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">URBAN AI</h1>
          <p className="text-zinc-500 mt-2 uppercase text-[10px] font-bold tracking-widest">Advanced Business Intelligence & Support</p>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "h-10 px-4 gap-2 font-black uppercase text-[9px] tracking-widest bg-white border-zinc-100 shadow-sm rounded-xl",
            aiStatus.hasKey ? "text-green-600" : "text-red-500"
          )}
        >
           <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", aiStatus.hasKey ? "bg-green-500" : "bg-red-500")} />
           AI STATUS: {aiStatus.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-2">
        {/* Main Chat Interface */}
        <Card className="lg:col-span-8 border-none shadow-mobile rounded-[2.5rem] bg-white border border-zinc-100 flex flex-col h-[75vh] overflow-hidden">
           <CardHeader className="p-8 border-b border-zinc-50 flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest">Consult AI</CardTitle>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mt-0.5">Persistent conversation history active</p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearHistory} className="text-[9px] font-black text-zinc-400 uppercase tracking-widest hover:text-red-500">Clear Records</Button>
           </CardHeader>
           
           <ScrollArea className="flex-1 p-8">
              <div className="space-y-8">
                 {(!chatHistory || chatHistory.length === 0) && (
                    <div className="py-20 text-center space-y-6 opacity-40">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Ready for inquiry</p>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                          {QUICK_PROMPTS.map(p => (
                            <Button 
                              key={p.label} 
                              onClick={() => handleConsult(undefined, p.query)}
                              variant="outline" 
                              className="h-12 rounded-xl text-[9px] font-black uppercase tracking-widest border-zinc-100 hover:bg-zinc-50"
                            >
                              {p.label}
                            </Button>
                          ))}
                       </div>
                    </div>
                 )}

                 {[...(chatHistory || [])].reverse().map((msg, i) => (
                   <div key={i} className={cn(
                     "flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2",
                     msg.role === 'user' ? "items-end" : "items-start"
                   )}>
                      <div className={cn(
                        "max-w-[85%] p-6 rounded-[1.5rem]",
                        msg.role === 'user' ? "bg-zinc-900 text-white rounded-tr-none" : "bg-zinc-50 text-zinc-900 border border-zinc-100 rounded-tl-none shadow-sm"
                      )}>
                         {typeof msg.content === 'string' ? (
                           <p className="text-xs font-bold leading-relaxed uppercase tracking-tight">{msg.content}</p>
                         ) : (
                           <div className="space-y-4">
                              <p className="text-xs font-black uppercase tracking-tight border-l-2 border-primary pl-4">{msg.content.summary}</p>
                              <div className="grid gap-2">
                                 {msg.content.insights.map((insight: string, idx: number) => (
                                   <div key={idx} className="flex gap-2 text-[10px] font-bold text-zinc-500 uppercase">
                                      <span>• {insight}</span>
                                   </div>
                                 ))}
                              </div>
                              <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
                                 <div>
                                    <p className="text-[9px] font-black uppercase text-zinc-400 mb-1">Recommended Action</p>
                                    <p className="text-[11px] font-black text-primary uppercase">{msg.content.recommendation}</p>
                                 </div>
                                 <Button 
                                  onClick={() => handleDownloadResult(msg)}
                                  variant="outline" 
                                  size="sm" 
                                  className="h-9 px-3 border-zinc-200 text-[8px] font-black uppercase tracking-widest gap-2 bg-white"
                                 >
                                    <Download className="w-3.5 h-3.5" /> Result.txt
                                 </Button>
                              </div>
                           </div>
                         )}
                      </div>
                      <span className="text-[7px] font-black uppercase text-zinc-300 px-2">
                        {msg.role === 'user' ? 'OPERATOR' : 'URBAN AI'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                   </div>
                 ))}
                 
                 {isConsulting && (
                    <div className="flex flex-col items-start gap-3">
                       <div className="bg-zinc-50 p-6 rounded-[1.5rem] rounded-tl-none border border-zinc-100">
                          <RefreshCcw className="w-5 h-5 text-primary animate-spin" />
                       </div>
                    </div>
                 )}
              </div>
           </ScrollArea>

           <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 shrink-0">
              <form onSubmit={handleConsult} className="relative">
                 <Input 
                  value={queryText}
                  onChange={e => setQueryText(e.target.value)}
                  placeholder="Ask about sales, stock or employee performance..."
                  className="h-16 pl-6 pr-20 bg-white border-zinc-200 rounded-2xl font-bold shadow-inner"
                  disabled={isConsulting}
                 />
                 <Button 
                   type="submit" 
                   disabled={!queryText.trim() || isConsulting}
                   className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 bg-zinc-900 text-primary rounded-xl shadow-xl active:scale-95 transition-all"
                 >
                    <Send className="w-5 h-5" />
                 </Button>
              </form>
           </div>
        </Card>

        {/* Results & History Sidebar */}
        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-mobile rounded-[2.5rem] bg-zinc-900 text-white p-8 border border-white/5 relative overflow-hidden h-[45vh] flex flex-col">
              <div className="relative z-10 space-y-6 flex-1 flex flex-col overflow-hidden">
                 <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest">Results Download</h3>
                    <Badge className="bg-primary/20 text-primary text-[8px] border-none font-black uppercase px-2 h-4">LEDGER</Badge>
                 </div>
                 
                 <ScrollArea className="flex-1 -mx-2 px-2 no-scrollbar">
                    <div className="space-y-3">
                       {chatHistory?.filter((c: any) => c.role === 'ai').map((chat: any) => (
                         <button 
                           key={chat.id}
                           onClick={() => handleDownloadResult(chat)}
                           className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-all text-left"
                         >
                            <div className="min-w-0">
                               <p className="text-[10px] font-black uppercase text-white truncate pr-4">{(chat.content as BIOutput).summary}</p>
                               <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                                 {new Date(chat.timestamp).toLocaleDateString()} • {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                               </p>
                            </div>
                            <FileDown className="w-4 h-4 text-zinc-500 shrink-0" />
                         </button>
                       ))}
                       {(!chatHistory || chatHistory.filter((c: any) => c.role === 'ai').length === 0) && (
                         <div className="py-12 text-center opacity-20">
                            <p className="text-[9px] font-black uppercase tracking-widest">No generated results</p>
                         </div>
                       )}
                    </div>
                 </ScrollArea>
              </div>
           </Card>

           <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 border border-zinc-100">
              <div className="flex items-center gap-3 mb-6">
                 <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900">Information Accuracy</h3>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase leading-relaxed mb-6">
                Urban AI analyzes synchronized database telemetry. While highly accurate, recommendations should be verified before procurement actions.
              </p>
              <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl">
                 <AlertCircle className="w-4 h-4 text-zinc-300" />
                 <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Real-time sync active</span>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
}