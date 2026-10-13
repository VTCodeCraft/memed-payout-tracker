import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/card";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <>
      <p className="text-sm font-medium lowercase text-muted">join meme&apos;d</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Create your account</h1>
      <Card className="mt-6">
        <SignupForm />
      </Card>
      <p className="mt-6 text-center">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
