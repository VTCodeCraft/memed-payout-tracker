import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SignedInLayout } from "@/components/signed-in-layout";
import { TITLE_TEMPLATE } from "@/lib/metadata";

export const metadata: Metadata = { title: { default: "Creator dashboard", template: TITLE_TEMPLATE } };

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <SignedInLayout role="creator">{children}</SignedInLayout>;
}
