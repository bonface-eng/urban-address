"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import type { AppView } from '@/lib/types';

interface SupportPageProps {
  view: AppView;
}

const contentMap: Record<string, { title: string; faqs: {q: string; a: string}[] }> = {
  help: {
    title: 'Help Center',
    faqs: [
      { q: "How do I deposit funds?", a: "Navigate to the Wallet page and use the Deposit form. We currently support simulated deposits only." },
      { q: "How does the AI Analyst work?", a: "The AI Analyst uses a GenAI model to analyze market data for your selected pair and provides a trade idea based on the chosen strategy." },
      { q: "Is my data secure?", a: "Yes, we prioritize security. See our Security & Safety page for more details." },
    ]
  },
  fees: {
    title: 'Fees',
    faqs: [
      { q: "What are the trading fees?", a: "We charge a 0.1% maker and 0.1% taker fee on all trades." },
      { q: "Are there deposit or withdrawal fees?", a: "There are no fees for depositing funds. Withdrawal fees depend on the network and are calculated at the time of transaction." },
    ]
  },
  api: {
    title: 'API Documentation',
    faqs: [
      { q: "How do I get an API key?", a: "API keys can be generated in your Account settings page under the API section." },
      { q: "What are the rate limits?", a: "Our public API has a rate limit of 60 requests per minute. Please contact us for increased limits." },
    ]
  },
  'security-safety': {
    title: 'Security & Safety',
    faqs: [
        { q: "Do you offer Two-Factor Authentication (2FA)?", a: "Yes, we strongly recommend enabling 2FA in your Account settings for enhanced security." },
        { q: "How are my funds stored?", a: "The majority of digital assets are held in secure, offline cold storage. This is a simulation, so no real funds are involved." },
    ]
  },
  contact: {
    title: 'Contact Us',
    faqs: [
        { q: "How can I reach support?", a: "You can email us at support@tradepilot.dev or use the live chat feature on our website." },
        { q: "What are your support hours?", a: "Our support team is available 24/7 to assist you with any issues." },
    ]
  }
};

export default function SupportPage({ view }: SupportPageProps) {
  const content = contentMap[view] || contentMap['help'];

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{content.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {content.faqs.map((faq, index) => (
              <AccordionItem value={`item-${index}`} key={index}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
