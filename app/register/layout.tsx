import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Create account",
  description: "Save papers, bookmarks, and reading history on Paper Trail.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
