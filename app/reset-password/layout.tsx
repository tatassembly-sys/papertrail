import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetLayout({ children }: { children: ReactNode }) {
  return children;
}
