import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "@/components/auth-heading";
import { Card } from "@/components/card";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <AuthHeading
        title="Create your account"
        description="Brands fund campaigns with milestone payouts. Creators earn as their posts' views grow."
      />
      <Card className="mt-6">
        <SignupForm />
      </Card>
      <p className="mt-6 text-center text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
