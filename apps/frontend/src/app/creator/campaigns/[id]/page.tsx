import type { Metadata } from "next";
import { CreatorCampaign } from "@/components/creator-campaign";

export const metadata: Metadata = { title: "Campaign" };

export default async function CreatorCampaignPage({ params }: PageProps<"/creator/campaigns/[id]">) {
  const { id } = await params;
  return <CreatorCampaign id={id} />;
}
