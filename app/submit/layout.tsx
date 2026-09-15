import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Suggest a paper",
  description: "Send a paper URL for the Paper Trail editors to review.",
};

export default function SubmitLayout({ children }: { children: ReactNode }) {
  return children;
}
