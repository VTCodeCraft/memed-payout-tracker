"use client";

import { useSignedInSession } from "@/lib/signed-in";

// Interim home until the earnings dashboard is built.
export default function CreatorHome() {
  const { user } = useSignedInSession();

  return (
    <>
      <p className="text-sm font-medium lowercase text-muted">creator dashboard</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Welcome, {user.name}</h1>
      <p className="mt-3 max-w-xl text-muted">
        You&apos;re signed in as a creator. Live campaigns and your earnings will appear here.
      </p>
    </>
  );
}
