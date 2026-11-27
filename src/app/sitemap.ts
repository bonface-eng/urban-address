import type { MetadataRoute } from "next";

const siteUrl = "https://www.urbanautoexpress.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/client/lounge", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/client/store", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/client/carwash", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/download", priority: 0.6, changeFrequency: "monthly" as const },
  ];

  return publicRoutes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }));
}
