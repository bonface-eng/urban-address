import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Car Wash & Vehicle Detailing in Nakuru",
  description:
    "Explore Urban Auto Express car wash and vehicle detailing services in Nakuru, Kenya. Review available services and arrange your next visit.",
  alternates: { canonical: "/client/carwash" },
  openGraph: {
    title: "Car Wash & Vehicle Detailing | Urban Auto Express",
    description:
      "Professional car wash and vehicle detailing services in Nakuru, Kenya.",
    url: "https://urbanautoexpress.com/client/carwash",
    type: "website",
  },
};

export default function CarwashLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
