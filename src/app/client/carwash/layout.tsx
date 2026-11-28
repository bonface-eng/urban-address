import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Car Wash & Vehicle Detailing Catalog & Pricing in Nakuru",
  description:
    "Browse Urban Auto Express car wash, interior detailing, exterior protection, restoration, and engine service prices in KES, and book your visit in Nakuru.",
  alternates: { canonical: "/client/carwash" },
  openGraph: {
    title: "Car Wash & Vehicle Detailing Catalog | Urban Auto Express",
    description:
      "Transparent KES pricing for car wash, interior, exterior protection, restoration, and engine detailing services in Nakuru, Kenya.",
    url: "https://urbanautoexpress.com/client/carwash",
    type: "website",
  },
};

export default function CarwashLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
