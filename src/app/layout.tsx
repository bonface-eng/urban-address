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
import Script from 'next/script';

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: '--font-space' });

export const metadata: Metadata = {
  title: {
    default: "Urban Auto Express",
    template: "%s | Urban Auto Express",
  },
  description: "Premium Lounge, Shop & Detailing Service in Nakuru, Kenya.",
  metadataBase: new URL('https://www.urbanautoexpress.com'),
  icons: {
    icon: [
      { url: '/assets/pwa.png', type: 'image/png' },
    ],
    shortcut: '/assets/pwa.png',
    apple: [
      { url: '/assets/pwa.png', sizes: '180x180', type: 'image/png' },
    ],
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
        {/* reCAPTCHA Enterprise Script */}
        <Script 
          src={`https://www.google.com/recaptcha/enterprise.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
          strategy="beforeInteractive"
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
