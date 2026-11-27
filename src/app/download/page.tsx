
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import ClientLayout from '../client/layout';
import { 
  Smartphone, 
  Download, 
  ShieldCheck, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Info,
  ChevronRight,
  RefreshCcw,
  Activity,
  X,
  FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function DownloadAppPage() {
  const firestore = useFirestore();
  
  // Fetch only the single latest release
  const releasesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'app_releases'), orderBy('updatedAt', 'desc'), limit(1));
  }, [firestore]);

  const { data: releaseData, loading: releaseLoading } = useCollection<any>(releasesQuery);
  const release = releaseData?.[0];

  const [activeSlide, setActiveSlide] = useState(0);

  // Fallback to static values if no dynamic release exists
  const apkUrl = release?.apkUrl || "https://pub-ea042d0e7f4b426fa753e8006f0816a3.r2.dev/app/urban_express.apk";
  const version = release?.version || "2.8.0";
  const size = release?.apkSize || "24.5 MB";

  const previewPaths = [
    { path: '/', label: 'Landing' },
    { path: '/client/store', label: 'Catalog' },
    { path: '/client/cart', label: 'Checkout' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % previewPaths.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [previewPaths.length]);

  const features = [
    { title: "Real-time Tracking", desc: "Monitor your carwash detailing progress from start to finish.", icon: Zap },
    { title: "Digital Wallet", desc: "Manage your loyalty points and transaction history on the go.", icon: ShieldCheck },
    { title: "Quick Booking", desc: "Schedule detailing services and reserve lounge spots in seconds.", icon: Smartphone },
    { title: "Offline Access", desc: "Review catalog items and previous receipts even without internet.", icon: CheckCircle2 }
  ];

  return (
    <ClientLayout>
      <div className="flex flex-col min-h-screen bg-white">
        <section className="bg-zinc-50 border-b border-zinc-100 py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-6">
             <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-300 mb-6">
                <Link href="/" className="hover:text-primary transition-colors">HOME</Link> 
                <ChevronRight className="w-2.5 h-2.5" /> 
                <span className="text-primary">MOBILE APP</span>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="space-y-8">
                   <div className="space-y-4">
                      <Badge className="bg-primary/10 text-primary border-none text-[10px] font-black uppercase tracking-widest px-4 h-7">Android Production v{version}</Badge>
                      <h1 className="text-5xl md:text-8xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-[0.85]">
                         Business <br/> In Your <span className="text-primary">Pocket.</span>
                      </h1>
                      <p className="text-lg text-zinc-500 font-bold uppercase tracking-widest leading-relaxed pt-4 max-w-lg">
                         Experience the standard of Urban Express with our dedicated mobile application. Optimized for speed and precision.
                      </p>
                   </div>
                   
                   <div className="flex flex-col sm:flex-row items-center gap-4">
                      <Button asChild className="h-20 px-10 bg-zinc-900 text-white font-black uppercase text-[12px] tracking-[0.3em] rounded-2xl shadow-2xl active:scale-95 transition-all gap-4 w-full sm:w-auto group">
                         <a href={apkUrl} download={`UrbanExpress_v${version}.apk`}>
                            <Download className="w-5 h-5 text-primary group-hover:bounce" /> 
                            Download APK
                         </a>
                      </Button>
                      <div className="flex flex-col items-center sm:items-start px-2">
                         <p className="text-[10px] font-black text-zinc-900 uppercase">Package: {size}</p>
                         <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Direct Edge Link Verified</p>
                      </div>
                   </div>
                </div>

                <div className="relative flex justify-center lg:justify-end">
                   <div className="relative w-[280px] h-[580px] bg-zinc-900 rounded-[3rem] border-[10px] border-zinc-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] ring-1 ring-white/10 overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-40" />
                      <div className="absolute top-10 left-0 right-0 z-30 px-4 pointer-events-none">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                               <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                               <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Live Node Sync</span>
                            </div>
                            <span className="text-[7px] font-black text-primary uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-md">
                               {previewPaths[activeSlide].label}
                            </span>
                         </div>
                      </div>
                      <div className="w-full h-full bg-white relative overflow-hidden">
                         <iframe 
                           src={`${previewPaths[activeSlide].path}?uax_preview=true`}
                           className="w-full h-full border-none pointer-events-none select-none"
                           key={activeSlide}
                           title="App Preview"
                         />
                      </div>
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-40">
                         {previewPaths.map((_, idx) => (
                           <div key={idx} className={cn("h-1 rounded-full transition-all", activeSlide === idx ? "w-6 bg-primary" : "w-2 bg-zinc-400/40")} />
                         ))}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        <section className="py-24 bg-white">
           <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-20">
                 <h2 className="text-4xl font-black font-headline uppercase tracking-tighter text-zinc-900">Capabilities.</h2>
                 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.4em] mt-2">Driven by Precision Protocol</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                 {features.map((feature, i) => (
                   <div key={i} className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100 hover:border-primary/20 transition-all group">
                      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-zinc-300 group-hover:bg-primary group-hover:text-white transition-all mb-6">
                         <feature.icon className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-black uppercase text-zinc-900 mb-2 tracking-tight">{feature.title}</h4>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">{feature.desc}</p>
                   </div>
                 ))}
              </div>
           </div>
        </section>

        <section className="py-24 bg-zinc-50 border-y border-zinc-100">
           <div className="max-w-4xl mx-auto px-6 space-y-12">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Info className="w-6 h-6" />
                 </div>
                 <h3 className="text-xl font-black uppercase tracking-widest text-zinc-900">Installation Guide</h3>
              </div>
              <div className="grid gap-6">
                 <InstructionStep number="01" title="Download" desc="Tap the 'Download APK' button above to save the production binary." />
                 <InstructionStep number="02" title="Unknown Sources" desc="Enable 'Install from Unknown Sources' in your Android security settings." />
                 <InstructionStep number="03" title="Deploy" desc="Launch the installed application and sign in with your Urban Member ID." />
              </div>
           </div>
        </section>

        <section className="py-32 bg-white text-center">
           <div className="max-w-3xl mx-auto px-6 space-y-8">
              <h2 className="text-5xl md:text-7xl font-black font-headline uppercase tracking-tighter text-zinc-900">Stay <span className="text-primary">Connected.</span></h2>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.4em] max-w-lg mx-auto leading-relaxed">
                 The official mobile extension of our business operations, synchronized in real-time with the Nakuru Flagship node.
              </p>
              <Button asChild className="h-16 px-14 bg-zinc-900 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl shadow-xl hover:bg-zinc-800 transition-all active:scale-95 gap-3">
                 <a href={apkUrl} download={`UrbanExpress_v${version}.apk`}>Authorize Download</a>
              </Button>
           </div>
        </section>
      </div>
    </ClientLayout>
  );
}

function InstructionStep({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-8 p-8 bg-white rounded-3xl border border-zinc-200">
       <div className="text-4xl font-black font-headline text-primary/10 leading-none">{number}</div>
       <div className="space-y-1">
          <h4 className="text-sm font-black uppercase text-zinc-900 tracking-tight">{title}</h4>
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">{desc}</p>
       </div>
    </div>
  );
}
