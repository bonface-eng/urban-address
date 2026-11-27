'use client';

import React, { useState } from 'react';
import ClientLayout from '../client/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MapPin, Phone, MessageSquare, Send, CheckCircle2, RefreshCcw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useDb } from '@/lib/data';
import { collection, addDoc } from '@/lib/db';

export default function ContactPage() {
  const firestore = useDb();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSuccess] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    
    setIsSubmitting(true);
    
    try {
      // Persist Inquiry
      await addDoc(collection(firestore, 'support_queries'), {
        name,
        email,
        subject,
        message,
        status: 'NEW',
        timestamp: Date.now(),
        source: 'WEB_CONTACT_FORM'
      });

      setIsSuccess(true);
      toast({
        title: "Inquiry Dispatched",
        description: "Your request has been synchronized with our support center."
      });
      
      // Reset form
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Transmission Failed",
        description: "Could not connect to the support server. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ClientLayout>
      <div className="flex flex-col min-h-screen">
        {/* Header Section */}
        <section className="bg-zinc-50 border-b border-zinc-100 py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-5xl md:text-8xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">
                Contact <br/> <span className="text-primary">Support.</span>
              </h1>
              <p className="text-lg text-zinc-500 font-bold uppercase tracking-widest leading-relaxed pt-2">
                Have a special request or need help? Our team is ready to assist you with any questions about our services.
              </p>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
              
              {/* Contact Info Column */}
              <div className="lg:col-span-4 space-y-12">
                 <div className="space-y-10">
                    <ContactInfoBlock 
                      icon={MapPin}
                      label="Location"
                      value="Main Highway, Nakuru, Kenya"
                    />
                    
                    <div className="flex items-start gap-6 group">
                       <div className="w-14 h-14 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <Mail className="w-6 h-6" />
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email Us</p>
                          <div className="flex flex-col gap-1">
                             <a href="mailto:info@urbanautoexpress.com" className="text-sm font-bold text-zinc-900 lowercase tracking-tight leading-relaxed hover:text-primary transition-colors">info@urbanautoexpress.com</a>
                             <a href="mailto:support@urbanautoexpress.com" className="text-sm font-bold text-zinc-900 lowercase tracking-tight leading-relaxed hover:text-primary transition-colors">support@urbanautoexpress.com</a>
                          </div>
                       </div>
                    </div>

                    <a href="tel:0785860753" className="flex items-start gap-6 group">
                       <div className="w-14 h-14 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <Phone className="w-6 h-6" />
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Direct Line</p>
                          <p className="text-lg font-black text-zinc-900 uppercase tracking-tighter leading-none pt-1">0785860753</p>
                       </div>
                    </a>
                 </div>

                 <div className="p-10 bg-zinc-50 rounded-3xl border border-zinc-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-4">Opening Hours</h4>
                    <div className="space-y-3">
                       <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">Mon — Sat: 8:00 AM - 9:00 PM</p>
                       <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">Sun: 10:00 AM - 6:00 PM</p>
                    </div>
                 </div>
              </div>

              {/* Form Column */}
              <div className="lg:col-span-8">
                {isSent ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 bg-zinc-50 rounded-3xl text-center space-y-6 border border-zinc-100 animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center text-green-500 shadow-xl shadow-green-100">
                       <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-3xl font-black font-headline uppercase tracking-tighter">Inquiry Logged</h3>
                       <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Our support center has received your request.</p>
                    </div>
                    <Button onClick={() => setIsSuccess(false)} variant="outline" className="rounded-xl border-zinc-200 uppercase font-black text-[10px] tracking-widest px-8 h-12">
                       Send Another Request
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-8 bg-white p-1 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Full Name</Label>
                        <input 
                          placeholder="Your name" 
                          value={name}
                          onChange={e => setName(e.target.value)}
                          className="h-16 w-full bg-zinc-50 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Email Address</Label>
                        <input 
                          type="email"
                          placeholder="name@example.com" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="h-16 w-full bg-zinc-50 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Subject</Label>
                      <input 
                        placeholder="What can we help you with?" 
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        className="h-16 w-full bg-zinc-50 border-none rounded-2xl px-6 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">Your Message</Label>
                      <textarea 
                        placeholder="Tell us more about your request..." 
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        className="min-h-[200px] w-full bg-zinc-50 border-none rounded-3xl p-8 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                        required
                      />
                    </div>

                    <div className="space-y-6">
                      <Button 
                        disabled={isSubmitting}
                        className="w-full h-20 bg-zinc-900 hover:bg-zinc-800 text-white rounded-3xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl transition-transform active:scale-95 flex items-center justify-center gap-4"
                      >
                        {isSubmitting ? <RefreshCcw className="w-5 h-5 animate-spin" /> : (
                          <>
                            <Send className="w-5 h-5 text-primary" /> Dispatch Inquiry
                          </>
                        )}
                      </Button>

                      <div className="text-center px-4">
                         
                      </div>
                    </div>
                  </form>
                )}
              </div>

            </div>
          </div>
        </section>
      </div>
    </ClientLayout>
  );
}

function ContactInfoBlock({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-6 group">
       <div className="w-14 h-14 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
          <Icon className="w-6 h-6" />
       </div>
       <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
          <p className="text-sm font-bold text-zinc-900 uppercase tracking-tight leading-relaxed">{value}</p>
       </div>
    </div>
  );
}