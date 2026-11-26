'use client';

import Link from 'next/link';
import { ClientLayout } from '../client/layout';
import { FileText, ShieldCheck, Scale, ChevronRight, Phone, Mail } from 'lucide-react';

const documents = [
  { href: '/terms', title: 'Terms of Service', description: 'The conditions governing use of Urban Auto Express services, bookings and digital platforms.', icon: Scale },
  { href: '/privacy', title: 'Privacy Policy', description: 'How customer, employee and operational information is collected, used, stored and protected.', icon: ShieldCheck },
];

export default function LegalCentrePage() {
  return (
    <ClientLayout>
      <main className="min-h-screen bg-white">
        <section className="border-b border-zinc-100 bg-zinc-50 py-12">
          <div className="mx-auto max-w-6xl px-5 sm:px-6">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
              <Link href="/" className="inline-flex items-center"><img src="/assets/logo.png" alt="Urban Auto Express" className="h-8 w-auto object-contain" /></Link>
              <ChevronRight className="h-3 w-3" /> Legal Centre
            </div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-[#FF6A00]">Urban Auto Express · Nakuru, Kenya</p>
            <h1 className="text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">Legal Centre</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">Access the policies and terms that govern our services and explain how we handle information.</p>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-10 sm:grid-cols-2 sm:px-6">
          {documents.map(item => <Link key={item.href} href={item.href} className="group rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-sm sm:p-6"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-orange-50 text-[#FF6A00]"><item.icon className="h-5 w-5" /></div><h2 className="text-lg font-bold text-zinc-900 group-hover:text-[#FF6A00]">{item.title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{item.description}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#FF6A00]">Read document <FileText className="h-3.5 w-3.5" /></span></Link>)}
        </section>
        <section className="mx-auto max-w-6xl border-t border-zinc-100 px-5 py-8 sm:px-6">
          <h2 className="text-sm font-bold text-zinc-900">Legal and privacy enquiries</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm text-zinc-600 sm:flex-row sm:gap-8">
            <a href="mailto:mail@urbanautoexpress.com" className="inline-flex items-center gap-2 hover:text-[#FF6A00]"><Mail className="h-4 w-4 text-[#FF6A00]" />mail@urbanautoexpress.com</a>
            <a href="tel:+254785860753" className="inline-flex items-center gap-2 hover:text-[#FF6A00]"><Phone className="h-4 w-4 text-[#FF6A00]" />+254 785 860 753</a>
          </div>
        </section>
      </main>
    </ClientLayout>
  );
}
