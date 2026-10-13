import type { Metadata } from "next";
import { CampaignDetail } from "@/components/campaign-detail";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: PageProps<"/brand/campaigns/[id]">) {
  const { id } = await params;
  return <CampaignDetail id={id} />;
}
