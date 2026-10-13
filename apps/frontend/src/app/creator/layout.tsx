import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SignedInLayout } from "@/components/signed-in-layout";

export const metadata: Metadata = { title: "Creator dashboard" };

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <SignedInLayout role="creator">{children}</SignedInLayout>;
}
