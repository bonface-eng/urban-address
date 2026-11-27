"use client";

import React from 'react';
import Link from 'next/link';
import { SYSTEM_CONFIG } from "@/lib/config";
import { Coffee, ShoppingBag, Car, ShieldCheck, Mail, MapPin, Phone, Smartphone } from 'lucide-react';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.76-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.131.57-.074 1.758-.706 2.006-1.388.248-.682.248-1.265.174-1.388-.074-.124-.272-.198-.57-.347m-4.821 7.454c-1.679 0-3.325-.43-4.767-1.245l-.342-.192-3.542.928.943-3.454-.21-.334c-.896-1.428-1.371-3.085-1.371-4.783 0-4.834 3.931-8.765 8.765-8.765 2.342 0 4.545.912 6.199 2.567s2.567 3.857 2.567 6.199c0 4.835-3.931 8.765-8.765 8.765m8.191-17.032c-2.188-2.187-5.1-3.392-8.191-3.392-6.38 0-11.57 5.19-11.57 11.57 0 2.04.532 4.032 1.542 5.795l-1.639 5.986 6.126-1.606c1.71 1.037 3.684-1.585 5.541 1.585 6.38 0 11.57-5.19 11.57-11.57 0-3.091-1.205-5.992-3.391-8.179"/>
  </svg>
);

export function Footer() {
  return (
    <footer className="bg-zinc-50 border-t border-zinc-100 mt-0">
      <div className="max-w-7xl mx-auto px-6 py-10 md:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 lg:gap-8">
          {/* Brand Column - Spans 2 on mobile for readability */}
          <div className="col-span-2 lg:col-span-1 space-y-6">
            <Link href="/" className="inline-block">
              <img 
                src="/assets/logo.png" 
                alt={SYSTEM_CONFIG.BUSINESS.NAME} 
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed max-w-xs">
              Nakuru's premier destination for high-end hospitality and expert vehicle care. Driven by precision.
            </p>
            <div className="flex items-center gap-4">
               <div className="w-8 h-8 rounded-lg bg-white border border-zinc-100 flex items-center justify-center text-primary shadow-sm">
                  <ShieldCheck className="w-4 h-4" />
               </div>
               <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-900">Official Flagship</span>
            </div>
          </div>

          {/* Services Column - Side by side on mobile */}
          <div className="col-span-1 space-y-6">
            <h3 className="text-10px font-black uppercase tracking-[0.3em] text-zinc-900">Departments</h3>
            <ul className="space-y-4">
              <FooterLink href="/client/lounge" icon={Coffee} label="Executive Lounge" />
              <FooterLink href="/client/store" icon={ShoppingBag} label="Auto Accessories" />
              <FooterLink href="/client/carwash" icon={Car} label="Detailing & Valet" />
            </ul>
          </div>

          {/* Support Column - Side by side on mobile */}
          <div className="col-span-1 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">Concierge</h3>
            <ul className="space-y-4">
              <FooterLink href="/about" label="Our Story" />
              <FooterLink href="/contact" label="Contact Support" />
              <FooterLink href="/download" icon={Smartphone} label="Mobile App" />
              <FooterLink href="/privacy" label="Privacy Policy" />
            </ul>
          </div>

          {/* Contact Column - Spans 2 on mobile to avoid squishing details */}
          <div className="col-span-2 lg:col-span-1 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-900">HQ Location</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-tight leading-relaxed">
                  Main Highway, Naka Center<br/>Nakuru, Kenya
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <p className="text-[11px] font-bold text-zinc-900 uppercase tracking-widest">0785860753</p>
              </div>
              <a 
                href="https://wa.me/254785860753" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 group/wa"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366] group-hover/wa:scale-110 transition-transform" />
                <p className="text-[11px] font-bold text-[#25D366] uppercase tracking-widest group-hover/wa:underline">WhatsApp Us</p>
              </a>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <p className="text-[11px] font-bold text-zinc-500 lowercase tracking-tight">info@urbanautoexpress.com</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.4em]">
            © {new Date().getFullYear()} Urban Express Engineering • All Rights Reserved
          </p>
          <div className="flex items-center gap-8">
            <Link href="/terms" className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em] hover:text-primary transition-colors">Terms</Link>
            <Link href="/privacy" className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em] hover:text-primary transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, label, icon: Icon }: { href: string; label: string; icon?: any }) {
  return (
    <li>
      <Link 
        href={href} 
        className="group flex items-center gap-3 text-zinc-500 hover:text-primary transition-all"
      >
        {Icon && <Icon className="w-3.5 h-3.5 opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all" />}
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
      </Link>
    </li>
  );
}
