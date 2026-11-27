import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { FirebaseClientProvider } from "@/firebase";
import { Toaster } from "@/components/ui/toaster";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileProvider } from "@/hooks/use-profile";
import { CartProvider } from "@/hooks/use-cart";
import { TerminalProvider } from "@/hooks/use-terminal";
import { KeyboardCommands } from "@/components/shared/keyboard-commands";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { PWAPrompt } from "@/components/shared/pwa-prompt";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: '--font-space' });
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();

const businessStructuredData = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "AutomotiveBusiness"],
  "@id": "https://urbanautoexpress.com/#urban-auto-express",
  name: "Urban Auto Express",
  url: "https://urbanautoexpress.com/",
  sameAs: ["https://share.google/ZdWo21gYJtZTMMqSz"],
  telephone: "+254785860753",
  description:
    "Urban Auto Express is a car wash and automotive care business in Nakuru, Kenya, with auto accessories and customer lounge services.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Nakuru",
    addressCountry: "KE",
  },
  areaServed: {
    "@type": "City",
    name: "Nakuru",
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "06:30",
      closes: "23:00",
    },
  ],
  knowsAbout: [
    "Car washing",
    "Automotive care",
    "Auto accessories",
    "Customer lounge services",
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://urbanautoexpress.com"),
  applicationName: "Urban Auto Express",
  title: {
    default: "Urban Auto Express | Car Wash, Auto Accessories & Lounge in Nakuru",
    template: "%s | Urban Auto Express",
  },
  description:
    "Discover Urban Auto Express in Nakuru, Kenya. Explore professional car wash and vehicle detailing, quality auto accessories, and our customer lounge.",
  keywords: [
    "Urban Auto Express",
    "car wash Nakuru",
    "car detailing Nakuru",
    "auto accessories Nakuru",
    "car care Kenya",
    "vehicle detailing Kenya",
    "lounge Nakuru",
  ],
  category: "automotive",
  openGraph: {
    type: "website",
    url: "https://urbanautoexpress.com/",
    siteName: "Urban Auto Express",
    title: "Urban Auto Express | Car Wash, Auto Accessories & Lounge in Nakuru",
    description:
      "Professional vehicle care, auto accessories and a welcoming customer lounge in Nakuru, Kenya.",
    locale: "en_KE",
    images: [
      {
        url: "/assets/hero3.png",
        width: 1200,
        height: 630,
        alt: "Urban Auto Express vehicle detailing services in Nakuru",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Urban Auto Express | Nakuru, Kenya",
    description:
      "Vehicle detailing, auto accessories and customer lounge services in Nakuru, Kenya.",
    images: ["/assets/hero3.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: '/assets/pwa.png', type: 'image/png' }],
    shortcut: '/assets/pwa.png',
    apple: [{ url: '/assets/pwa.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6A00",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans bg-background text-foreground antialiased`}>
        {recaptchaSiteKey && recaptchaSiteKey !== '[SENSITIVE]' && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`}
            strategy="afterInteractive"
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(businessStructuredData).replace(/</g, "\\u003c"),
          }}
        />
        <FirebaseClientProvider>
          <ProfileProvider>
            <TerminalProvider>
              <CartProvider>
                <AppShell>
                  {children}
                  <KeyboardCommands />
                </AppShell>
                <CookieConsent />
                <PWAPrompt />
                <Toaster />
              </CartProvider>
            </TerminalProvider>
          </ProfileProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
