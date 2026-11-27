import type { Metadata } from 'next';
import { connection } from 'next/server';
import RootLandingPage from '@/components/client/root-landing-page';

export const metadata: Metadata = {
  alternates: { canonical: 'https://www.urbanautoexpress.com/' },
};

export default async function HomePage() {
  // Render the public page on the server, including query-aware client layouts.
  await connection();
  return <RootLandingPage />;
}
