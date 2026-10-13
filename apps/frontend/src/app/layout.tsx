import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { TITLE_TEMPLATE } from "@/lib/metadata";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Meme'd Payout Tracker", template: TITLE_TEMPLATE },
  description: "Milestone-based campaign payouts for brands and creators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
