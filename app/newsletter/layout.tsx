import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Weekly digest of Paper Trail notes: newest, trending, and editor picks.",
};

export default function NewsletterLayout({ children }: { children: ReactNode }) {
  return children;
}
