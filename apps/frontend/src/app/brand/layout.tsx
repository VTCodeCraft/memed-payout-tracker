import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SignedInLayout } from "@/components/signed-in-layout";

export const metadata: Metadata = { title: "Brand dashboard" };

export default function BrandLayout({ children }: { children: ReactNode }) {
  return <SignedInLayout role="brand">{children}</SignedInLayout>;
}
