import Link from "next/link";
import { redirect } from "next/navigation";

import SignupForm from "@/app/signup/SignupForm";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { APP_URL } from "@/lib/env";

export const metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <TopBar />
      <main className="page-narrow">
        <h1>Create your booking page</h1>
        <p className="muted">
          Pick a username — that becomes your public link, and people book you there.
        </p>
        <div className="card">
          <SignupForm baseUrl={APP_URL} />
        </div>
        <p className="faint" style={{ marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </main>
    </>
  );
}
