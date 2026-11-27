'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Eye, 
  Lock,
  Flag,
  UserX,
  FileSearch,
  Zap,
  Fingerprint,
  Activity,
  UserCheck,
  RefreshCcw,
  ShieldCheck,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDb, useCollection } from '@/lib/data';
import { collection, query, orderBy, limit } from '@/lib/db';
import { AuditLog } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { analyzeAuditLogs, AuditOutput } from '@/ai/flows/audit-fraud-flow';

export default function FraudSecurityDashboard() {
  const firestore = useDb();
  const [mounted, setMounted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [aiReport, setAiReport] = useState<AuditOutput | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const auditQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
  }, [firestore]);

  const { data: logs, loading } = useCollection<AuditLog>(auditQuery);

  const criticalAlerts = logs?.filter(l => l.severity === 'CRITICAL').length || 0;

  const handleRiskAudit = async () => {
    if (!logs || logs.length === 0) {
      toast({ variant: "destructive", title: "Data Deficient", description: "Insufficient logs for security analysis." });
      return;
    }
    
    setIsScanning(true);
    setAiReport(null);
    toast({ title: "AI Scan Active", description: "Analyzing transaction patterns for potential risk." });
    
    try {
      const result = await analyzeAuditLogs({ logs: logs.slice(0, 20) });
      setAiReport(result);
      toast({ title: "Scan Complete", description: `Risk Level: ${result.riskLevel}` });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[AI SCAN FAILURE]', err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Fingerprint className="w-3.5 h-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">System Security Monitor</span>
          </div>
          <PageHeader title="Security & Risk" breadcrumb={["Security", "Security & Risk"]} className="mb-0" />
          <p className="text-zinc-500 mt-1 uppercase text-[10px] font-bold tracking-widest">AI risk detection and detailed activity logs</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleRiskAudit}
            disabled={isScanning || loading}
            className="h-11 px-6 bg-primary hover:bg-orange-600 text-white font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 gap-2"
          >
            {isScanning ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {isScanning ? 'Scanning...' : 'Run AI Security Scan'}
          </Button>
        </div>
      </div>

      {aiReport && (
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-zinc-900 text-white overflow-hidden animate-in slide-in-from-top-4 duration-500">
           <CardContent className="p-10 space-y-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-6">
                 <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                      aiReport.riskLevel === 'CRITICAL' || aiReport.riskLevel === 'HIGH' ? "bg-red-500" : "bg-green-500"
                    )}>
                       <ShieldAlert className="w-6 h-6 text-white" />
                    </div>
                    <div>
                       <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">AI Risk Assessment</p>
                       <h3 className="text-2xl font-black uppercase font-headline">{aiReport.riskLevel} RISK LEVEL</h3>
                    </div>
                 </div>
                 <Badge className="bg-white/10 text-white border-none uppercase font-black text-[8px] px-4">AI Analysis Engine</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Anomalies Detected</p>
                    <div className="space-y-3">
                       {aiReport.anomalies.map((a, i) => (
                         <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-primary/40 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                               <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                               <p className="text-xs font-bold text-white uppercase">{a.reason}</p>
                               <p className="text-[10px] text-zinc-500 font-medium leading-relaxed uppercase tracking-tight">{a.impact}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="p-8 bg-primary/5 rounded-[2rem] border border-primary/20 space-y-4">
                       <p className="text-[10px] font-black uppercase text-primary tracking-widest">Recommended Actions</p>
                       <p className="text-sm font-bold text-zinc-200 leading-relaxed uppercase tracking-tight">{aiReport.recommendation}</p>
                    </div>
                    <Button onClick={() => setAiReport(null)} variant="ghost" className="text-zinc-500 hover:text-white uppercase font-black text-[10px] tracking-widest w-full">Close Report</Button>
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RiskStatCard title="System Integrity" value="SECURE" status="OK" icon={ShieldCheck} />
        <RiskStatCard title="Security Alerts" value={criticalAlerts.toString()} status="CRITICAL" icon={AlertTriangle} />
        <RiskStatCard title="Forensic Monitor" value="READY" status="ACTIVE" icon={FileSearch} />
      </div>

      <Card className="border-none shadow-mobile rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="p-6 border-b border-zinc-50">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50">
              <TableRow className="border-zinc-50 hover:bg-transparent">
                <TableHead className="pl-6 h-14 text-[10px] uppercase font-black tracking-widest text-zinc-400">Action Details</TableHead>
                <TableHead className="h-14 text-[10px] uppercase font-black tracking-widest text-zinc-400">Operator</TableHead>
                <TableHead className="h-14 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-center">Level</TableHead>
                <TableHead className="pr-6 h-14 text-[10px] uppercase font-black tracking-widest text-zinc-400 text-right">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log) => (
                <TableRow key={log.id} className="border-zinc-50 hover:bg-zinc-50/50 transition-colors group">
                  <TableCell className="pl-6 py-5">
                    <div>
                       <span className="text-xs font-black text-zinc-900 uppercase leading-none block mb-1">{log.action}</span>
                       <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight line-clamp-1">{log.details}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3 h-3 text-zinc-300" />
                      <span className="text-[10px] font-bold text-zinc-500 font-mono">
                        {log.userId.slice(0, 10).toUpperCase()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-[8px] font-black border-none uppercase px-3 h-5", log.severity === 'CRITICAL' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6 text-[10px] font-bold text-zinc-400">
                     {mounted ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskStatCard({ title, value, status, icon: Icon }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden border border-zinc-50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", status === 'CRITICAL' ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-400")}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn("text-[8px] font-black uppercase px-2.5 py-1 rounded-md", status === 'CRITICAL' ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600")}>{status}</div>
      </div>
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-3xl font-black font-headline text-zinc-900 tracking-tighter leading-none">{value}</h3>
    </Card>
  );
}
