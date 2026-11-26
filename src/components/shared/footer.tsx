"use client";

import React from "react";
import Link from "next/link";
import { SYSTEM_CONFIG } from "@/lib/config";
import {
  Coffee,
  ShoppingBag,
  Car,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  ArrowUpRight,
  Globe,
} from "lucide-react";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.353-.883-.788-1.48-1.76-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.131.57-.074 1.758-.706 2.006-1.388.248-.682.248-1.265.174-1.388-.074-.124-.272-.198-.57-.347m-4.821 7.454c-1.679 0-3.325-.43-4.767-1.245l-.342-.192-3.542.928.943-3.454-.21-.334c-.896-1.428-1.371-3.085-1.371-4.783 0-4.834 3.931-8.765 8.765-8.765 2.342 0 4.545.912 6.199 2.567s2.567 3.857 2.567 6.199c0 4.835-3.931 8.765-8.765 8.765m8.191-17.032c-2.188-2.187-5.1-3.392-8.191-3.392-6.38 0-11.57 5.19-11.57 11.57 0 2.04.532 4.032 1.542 5.795l-1.639 5.986 6.126-1.606c1.71 1.037 3.684-1.585 5.541 1.585 6.38 0 11.57-5.19 11.57-11.57 0-3.091-1.205-5.992-3.391-8.179" />
  </svg>
);

const departmentLinks = [
  { href: "/client/lounge", label: "Executive Lounge", icon: Coffee },
  { href: "/client/store", label: "Auto Accessories", icon: ShoppingBag },
  { href: "/client/carwash", label: "Car Wash & Detailing", icon: Car },
];

const supportLinks = [
  { href: "/about", label: "Our Story" },
  { href: "/contact", label: "Contact Support" },
  { href: "/download", label: "Mobile App", icon: Smartphone },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
];

export function Footer() {
  return (
    <footer className="relative mt-0 border-t-[3px] border-primary bg-[#F8F6F2] text-zinc-800">
      <div className="mx-auto max-w-7xl px-5 pb-7 pt-12 sm:px-8 sm:pt-14 lg:px-12 lg:pt-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr] lg:gap-12">
          <div className="space-y-5">
            <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Urban Auto Express home">
              <img
                src="/assets/logo.png"
                alt={SYSTEM_CONFIG.BUSINESS.NAME}
                className="h-11 w-auto max-w-[190px] object-contain object-left"
              />
            </Link>
            <p className="max-w-sm text-sm leading-6 text-zinc-600">
              Your destination for professional vehicle care, automotive essentials and welcoming hospitality in Nakuru.
            </p>
            <div className="inline-flex items-center gap-2 border-l-2 border-primary pl-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-zinc-700">
              Care for the journey. Comfort for the pause.
            </div>
          </div>

          <FooterColumn title="Our departments">
            {departmentLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group inline-flex min-h-11 items-center gap-3 text-sm text-zinc-600 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <Icon className="h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Customer support">
            {supportLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className="group inline-flex min-h-11 items-center gap-3 text-sm text-zinc-600 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" /> : <span className="h-1 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />}
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </FooterColumn>

          <div className="space-y-5">
            <h3 className="text-[10px] font-black uppercase tracking-[.22em] text-zinc-900">Visit & contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm leading-6 text-zinc-600">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>Main Highway, Naka Center<br />Nakuru, Kenya</span>
              </li>
              <li>
                <a href="tel:+254785860753" className="inline-flex min-h-11 items-center gap-3 text-sm text-zinc-700 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>+254 785 860 753</span>
                </a>
              </li>
              <li>
                <a href="mailto:info@urbanautoexpress.com" className="inline-flex min-h-11 items-center gap-3 break-all text-sm text-zinc-700 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>info@urbanautoexpress.com</span>
                </a>
              </li>
              <li>
                <a href="https://urbanaddress.com" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-3 text-sm text-zinc-700 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <Globe className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>urbanaddress.com</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a href="https://wa.me/254785860753" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-[#167C45] transition-colors hover:text-[#105D34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <WhatsAppIcon className="h-4 w-4 shrink-0" />
                  <span>Chat with us on WhatsApp</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-[#E5DCD1] pt-6 sm:mt-12 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-medium leading-5 text-zinc-500">
            © {new Date().getFullYear()} Urban Express Engineering. All rights reserved.
          </p>
          <nav aria-label="Legal links" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/terms" className="inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Terms & Conditions</Link>
            <Link href="/privacy" className="inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[.12em] text-zinc-500 transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Privacy Policy</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-black uppercase tracking-[.22em] text-zinc-900">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}
