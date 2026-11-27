'use client';

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReceiptSettings, DEFAULT_RECEIPT_SETTINGS, ReceiptSettings } from '@/hooks/use-receipt-settings';
import { Settings2, RefreshCcw, Building2, MapPin, Phone, CreditCard, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ReceiptSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptSettingsDialog({ open, onOpenChange }: ReceiptSettingsDialogProps) {
  const { settings, loading, updateSettings } = useReceiptSettings();
  const [formData, setFormData] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (field: keyof ReceiptSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_RECEIPT_SETTINGS);
    toast({ title: "Form Reset", description: "Reset fields to default system template." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await updateSettings(formData);
    setIsSubmitting(false);
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="bg-zinc-900 p-8 border-b border-white/10 text-center shrink-0">
           <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
             <Settings2 className="w-6 h-6" />
           </div>
           <DialogHeader>
              <DialogTitle className="font-headline uppercase tracking-widest text-lg text-white">
                Edit Receipt Data & Headers
              </DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase text-zinc-400 mt-1">
                Customize business names, branch location, contact info, and footer notes for thermal receipts.
              </DialogDescription>
           </DialogHeader>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-6">
           <Tabs defaultValue="headers" className="w-full">
              <TabsList className="bg-zinc-100 p-1.5 rounded-2xl h-12 mb-6 w-full flex">
                 <TabsTrigger value="headers" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Brand Headers
                 </TabsTrigger>
                 <TabsTrigger value="location" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Address & Contact
                 </TabsTrigger>
                 <TabsTrigger value="footer" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Footer & Tax
                 </TabsTrigger>
              </TabsList>

              {/* TAB 1: BRAND HEADERS */}
              <TabsContent value="headers" className="space-y-4 m-0">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Retail Store Header</Label>
                    <Input 
                      value={formData.storeHeader} 
                      onChange={e => handleChange('storeHeader', e.target.value)} 
                      placeholder="e.g. URBAN ACCESSORIES"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                      required
                    />
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Lounge & Bar Header</Label>
                    <Input 
                      value={formData.loungeHeader} 
                      onChange={e => handleChange('loungeHeader', e.target.value)} 
                      placeholder="e.g. URBAN ADDRESS"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                      required
                    />
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Carwash & Detailing Header</Label>
                    <Input 
                      value={formData.carwashHeader} 
                      onChange={e => handleChange('carwashHeader', e.target.value)} 
                      placeholder="e.g. URBAN AUTO EXPRESS"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                      required
                    />
                 </div>
              </TabsContent>

              {/* TAB 2: ADDRESS & CONTACT */}
              <TabsContent value="location" className="space-y-4 m-0">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Branch Subtitle</Label>
                       <Input 
                         value={formData.branchName} 
                         onChange={e => handleChange('branchName', e.target.value)} 
                         placeholder="e.g. NAKA CENTER BRANCH"
                         className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                         required
                       />
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Location / Address</Label>
                       <Input 
                         value={formData.location} 
                         onChange={e => handleChange('location', e.target.value)} 
                         placeholder="e.g. NAKURU, KENYA"
                         className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                         required
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Telephone / Hotline</Label>
                    <Input 
                      value={formData.phone} 
                      onChange={e => handleChange('phone', e.target.value)} 
                      placeholder="e.g. 0785860753"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                      required
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Store Paybill / Acc</Label>
                       <div className="flex gap-2">
                          <Input 
                            value={formData.paybill} 
                            onChange={e => handleChange('paybill', e.target.value)} 
                            placeholder="Paybill" 
                            className="h-12 bg-zinc-50 border-none rounded-xl px-4 font-bold text-xs"
                          />
                          <Input 
                            value={formData.accountNo} 
                            onChange={e => handleChange('accountNo', e.target.value)} 
                            placeholder="Acc No" 
                            className="h-12 bg-zinc-50 border-none rounded-xl px-4 font-bold text-xs"
                          />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Lounge Paybill / Acc</Label>
                       <div className="flex gap-2">
                          <Input 
                            value={formData.loungePaybill} 
                            onChange={e => handleChange('loungePaybill', e.target.value)} 
                            placeholder="Paybill" 
                            className="h-12 bg-zinc-50 border-none rounded-xl px-4 font-bold text-xs"
                          />
                          <Input 
                            value={formData.loungeAccountNo} 
                            onChange={e => handleChange('loungeAccountNo', e.target.value)} 
                            placeholder="Acc No" 
                            className="h-12 bg-zinc-50 border-none rounded-xl px-4 font-bold text-xs"
                          />
                       </div>
                    </div>
                 </div>
              </TabsContent>

              {/* TAB 3: FOOTER & TAX */}
              <TabsContent value="footer" className="space-y-4 m-0">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">KRA PIN / VAT Number (Optional)</Label>
                    <Input 
                      value={formData.vatNumber || ''} 
                      onChange={e => handleChange('vatNumber', e.target.value)} 
                      placeholder="e.g. P051234567Z"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                    />
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Customer Thank-You Message</Label>
                    <Input 
                      value={formData.footerNote} 
                      onChange={e => handleChange('footerNote', e.target.value)} 
                      placeholder="e.g. Thank you for your patronage"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                      required
                    />
                 </div>

                 <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-zinc-400 px-1">Bottom System Tagline</Label>
                    <Input 
                      value={formData.footerTagline} 
                      onChange={e => handleChange('footerTagline', e.target.value)} 
                      placeholder="e.g. Urban Express Business OS"
                      className="h-14 bg-zinc-50 border-none rounded-2xl px-5 font-bold uppercase"
                      required
                    />
                 </div>
              </TabsContent>
           </Tabs>

           <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleResetDefaults}
                className="text-[9px] font-black uppercase text-zinc-400 hover:text-zinc-900"
              >
                 Reset to System Defaults
              </Button>
           </div>

           <Button 
             type="submit" 
             disabled={isSubmitting || loading}
             className="w-full h-16 bg-zinc-900 hover:bg-zinc-800 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl transition-all active:scale-95"
           >
              {isSubmitting ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 text-primary mr-2" />}
              Save Receipt Header & Data
           </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
