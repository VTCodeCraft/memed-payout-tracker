import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/card";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <p className="text-sm font-medium lowercase text-muted">welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Log in</h1>
      <Card className="mt-6">
        <LoginForm />
      </Card>
      <p className="mt-6 text-center">
        New to Meme&apos;d payouts?{" "}
        <Link href="/signup" className="font-semibold text-brand underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
