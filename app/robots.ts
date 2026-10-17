import type { MetadataRoute } from "next";

const flagOn = (v: string | undefined) => v === "true" || v === "1";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cyberblade.dev";
  // Closed beta: nothing is indexed (BETA_NOINDEX, default on while BETA_INVITE_ONLY).
  const noindex = process.env.BETA_NOINDEX !== undefined ? flagOn(process.env.BETA_NOINDEX) : flagOn(process.env.BETA_INVITE_ONLY);
  if (noindex) return { rules: [{ userAgent: "*", disallow: ["/"] }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/ethical-use", "/credits", "/accessibility"],
        disallow: [
          "/dashboard",
          "/learn/",
          "/labs/",
          "/exam",
          "/challenge/",
          "/auth/",
          "/session/",
          "/dev/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
