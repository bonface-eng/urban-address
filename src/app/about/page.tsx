'use client';

import React from 'react';
import { ClientLayout } from '../client/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Coffee, 
  ShoppingBag, 
  Car, 
  ShieldCheck, 
  Target, 
  Users, 
  ArrowRight,
  Globe,
  Zap,
  Gem,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function AboutPage() {
  return (
    <ClientLayout>
      <div className="flex flex-col min-h-screen bg-white">
        {/* Modern Editorial Hero - Sharp local asset with priority loading */}
        <section className="bg-zinc-900 text-white h-[70vh] min-h-[500px] overflow-hidden relative border-b border-zinc-100 flex flex-col justify-center">
          <Image 
            src="/assets/hero1.jpeg"
            alt="Urban Excellence"
            fill
            className="object-cover opacity-100"
            priority
            sizes="(max-width: 1920px) 100vw, 1920px"
          />
          {/* Subtle gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          
          <div className="max-w-7xl mx-auto px-6 relative z-10 w-full">
            <div className="max-w-4xl space-y-6">
              <h1 className="text-5xl md:text-7xl font-black font-headline uppercase tracking-tighter leading-[0.9] text-white">
                Quality <br/> Meets <span className="text-primary">Performance.</span>
              </h1>
              <p className="text-base md:text-xl text-white/90 font-bold uppercase tracking-widest leading-relaxed pt-4 border-l-4 border-primary pl-8 max-w-xl">
                Urban Express is Nakuru's premier destination for high-end hospitality and expert vehicle care.
              </p>
            </div>
          </div>
        </section>

        {/* Core Vision Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
              <div className="lg:col-span-5 space-y-10">
                <div className="space-y-4">
                  <h3 className="text-4xl md:text-5xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">
                    Better <br/> Standards.
                  </h3>
                </div>
                <div className="space-y-6 text-zinc-600 font-medium leading-relaxed text-lg">
                  <p>
                    Founded in 2024, Urban Express was created to solve a common problem: automotive services often lack the comfort and quality that customers deserve.
                  </p>
                  <p>
                    We changed that by bringing a premium lounge, a specialized auto store, and a high-tech detailing center together under one roof.
                  </p>
                </div>
              </div>
              
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-8">
                <HighlightCard 
                  icon={Globe}
                  title="Nakuru Flagship"
                  desc="Located conveniently on the main highway, we serve as the standard for quality in the region."
                />
                <HighlightCard 
                  icon={Zap}
                  title="Fast Service"
                  desc="Our systems are built for speed. We value your time and optimize every part of the process."
                />
                <HighlightCard 
                  icon={Gem}
                  title="Premium Quality"
                  desc="We use only the best products in our bar and the most advanced technology in our carwash."
                />
                <HighlightCard 
                  icon={CheckCircle2}
                  title="Expert Team"
                  desc="Our staff are trained specialists dedicated to great hospitality and car care."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Unit Breakdown */}
        <section className="py-24 bg-zinc-50 border-y border-zinc-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-24 space-y-4">
               <h2 className="text-5xl md:text-7xl font-black font-headline text-zinc-900 uppercase tracking-tighter">Our <span className="text-zinc-300">Services.</span></h2>
            </div>

            <div className="space-y-12">
               <UnitDetailRow 
                 icon={Coffee}
                 title="The Executive Lounge"
                 subtitle="Premium Hospitality"
                 image="/assets/lounge.jpg"
                 items={[
                   "Curated coffee and drink selections",
                   "High-speed fiber internet for professionals",
                   "Quiet zones for business meetings",
                   "Personalized service while you wait"
                 ]}
                 color="amber"
               />
               <UnitDetailRow 
                 icon={ShoppingBag}
                 title="Auto Accessories"
                 subtitle="Parts & Performance"
                 image="/assets/auto.png"
                 items={[
                   "Official distributor of leading global brands",
                   "Performance tires and specialized lubricants",
                   "Custom car care kits and interior accessories",
                   "Real-time stock tracking for immediate availability"
                 ]}
                 color="blue"
                 reverse
               />
               <UnitDetailRow 
                 icon={Car}
                 title="Detailing & Valet"
                 subtitle="Professional Car Care"
                 image="/assets/hero.jpeg"
                 items={[
                   "Professional machine polishing and protection",
                   "Interior steam cleaning and sanitization",
                   "Engine bay detailing and specialized washing",
                   "Doorstep pickup and return services"
                 ]}
                 color="red"
               />
            </div>
          </div>
        </section>

        {/* Our Promise Section - Converted to Zinc-50 */}
        <section className="py-24 bg-zinc-50 border-b border-zinc-100">
          <div className="max-w-7xl mx-auto px-6">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-12">
                   <div className="space-y-4">
                      <h2 className="text-5xl font-black font-headline uppercase tracking-tighter text-zinc-900">Our <br/> Commitment.</h2>
                   </div>
                   
                   <div className="grid gap-8">
                      <ValuePoint 
                        title="Total Precision" 
                        desc="Whether it's a cup of coffee or a vehicle inspection, we aim for perfection."
                      />
                      <ValuePoint 
                        title="Clear Transparency" 
                        desc="All costs and service times are clearly communicated through our digital system."
                      />
                      <ValuePoint 
                        title="Local Heritage" 
                        desc="We are proud of our Nakuru roots and reflect the city's growing sophistication."
                      />
                   </div>
                </div>
                
                <div className="p-12 bg-white rounded-3xl border border-zinc-200 shadow-2xl space-y-10 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2" />
                   
                   <div className="space-y-6 relative z-10">
                      <h4 className="text-2xl font-black font-headline uppercase tracking-tight text-primary">Join Our Community.</h4>
                      <p className="text-zinc-500 font-medium leading-relaxed">
                        Become part of Nakuru's exclusive circle of car enthusiasts and business leaders. Our rewards program gives you priority access and special member benefits.
                      </p>
                   </div>
                   <div className="grid grid-cols-2 gap-8 relative z-10">
                      <div>
                         <p className="text-4xl font-black font-headline text-zinc-900">100%</p>
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Quality Score</p>
                      </div>
                      <div>
                         <p className="text-4xl font-black font-headline text-zinc-900">24/7</p>
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Support Available</p>
                      </div>
                   </div>
                   <Button asChild className="h-16 px-10 bg-primary text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl w-full shadow-2xl hover:bg-orange-600 transition-all relative z-10">
                      <Link href="/signup">Create an Account <ArrowRight className="ml-3 w-4 h-4" /></Link>
                   </Button>
                </div>
             </div>
          </div>
        </section>

        {/* Final Visit Section */}
        <section className="py-32 text-center bg-white">
          <div className="max-w-4xl mx-auto px-6 space-y-12">
            <h2 className="text-5xl md:text-8xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">
              Visit Us <br/> <span className="text-primary">Today.</span>
            </h2>
            <p className="text-lg text-zinc-400 font-bold uppercase tracking-[0.3em] leading-relaxed">
              Find us on the main Nakuru highway and experience a better way to do business.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-8">
              <Button asChild className="h-16 px-14 bg-zinc-900 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl shadow-xl hover:bg-zinc-800 transition-all active:scale-95">
                <Link href="/contact">Customer Support</Link>
              </Button>
              <Button asChild variant="outline" className="h-16 px-14 border-zinc-200 text-zinc-900 font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl hover:bg-zinc-50 shadow-sm transition-all active:scale-95">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </ClientLayout>
  );
}

function HighlightCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100 hover:border-primary/20 transition-all group">
      <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-zinc-400 group-hover:bg-primary group-hover:text-white transition-all mb-6">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-lg font-black font-headline uppercase text-zinc-900 tracking-tight mb-2">{title}</h4>
      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">{desc}</p>
    </div>
  );
}

function ValuePoint({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-2 border-l-2 border-zinc-200 pl-6 group hover:border-primary transition-colors">
       <h4 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900 group-hover:text-primary transition-colors">{title}</h4>
       <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">{desc}</p>
    </div>
  );
}

function UnitDetailRow({ icon: Icon, title, subtitle, items, color, reverse, image }: any) {
  const colorMap: any = {
    amber: "bg-amber-500/10 text-amber-500",
    blue: "bg-blue-600/10 text-blue-600",
    red: "bg-primary/10 text-primary"
  };

  return (
    <div className={cn("flex flex-col lg:flex-row gap-12 items-center", reverse && "lg:flex-row-reverse")}>
       <div className="flex-1 space-y-8">
          <div className="space-y-3">
             <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center mb-6", colorMap[color])}>
                <Icon className="w-7 h-7" />
             </div>
             <h4 className="text-3xl font-black font-headline uppercase tracking-tighter text-zinc-900">{title}</h4>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">{subtitle}</p>
          </div>
          <ul className="space-y-4">
             {items.map((item: string, i: number) => (
               <li key={i} className="flex items-start gap-4 text-zinc-500 text-sm font-bold uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>{item}</span>
               </li>
             ))}
          </ul>
       </div>
       <div className="flex-1 w-full bg-white rounded-3xl p-1 shadow-mobile overflow-hidden border border-zinc-100">
          <div className="bg-zinc-50 h-[350px] w-full rounded-2xl flex items-center justify-center group cursor-pointer relative overflow-hidden">
             {image ? (
               <Image 
                 src={image} 
                 alt={title} 
                 fill 
                 className="object-cover group-hover:scale-105 transition-transform duration-700" 
               />
             ) : (
               <Icon className="w-16 h-16 text-zinc-200 group-hover:scale-110 transition-transform duration-700" />
             )}
             <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
             <div className="absolute bottom-10 left-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <Badge className="bg-zinc-900 text-white font-black uppercase text-[8px] tracking-widest px-4 py-1">View Department</Badge>
             </div>
          </div>
       </div>
    </div>
  );
}
