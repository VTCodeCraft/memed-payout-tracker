import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { buttonClasses } from "@/components/button";
import { PublicHeaderActions } from "@/components/public-header-actions";

export default function Home() {
  return (
    <AppShell actions={<PublicHeaderActions />}>
      <div className="my-auto">
        <p className="text-sm font-medium lowercase text-muted">
          meme&apos;d · campaign payout tracker
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
          Get paid for the views your posts earn.
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          Brands set a milestone ladder and a budget. Creators submit posts and
          unlock payouts as their views grow.
        </p>
        <Link href="/signup" className={buttonClasses("primary", "mt-8")}>
          Get started
        </Link>
      </div>
    </AppShell>
  );
}
