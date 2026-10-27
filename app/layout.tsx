import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { getSiteUrl } from "@/lib/site-url";
import { jsonLdScript } from "@/lib/json-ld";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

// Self-hosted (OFL, see app/fonts/OFL-*.txt) so builds never fetch fonts.googleapis.com.
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/fraunces-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-fraunces",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Paper Trail — Research, Translated",
    template: "%s — Paper Trail",
  },
  description:
    "Dense academic papers, translated into plain language for curious readers.",
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  openGraph: {
    siteName: "Paper Trail",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  other: {
    "theme-color": "#EEF0F2",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Avoid flash of wrong theme before React hydrates ThemeToggle */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pt-theme');if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-paper font-sans text-base leading-relaxed text-ink antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Paper Trail",
              url: getSiteUrl(),
              description:
                "Dense academic papers, translated into plain language for curious readers.",
            }),
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
        >
          Skip to content
        </a>
        <Navbar />
        <main
          id="main-content"
          className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10"
        >
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
