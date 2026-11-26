
'use client';

import { PageHeader } from '@/components/shared/page-layout';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, 
  Upload, 
  Trash2, 
  Save, 
  RefreshCcw, 
  Smartphone as SmartphoneIcon,
  ShieldCheck,
  FileCode,
  Layout,
  ShoppingCart,
  ShoppingBag,
  Zap,
  Globe,
  Loader2,
  CheckCircle2,
  Activity,
  History,
  Edit2,
  Archive,
  ArrowRight,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/use-profile';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { doc, setDoc, addDoc, collection, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { uploadAppReleaseFile } from '@/lib/actions';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function AppReleaseManager() {
  const { isSuperAdmin, profile } = useProfile();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingApk, setIsUploadingApk] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Releases History Query
  const releasesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'app_releases'), orderBy('updatedAt', 'desc'), limit(10));
  }, [firestore]);

  const { data: history, loading: historyLoading } = useCollection<any>(releasesQuery);

  // Form State
  const [version, setVersion] = useState('');
  const [apkUrl, setApkUrl] = useState('');
  const [apkSize, setApkSize] = useState('');
  const [screenshots, setScreenshots] = useState({
    landing: '',
    shop: '',
    cart: ''
  });

  const handleApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.apk')) {
      toast({ variant: "destructive", title: "Invalid Format", description: "Please upload an Android APK file." });
      return;
    }

    setIsUploadingApk(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'APK');
      
      const result = await uploadAppReleaseFile(formData);
      if (result.success && result.url) {
        setApkUrl(result.url);
        setApkSize(result.size || '');
        toast({ title: "APK Deployed", description: "Binary synchronized with R2 edge." });
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message || "File size may exceed server limits." });
    } finally {
      setIsUploadingApk(false);
    }
  };

  const handleScreenshotUpload = async (type: keyof typeof screenshots, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type.toUpperCase());
    
    try {
      const result = await uploadAppReleaseFile(formData);
      if (result.success && result.url) {
        setScreenshots(prev => ({ ...prev, [type]: result.url }));
        toast({ title: "Visual Node Updated", description: `${type} screenshot synchronized.` });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Handshake Failed" });
    }
  };

  const handleSaveConfig = async () => {
    if (!firestore || !profile || !version || !apkUrl) {
      toast({ variant: "destructive", title: "Missing Data", description: "Version and APK binary are required." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const releaseData = {
        version,
        apkUrl,
        apkSize,
        screenshots,
        updatedAt: Date.now(),
        updatedBy: profile.displayName,
        isLatest: true
      };

      if (editingId) {
        await setDoc(doc(firestore, 'app_releases', editingId), releaseData);
      } else {
        await addDoc(collection(firestore, 'app_releases'), releaseData);
      }

      await addDoc(collection(firestore, 'audit_logs'), {
        action: editingId ? 'APP_RELEASE_UPDATE' : 'APP_RELEASE_NEW',
        userId: profile.uid,
        details: `Published mobile release v${version}. Node: ${apkUrl}`,
        timestamp: Date.now(),
        severity: 'CRITICAL'
      });

      toast({ title: "Release Published", description: "Global download nodes updated." });
      handleReset();
    } catch (err) {
      toast({ variant: "destructive", title: "Action Blocked" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (release: any) => {
    setEditingId(release.id);
    setVersion(release.version);
    setApkUrl(release.apkUrl);
    setApkSize(release.apkSize);
    setScreenshots(release.screenshots || { landing: '', shop: '', cart: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !isSuperAdmin) return;
    if (!confirm("Permanently remove this release from history?")) return;
    
    try {
      await deleteDoc(doc(firestore, 'app_releases', id));
      toast({ title: "Release Purged" });
    } catch (e) {
      toast({ variant: "destructive", title: "Action Refused" });
    }
  };

  const handleReset = () => {
    setEditingId(null);
    setVersion('');
    setApkUrl('');
    setApkSize('');
    setScreenshots({ landing: '', shop: '', cart: '' });
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-8 pb-32 max-w-[1200px] mx-auto pt-4 px-2 ua-compact-page">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
             <Smartphone className="w-4 h-4 text-primary" />
             <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Mobile Ecosystem Lifecycle</span>
          </div>
          <PageHeader title="Release Manager" breadcrumb={["Admin", "Release Manager"]} className="mb-0" />
        </div>
        <div className="flex gap-2">
          {editingId && <Button variant="ghost" onClick={handleReset} className="h-12 px-6 text-[10px] font-black uppercase">Cancel Edit</Button>}
          <Button 
            onClick={handleSaveConfig}
            disabled={isSubmitting}
            className="h-12 px-8 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-3 transition-all active:scale-95"
          >
            {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin" /> : (editingId ? <Save className="w-4 h-4 text-primary" /> : <Plus className="w-4 h-4 text-primary" />)}
            {editingId ? 'Update Release' : 'Publish New Version'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Core Release Definition Container */}
        <div className="lg:col-span-7 space-y-8">
           <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white p-10 border border-zinc-100">
              <CardTitle className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                 <FileCode className="w-5 h-5 text-primary" /> Release Core
              </CardTitle>
              
              <div className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                       <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Semantic Version</Label>
                       <Input 
                         value={version} 
                         onChange={e => setVersion(e.target.value)} 
                         placeholder="e.g. 2.8.0" 
                         className="h-14 bg-zinc-50 border-none rounded-2xl px-6 font-black"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[9px] font-black uppercase text-zinc-400 px-1">Package Weight</Label>
                       <Input 
                         value={apkSize} 
                         disabled
                         placeholder="Auto-calculated" 
                         className="h-14 bg-zinc-100 border-none rounded-2xl px-6 font-mono font-bold text-zinc-500"
                       />
                    </div>
                 </div>

                 <div className="p-8 bg-zinc-50 rounded-[2rem] border border-dashed border-zinc-200 flex flex-col items-center text-center gap-6">
                    {isUploadingApk ? (
                       <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-10 h-10 text-primary animate-spin" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Deploying binary to R2...</p>
                       </div>
                    ) : apkUrl ? (
                       <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-green-500 shadow-sm">
                             <CheckCircle2 className="w-7 h-7" />
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-zinc-900">urban_express.apk</p>
                             <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Binary Host: Cloudflare Edge</p>
                          </div>
                          <Label htmlFor="apk-upload" className="mt-2 text-[8px] font-black uppercase text-primary cursor-pointer hover:underline">Replace binary file</Label>
                       </div>
                    ) : (
                       <div className="flex flex-col items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-zinc-300 shadow-inner">
                             <Upload className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-[10px] font-black uppercase text-zinc-400">Upload Android Binary</p>
                             <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest leading-relaxed px-12">Production APK candidates only</p>
                          </div>
                       </div>
                    )}
                    <input id="apk-upload" type="file" accept=".apk" onChange={handleApkUpload} className="hidden" />
                    {!isUploadingApk && !apkUrl && (
                      <Button onClick={() => document.getElementById('apk-upload')?.click()} variant="outline" className="h-10 px-8 rounded-xl text-[9px] font-black uppercase bg-white border-zinc-100 shadow-sm">Choose APK</Button>
                    )}
                 </div>
              </div>
           </Card>

           <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white p-10 border border-zinc-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                   <History className="w-5 h-5 text-primary" /> Version Registry
                </h3>
                <Badge variant="outline" className="text-[8px] uppercase font-black px-3">{history?.length || 0} Releases</Badge>
              </div>
              <div className="space-y-4">
                 {history?.map((release) => (
                    <div key={release.id} className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:border-primary/20 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-900 font-black text-xs">v{release.version}</div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-zinc-900 flex items-center gap-2">
                               Production Build 
                               {release.updatedAt === Math.max(...history.map((h: any) => h.updatedAt)) && (
                                 <Badge className="bg-emerald-500 text-white border-none text-[6px] font-black h-4 px-1.5">LATEST</Badge>
                               )}
                             </p>
                             <p className="text-[8px] font-bold text-zinc-400 uppercase mt-0.5 tracking-widest">Released: {new Date(release.updatedAt).toLocaleDateString()}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <Button onClick={() => handleEdit(release)} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-white"><Edit2 className="w-4 h-4" /></Button>
                          <Button onClick={() => handleDelete(release.id)} variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-zinc-300 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                       </div>
                    </div>
                 ))}
                 {!historyLoading && history?.length === 0 && (
                   <div className="py-20 text-center opacity-30 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-100">
                      <Archive className="w-10 h-10 mx-auto mb-3" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No release history recorded</p>
                   </div>
                 )}
              </div>
           </Card>
        </div>

        {/* Visual Presentation */}
        <div className="lg:col-span-5 space-y-6">
           <Card className="rounded-[2.5rem] border-none shadow-mobile bg-white p-10 border border-zinc-100">
              <CardTitle className="text-sm font-black uppercase tracking-widest mb-8 flex items-center gap-3">
                 <Layout className="w-5 h-5 text-primary" /> Interactive Mockup Nodes
              </CardTitle>

              <div className="space-y-10">
                 <ScreenshotUploader 
                   type="landing" 
                   label="Landing Interface" 
                   url={screenshots.landing} 
                   icon={Globe}
                   onUpload={(file: File) => handleScreenshotUpload('landing', file)} 
                 />
                 <ScreenshotUploader 
                   type="shop" 
                   label="Catalog Node" 
                   url={screenshots.shop} 
                   icon={ShoppingBag}
                   onUpload={(file: File) => handleScreenshotUpload('shop', file)} 
                 />
                 <ScreenshotUploader 
                   type="cart" 
                   label="Checkout Buffer" 
                   url={screenshots.cart} 
                   icon={ShoppingCart}
                   onUpload={(file: File) => handleScreenshotUpload('cart', file)} 
                 />
              </div>
           </Card>
        </div>

      </div>
    </div>
  );
}

function ScreenshotUploader({ label, url, onUpload, icon: Icon, type }: any) {
  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
             <Icon className="w-3.5 h-3.5 text-zinc-300" />
             <Label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</Label>
          </div>
          {url && <Badge className="bg-green-50 text-green-600 border-none text-[8px] font-black h-4 px-2">SYNCED</Badge>}
       </div>
       
       <div 
         onClick={() => document.getElementById(`upload-${type}`)?.click()}
         className={cn(
           "relative aspect-[16/9] rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex items-center justify-center",
           url ? "border-zinc-100 bg-white shadow-sm" : "border-zinc-200 bg-zinc-50 hover:border-primary/40 hover:bg-primary/5"
         )}
       >
          {url ? (
             <img src={url} alt={label} className="w-full h-full object-cover" />
          ) : (
             <Upload className="w-6 h-6 text-zinc-200" />
          )}
          <input 
            id={`upload-${type}`} 
            type="file" 
            accept="image/*" 
            onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} 
            className="hidden" 
          />
       </div>
    </div>
  );
}
