import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <AppShell>
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
      </div>
    </AppShell>
  );
}
