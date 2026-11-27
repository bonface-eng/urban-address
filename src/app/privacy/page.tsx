'use client';

import React from 'react';
import ClientLayout from '../client/layout';
import { ChevronRight, ShieldCheck, Lock, Eye, Gavel, Cookie } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  const sections = [
    { 
      title: "1. Data Collection", 
      icon: Eye,
      content: "Urban Auto Express collects essential information to facilitate your service bookings and reward tracking. This includes your name, contact phone number, vehicle details, and transaction history. We do not store sensitive payment information on our servers; all financial processing is handled by PCI-compliant partners like Paystack." 
    },
    { 
      title: "2. Purpose of Processing", 
      icon: ShieldCheck,
      content: "Your data is used strictly for operational synchronization: notifying you of service completion, providing digital receipts, and managing the 10th-visit loyalty rewards program. We use localized geofencing to ensure our systems are accessed from authorized nodes, protecting both your data and our business integrity." 
    },
    { 
      title: "3. Information Sharing", 
      icon: Lock,
      content: "Urban Auto Express does not sell, rent, or trade user data to third parties. Information is only shared with authorized employees (Administrators, Managers, and assigned Attendants) for the specific fulfillment of your service request." 
    },
    { 
      title: "4. Digital Security", 
      icon: Gavel,
      content: "Our 'Business OS' utilizes industry-standard encryption and Firebase security protocols. Every staff action is logged to an immutable audit trail, and we enforce a zero-trust model for all financial and personnel records." 
    },
    {
      title: "5. Cookie Preferences",
      icon: Cookie,
      content: "Essential storage technologies support security, sessions and core platform functions and cannot be disabled. Analytics preferences cover usage and performance measurement. Marketing preferences cover campaign measurement. Optional categories remain disabled unless you choose to allow them. Your category choices are saved against a browser-specific reference so they can be honoured and updated later using Cookie settings."
    }
  ];

  return (
    <ClientLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-zinc-50 border-b border-zinc-100 py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">
              <Link href="/" className="mr-3 inline-flex items-center"><img src="/assets/logo.png" alt="Urban Auto Express" className="h-8 w-auto object-contain" /></Link><Link href="/" className="hover:text-primary transition-colors">HOME</Link> <ChevronRight className="w-2.5 h-2.5" /> <span className="text-primary">PRIVACY</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">
              Privacy <br/> <span className="text-primary">Policy.</span>
            </h1>
            <p className="text-lg text-zinc-500 font-bold uppercase tracking-widest mt-6 max-w-2xl">
              How we protect your identity and ensure the security of your automotive and hospitality records.
            </p>
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6 space-y-20">
             {sections.map((section, index) => (
               <div key={index} className="flex flex-col md:flex-row gap-8 items-start group">
                  <div className="w-14 h-14 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-primary group-hover:text-white transition-all shadow-inner border border-zinc-100 shrink-0">
                     <section.icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-4">
                     <h3 className="text-xl font-black uppercase text-zinc-900 tracking-tight group-hover:text-primary transition-colors">
                        {section.title}
                     </h3>
                     <p className="text-sm text-zinc-500 font-medium leading-relaxed uppercase tracking-tight">
                        {section.content}
                     </p>
                  </div>
               </div>
             ))}

             <div className="pt-12 border-t border-zinc-100 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                   <Lock className="w-8 h-8" />
                </div>
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em]">
                  Urban Auto Express · Data Protection Protocol v2.5
                </p>
             </div>
             <div className="border-t border-zinc-100 pt-8 text-center text-xs text-zinc-500">
               <p>Privacy enquiries: <a className="font-semibold text-primary" href="mailto:mail@urbanautoexpress.com">mail@urbanautoexpress.com</a> · <a className="font-semibold text-primary" href="tel:+254785860753">+254 785 860 753</a></p>
               <p className="mt-3"><Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> · <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></p>
             </div>
          </div>
        </section>
      </div>
    </ClientLayout>
  );
}
