import type { Metadata } from "next";
import { CreatorEarnings } from "@/components/creator-earnings";

export const metadata: Metadata = { title: "My earnings" };

export default function CreatorEarningsPage() {
  return <CreatorEarnings />;
}
