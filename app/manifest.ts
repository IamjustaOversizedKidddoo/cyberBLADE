import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: "CyberBLADE",
    description: "Cinematic, hands-on cybersecurity training range for tactical certifications.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070a",
    theme_color: "#0fbeff",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
