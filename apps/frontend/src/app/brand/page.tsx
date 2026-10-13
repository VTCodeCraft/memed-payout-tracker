"use client";

import { useSignedInSession } from "@/components/signed-in-layout";

// Interim home until the campaign dashboard is built.
export default function BrandHome() {
  const { user } = useSignedInSession();

  return (
    <>
      <p className="text-sm font-medium lowercase text-muted">brand dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Welcome, {user.name}</h1>
      <p className="mt-3 max-w-xl text-muted">You&apos;re signed in as a brand. Campaign tools will appear here.</p>
    </>
  );
}
