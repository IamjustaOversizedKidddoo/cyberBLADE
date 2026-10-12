import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cyberblade.dev";
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
