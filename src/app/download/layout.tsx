import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download the Urban Auto Express App",
  description:
    "Get the Urban Auto Express mobile app to access services, browse the catalogue and manage your customer experience.",
  alternates: { canonical: "/download" },
  openGraph: {
    title: "Download the Urban Auto Express App",
    description:
      "Access Urban Auto Express services and your customer account from the mobile app.",
    url: "https://urbanautoexpress.com/download",
    type: "website",
  },
};

export default function DownloadLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
