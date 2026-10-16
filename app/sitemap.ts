import type { MetadataRoute } from "next";

const flagOn = (v: string | undefined) => v === "true" || v === "1";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cyberblade.dev";
  const now = new Date();
  // Closed beta: empty sitemap while noindex is on (same rule as robots.ts and the proxy header).
  const noindex = process.env.BETA_NOINDEX !== undefined ? flagOn(process.env.BETA_NOINDEX) : flagOn(process.env.BETA_INVITE_ONLY);
  if (noindex) return [];
  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/legal/ethical-use`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/credits`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/accessibility`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
