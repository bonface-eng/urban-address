'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FullPageEditor } from '@/components/admin/full-page-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { listImagesFromR2 } from '@/lib/actions';
import { Search, Image as ImageIcon, Loader2, X, Check, Calendar, HardDrive, RefreshCcw, Filter, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';

interface ImageLibraryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  category?: string;
}

const CATEGORY_TABS = ['All', 'Profile Images', 'Product Images', 'System Images'];

export function ImageLibraryDialog({ isOpen, onClose, onSelect, category }: ImageLibraryDialogProps) {
  const [images, setImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    if (isOpen) {
      fetchImages();
    }
  }, [isOpen]);

  const fetchImages = async () => {
    setIsLoading(true);
    try {
      // Fetch everything in the root catalog/ folder to ensure all unit images are available
      const result = await listImagesFromR2();
      if (result.success) {
        setImages(result.images || []);
      } else {
        toast({ variant: "destructive", title: "Library Sync Failed", description: result.message });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Connection Error" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const assetKey = String(img?.key || '');
      const assetCategory = String(img?.category || 'System Images');
      const matchesSearch = !searchTerm || assetKey.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTab = activeTab === 'All' || assetCategory.toLowerCase() === activeTab.toLowerCase();
      return matchesSearch && matchesTab;
    });
  }, [images, searchTerm, activeTab]);

  return (
    <FullPageEditor open={isOpen} title="Universal image library" description="Select an existing asset from shared storage." onClose={onClose}>
      <div className="flex min-h-[70vh] flex-col">
        {/* Header */}
        <div className="p-8 border-b border-zinc-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                 <ImageIcon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-headline uppercase tracking-widest text-2xl text-zinc-900 leading-none">Universal Library</h2>
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.4em] mt-2">Access assets from all business nodes.</p>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <Input 
                  placeholder="Search file registry..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-12 pl-11 bg-zinc-50 border-none rounded-xl text-[10px] font-black uppercase tracking-widest"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={fetchImages} className="h-12 w-12 rounded-xl bg-zinc-50 text-zinc-400 hover:text-primary transition-all active:scale-90">
                 <RefreshCcw className={cn("w-5 h-5", isLoading && "animate-spin")} />
              </Button>
           </div>
        </div>

        {/* Category Filters */}
        <div className="px-8 py-3 border-b border-zinc-50 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-zinc-50/50">
           <div className="flex items-center gap-1.5 mr-4 text-zinc-300">
              <Filter className="w-3.5 h-3.5" />
              <span className="text-[8px] font-black uppercase tracking-widest">Filter:</span>
           </div>
           {CATEGORY_TABS.map(tab => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={cn(
                 "px-5 h-8 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                 activeTab === tab ? "bg-zinc-900 text-white shadow-lg" : "bg-white text-zinc-400 border border-zinc-100 hover:bg-zinc-50"
               )}
             >
               {tab}
             </button>
           ))}
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-hidden">
           <ScrollArea className="h-full p-8">
              {isLoading ? (
                <div className="py-40 flex flex-col items-center justify-center gap-6 opacity-30">
                   <div className="animate-pulse">
                      <ImageIcon className="w-16 h-16 text-zinc-200" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]">Synchronizing Storage Nodes...</p>
                </div>
              ) : filteredImages.length === 0 ? (
                <div className="py-40 flex flex-col items-center justify-center gap-4 opacity-20">
                   <HardDrive className="w-16 h-16 text-zinc-200" />
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]">No matching assets in this class</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                   {filteredImages.map((img) => (
                     <button
                       key={img.key}
                       onClick={() => {
                         onSelect(img.url);
                         onClose();
                       }}
                       className="group relative aspect-square rounded-3xl overflow-hidden bg-zinc-50 border border-zinc-100 hover:border-primary/40 transition-all hover:shadow-2xl active:scale-[0.98] flex flex-col"
                     >
                        <div className="relative flex-1 w-full overflow-hidden">
                           <Image 
                             src={img.url} 
                             alt="" 
                             fill
                             className="object-cover transition-transform duration-700 group-hover:scale-110"
                             sizes="(max-width: 768px) 50vw, 20vw"
                           />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                              <Check className="w-8 h-8 text-white" />
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">Select Asset</span>
                           </div>
                        </div>
                        <div className="p-3 bg-white border-t border-zinc-50 flex items-center justify-between">
                           <span className="text-[7px] font-black uppercase text-zinc-400 truncate max-w-[70%]">{img.key.split('/').pop()}</span>
                           <Badge className="bg-zinc-900 text-white border-none text-[6px] font-black h-4 px-1.5 uppercase">{img.category}</Badge>
                        </div>
                     </button>
                   ))}
                </div>
              )}
           </ScrollArea>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
           <div className="flex items-center gap-4 text-zinc-400">
              <Globe className="w-5 h-5 text-primary" />
              <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-sm">
                Assets are distributed via Cloudflare Global Edge. Selecting an existing image prevents duplicate storage costs.
              </p>
           </div>
           <p className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.6em]">UAX INFRASTRUCTURE NODE</p>
        </div>
      </div>
    </FullPageEditor>
  );
}
