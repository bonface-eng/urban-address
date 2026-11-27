'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ImageIcon, 
  Search, 
  Filter, 
  Trash2, 
  RefreshCcw, 
  ExternalLink, 
  Download, 
  HardDrive,
  Grid,
  List,
  ChevronRight,
  Database,
  ShieldCheck,
  Cloud,
  Layers,
  ShoppingBag,
  Wine,
  Zap,
  User,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { listImagesFromR2 } from '@/lib/actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useProfile } from '@/hooks/use-profile';

const CATEGORIES = ['All', 'Store', 'Lounge', 'Carwash', 'Profile', 'Other'];

export default function AssetHub() {
  const { isSuperAdmin } = useProfile();
  const [images, setImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const result = await listImagesFromR2();
      if (result.success) {
        setImages(result.images || []);
      } else {
        toast({ variant: "destructive", title: "Sync Failed", description: result.message });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Infrastructure Error" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAssets = useMemo(() => {
    return images.filter(img => {
      const matchesSearch = !searchTerm || img.key.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = activeCategory === 'All' || img.category.toLowerCase() === activeCategory.toLowerCase();
      return matchesSearch && matchesCat;
    });
  }, [images, searchTerm, activeCategory]);

  const stats = useMemo(() => {
    const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
    return {
      count: images.length,
      size: (totalSize / (1024 * 1024)).toFixed(2) + ' MB',
      categories: CATEGORIES.filter(c => c !== 'All').map(c => ({
        name: c,
        count: images.filter(img => img.category.toLowerCase() === c.toLowerCase()).length
      }))
    };
  }, [images]);

  if (!isSuperAdmin) return <div className="p-20 text-center font-black uppercase">Unauthorized Node</div>;

  return (
    <div className="space-y-8 pb-32 max-w-[1600px] mx-auto pt-4 px-2">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <Cloud className="w-4 h-4 text-primary" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Infrastructure Asset Hub</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">Global Assets</h1>
          <p className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Real-time management of Cloudflare R2 storage nodes</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-1.5">
             <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => setViewMode('GRID')}
               className={cn("h-10 w-10 rounded-xl transition-all", viewMode === 'GRID' ? "bg-zinc-900 text-white" : "text-zinc-300")}
             >
                <Grid className="w-5 h-5" />
             </Button>
             <Button 
               variant="ghost" 
               size="icon" 
               onClick={() => setViewMode('LIST')}
               className={cn("h-10 w-10 rounded-xl transition-all", viewMode === 'LIST' ? "bg-zinc-900 text-white" : "text-zinc-300")}
             >
                <List className="w-5 h-5" />
             </Button>
          </div>
          <Button onClick={fetchAssets} disabled={isLoading} className="h-12 px-6 bg-zinc-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 gap-3">
            <RefreshCcw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Refresh Edge
          </Button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
         <AssetMetric title="Asset Count" value={stats.count.toString()} sub="Total Objects" icon={Layers} />
         <AssetMetric title="Node Weight" value={stats.size} sub="Storage Volume" icon={Database} color="text-primary" />
         <AssetMetric title="Edge Status" value="ACTIVE" sub="Cape Town Node" icon={ShieldCheck} color="text-emerald-600" />
         <AssetMetric title="Provider" value="CLOUDFLARE" sub="R2 Infrastructure" icon={Cloud} color="text-blue-500" />
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col lg:flex-row gap-6 px-1">
         <div className="flex-1 bg-white p-4 rounded-[2.5rem] shadow-sm border border-zinc-100 flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
               <Input 
                 placeholder="Search assets by file name or category..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="h-14 pl-12 bg-zinc-50 border-none rounded-2xl font-bold uppercase text-xs"
               />
            </div>
            <div className="flex gap-2 p-1 bg-zinc-50 rounded-2xl overflow-x-auto no-scrollbar w-full md:w-auto">
               {CATEGORIES.map(cat => (
                 <button
                   key={cat}
                   onClick={() => setActiveCategory(cat)}
                   className={cn(
                     "px-6 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                     activeCategory === cat ? "bg-white text-zinc-900 shadow-md" : "text-zinc-400 hover:text-zinc-600"
                   )}
                 >
                   {cat}
                 </button>
               ))}
            </div>
         </div>
      </div>

      {/* MAIN CONTENT GRID */}
      {isLoading ? (
        <div className="py-60 flex flex-col items-center justify-center gap-6 opacity-30">
           <div className="animate-pulse">
              <ImageIcon className="w-20 h-20 text-zinc-200" />
           </div>
           <p className="text-[12px] font-black uppercase tracking-[0.6em]">Linking storage clusters...</p>
        </div>
      ) : (
        <div className={cn(
          "px-1 pb-20",
          viewMode === 'GRID' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6" : "space-y-3"
        )}>
          {filteredAssets.map((asset) => (
            viewMode === 'GRID' ? (
              <div key={asset.key} className="group bg-white rounded-[2.5rem] overflow-hidden border border-zinc-100 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col h-full">
                 <div className="relative aspect-square overflow-hidden bg-zinc-50">
                    <Image 
                      src={asset.url} 
                      alt="" 
                      fill 
                      className="object-cover group-hover:scale-110 transition-transform duration-700" 
                      sizes="(max-width: 768px) 50vw, 15vw"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                       <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl border-white text-white hover:bg-white/20 uppercase font-black text-[8px] gap-2" asChild>
                          <a href={asset.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /> Raw URL</a>
                       </Button>
                    </div>
                    <div className="absolute top-4 left-4">
                       <Badge className="bg-white/90 backdrop-blur-md text-zinc-900 border-none font-black text-[7px] uppercase px-3 h-6 shadow-sm">
                          {asset.category}
                       </Badge>
                    </div>
                 </div>
                 <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-zinc-900 uppercase truncate mb-1">{asset.key.split('/').pop()}</p>
                       <div className="flex items-center gap-2 text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                          <History className="w-3 h-3" />
                          {new Date(asset.lastModified).toLocaleDateString()}
                       </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-50">
                       <span className="text-[8px] font-black text-zinc-300 uppercase">{(asset.size / 1024).toFixed(1)} KB</span>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                             <button className="text-zinc-200 hover:text-zinc-900"><MoreVertical className="w-4 h-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl border-none shadow-2xl p-2">
                             <DropdownMenuItem className="rounded-xl py-3 gap-3">
                                <Download className="w-4 h-4 text-zinc-400" />
                                <span className="text-[10px] font-black uppercase">Download Asset</span>
                             </DropdownMenuItem>
                             <DropdownMenuItem className="rounded-xl py-3 gap-3 text-red-500 focus:text-red-600 focus:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase">Purge Object</span>
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                       </DropdownMenu>
                    </div>
                 </div>
              </div>
            ) : (
              <div key={asset.key} className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                 <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-50 border border-zinc-100 shadow-inner">
                       <Image src={asset.url} alt="" width={64} height={64} className="w-full h-full object-cover" />
                    </div>
                    <div>
                       <h4 className="text-sm font-black text-zinc-900 uppercase">{asset.key.split('/').pop()}</h4>
                       <div className="flex items-center gap-4 mt-1.5">
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-100">{asset.category}</Badge>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{new Date(asset.lastModified).toLocaleString()}</span>
                          <span className="text-[9px] font-bold text-zinc-300 uppercase tracking-widest">{(asset.size / 1024).toFixed(1)} KB</span>
                       </div>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-300 hover:text-primary"><Download className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                 </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function AssetMetric({ title, value, sub, icon: Icon, color = "text-zinc-900" }: any) {
  return (
    <Card className="border-none shadow-sm rounded-[2.5rem] bg-white p-8 border border-zinc-100 group hover:bg-zinc-50 transition-colors">
       <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 shadow-inner transition-transform group-hover:scale-110">
             <Icon className={cn("w-6 h-6", color)} />
          </div>
          <Badge className="bg-primary/5 text-primary border-none text-[8px] font-black px-3 h-5">Verified</Badge>
       </div>
       <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">{title}</p>
       <h3 className="text-3xl font-black font-headline text-zinc-900 tracking-tighter leading-none">{value}</h3>
       <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-2">{sub}</p>
    </Card>
  );
}
