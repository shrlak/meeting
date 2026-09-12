import Link from "next/link";

import LogoutButton from "@/components/LogoutButton";

export default function TopBar({
  user,
}: {
  user?: { name: string; username: string } | null;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            M
          </span>
          Meeting
        </Link>

        <nav className="row">
          {user ? (
            <>
              <Link className="btn btn-ghost btn-sm" href={`/${user.username}`}>
                View my page
              </Link>
              <Link className="btn btn-ghost btn-sm" href="/dashboard">
                Dashboard
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" href="/login">
                Log in
              </Link>
              <Link className="btn btn-sm" href="/signup">
                Create your page
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
