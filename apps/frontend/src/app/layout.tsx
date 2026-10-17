import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { TITLE_TEMPLATE } from "@/lib/metadata";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "Brands fund campaigns with a budget and a ladder of view milestones. Creators submit Instagram and YouTube posts and earn the highest milestone their views reach.";

// The Open Graph image comes from app/opengraph-image.tsx. On Vercel, Next.js makes its URL
// absolute with the production domain, so no metadataBase is needed.
export const metadata: Metadata = {
  title: { default: "Meme'd Payout Tracker", template: TITLE_TEMPLATE },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Meme'd Payout Tracker",
    title: "Meme'd Payout Tracker",
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
