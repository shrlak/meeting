import Link from "next/link";
import { redirect } from "next/navigation";

import LoginForm from "@/app/login/LoginForm";
import TopBar from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <>
      <TopBar />
      <main className="page-narrow">
        <h1>Welcome back</h1>
        <p className="muted">Log in to manage your availability and bookings.</p>
        <div className="card">
          <LoginForm />
        </div>
        <p className="faint" style={{ marginTop: 16, textAlign: "center" }}>
          New here? <Link href="/signup">Create your booking page</Link>
        </p>
      </main>
    </>
  );
}
