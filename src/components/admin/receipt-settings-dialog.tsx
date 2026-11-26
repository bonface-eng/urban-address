'use client';

import React, { useState, useEffect } from 'react';
import { FullPageEditor } from '@/components/admin/full-page-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useReceiptSettings, DEFAULT_RECEIPT_SETTINGS, ReceiptSettings } from '@/hooks/use-receipt-settings';
import { Settings2, RefreshCcw, Building2, MapPin, Phone, CreditCard, FileText, CheckCircle2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
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
    <FullPageEditor open={open} title="Receipt configuration" description="Edit business headers, branch details and receipt content." onClose={() => onOpenChange(false)}>
      <div className="flex w-full flex-col">
        {/* MODAL HEADER */}
        <div className="bg-zinc-900 p-8 border-b border-white/10 text-center shrink-0">
           <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
             <Settings2 className="w-6 h-6" />
           </div>
           <div>
              <h2 className="font-headline uppercase tracking-widest text-lg text-white">
                Edit Receipt Data & Headers
              </h2>
              <p className="text-[10px] font-black uppercase text-zinc-400 mt-1">
                Customize business names, branch location, contact info, and footer notes for thermal receipts.
              </p>
           </div>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-6">
           <Tabs defaultValue="headers" className="w-full">
              <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1.5">
                 <TabsTrigger value="headers" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Brand Headers
                 </TabsTrigger>
                 <TabsTrigger value="location" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Address & Contact
                 </TabsTrigger>
                 <TabsTrigger value="footer" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Footer & Tax
                 </TabsTrigger>
                 <TabsTrigger value="sections" className="flex-1 rounded-xl h-full text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary transition-all">
                   Custom Sections
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

              <TabsContent value="sections" className="m-0 space-y-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-bold text-zinc-900">Custom receipt sections</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Add store policies, service notes, warranty terms, bank details, social handles or any extra information. Sections are displayed on receipts in the order shown.</p>
                </div>
                {(formData.receiptSections || []).slice().sort((a, b) => a.order - b.order).map((section, index, sections) => (
                  <div key={section.id} className="space-y-3 rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Section {index + 1}</p>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => setFormData(prev => ({ ...prev, receiptSections: (prev.receiptSections || []).map(item => item.id === section.id ? { ...item, order: item.order - 1 } : item).map(item => item.id === sections[index - 1]?.id ? { ...item, order: section.order } : item) }))} aria-label="Move section up"><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" disabled={index === sections.length - 1} onClick={() => setFormData(prev => ({ ...prev, receiptSections: (prev.receiptSections || []).map(item => item.id === section.id ? { ...item, order: item.order + 1 } : item).map(item => item.id === sections[index + 1]?.id ? { ...item, order: section.order } : item) }))} aria-label="Move section down"><ArrowDown className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => setFormData(prev => ({ ...prev, receiptSections: (prev.receiptSections || []).filter(item => item.id !== section.id) }))} aria-label="Remove section"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <Input value={section.title} onChange={e => setFormData(prev => ({ ...prev, receiptSections: (prev.receiptSections || []).map(item => item.id === section.id ? { ...item, title: e.target.value } : item) }))} placeholder="Section heading" className="h-10" />
                    <Input value={section.content} onChange={e => setFormData(prev => ({ ...prev, receiptSections: (prev.receiptSections || []).map(item => item.id === section.id ? { ...item, content: e.target.value } : item) }))} placeholder="Section text shown on the receipt" className="h-10" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, receiptSections: (prev.receiptSections || []).map(item => item.id === section.id ? { ...item, enabled: !item.enabled } : item) }))} className="h-8 text-[10px]">
                      {section.enabled ? 'Visible on receipts' : 'Hidden on receipts'}
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={() => setFormData(prev => ({ ...prev, receiptSections: [...(prev.receiptSections || []), { id: `custom-${Date.now()}`, title: 'New section', content: 'Add your receipt information here', enabled: true, order: (prev.receiptSections || []).length }] }))} className="h-10 w-full border-dashed">
                  <Plus className="mr-2 h-4 w-4" /> Add receipt section
                </Button>
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
      </div>
    </FullPageEditor>
  );
}
