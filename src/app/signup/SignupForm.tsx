"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { guessBrowserTimezone } from "@/lib/time";

/** Turns "Spencer Kim" into a reasonable default username. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export default function SignupForm({ baseUrl }: { baseUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTimezone(guessBrowserTimezone());
  }, []);

  // Keep the username in step with the name until the user edits it directly.
  useEffect(() => {
    if (!usernameTouched) setUsername(slugify(name));
  }, [name, usernameTouched]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password, timezone }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not create your account.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const host = baseUrl.replace(/^https?:\/\//, "");

  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="username">Your booking link</label>
        <div className="input-prefix">
          <span>{host}/</span>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsernameTouched(true);
              setUsername(e.target.value.toLowerCase());
            }}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        <p className="field-hint">Lowercase letters, numbers and hyphens.</p>
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="field-hint">At least 8 characters.</p>
      </div>

      <p className="faint" style={{ marginBottom: 14 }}>
        Your timezone is set to <strong>{timezone}</strong>. You can change it later.
      </p>

      <button className="btn btn-block" type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
