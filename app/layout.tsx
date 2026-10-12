import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/theme/SiteFooter";
import { BRAND } from "@/lib/brand";
import { PREFS_BOOT_SCRIPT } from "@/lib/theme/display-prefs";
import { fontVariables } from "@/lib/theme/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://cyberblade.dev"),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.tagline,
    url: "/",
    siteName: BRAND.name,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.name,
    description: BRAND.tagline,
  },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-[100] border-2 border-cyan bg-void px-4 py-2 font-ui text-cyan focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <div id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
