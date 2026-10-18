import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth-heading";
import { Card } from "@/components/card";
import { LoginForm } from "@/components/login-form";
import { SessionEndedNotice } from "@/components/session-ended-notice";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Log in" description="Welcome back. Pick up your campaigns or check what your posts have earned." />
      {/* Reading the query string opts this part out of static rendering; the boundary keeps the form static. */}
      <Suspense fallback={null}>
        <SessionEndedNotice />
      </Suspense>
      <Card className="mt-6">
        <LoginForm />
      </Card>
      <p className="mt-6 text-center text-muted">
        New to Meme&apos;d payouts?{" "}
        <Link href="/signup" className="font-semibold text-brand underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
