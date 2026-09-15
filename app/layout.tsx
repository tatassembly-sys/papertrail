import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/site-url";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
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
            __html: JSON.stringify({
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
