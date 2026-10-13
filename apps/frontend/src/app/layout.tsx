import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Pages set their own title; every tab still names the app ("Log in · Meme'd Payout Tracker").
  title: { default: "Meme'd Payout Tracker", template: "%s · Meme'd Payout Tracker" },
  description: "Milestone-based campaign payouts for brands and creators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
