"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppView } from '@/lib/types';

interface LegalPageProps {
  view: AppView;
}

const contentMap: Record<string, { title: string; content: string[] }> = {
  terms: {
    title: 'Terms of Service',
    content: [
        "Welcome to TradePilot. This is a demonstration application and should not be used for real financial transactions.",
        "By using this application, you agree that all data is simulated and holds no real-world value. The creators are not liable for any decisions made based on the information presented.",
        "You must be of legal age in your jurisdiction to use this application, even in its simulated state."
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    content: [
        "We respect your privacy. As this is a demo, we do not collect or store any personally identifiable information beyond what is necessary for the application to function locally in your browser.",
        "We do not sell or share any data with third parties.",
    ]
  },
  cookies: {
    title: 'Cookie Policy',
    content: [
        "TradePilot uses necessary cookies to maintain your session and preferences within the application. We do not use tracking or advertising cookies.",
    ]
  },
  risk: {
    title: 'Risk Disclosure',
    content: [
        "Trading financial instruments, including cryptocurrencies and forex, involves significant risk and may not be suitable for all investors. Prices can be highly volatile.",
        "This application is for educational and entertainment purposes only. The trades, profits, and losses are entirely simulated. Do not risk money that you cannot afford to lose."
    ]
  }
};

export default function LegalPage({ view }: LegalPageProps) {
  const content = contentMap[view] || contentMap['terms'];

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{content.title}</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none">
            {content.content.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
