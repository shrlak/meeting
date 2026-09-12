import Link from "next/link";

import TopBar from "@/components/TopBar";

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="page-narrow" style={{ textAlign: "center" }}>
        <h1>Nothing here</h1>
        <p className="muted">
          That booking page doesn&apos;t exist. Check the link, or create your own page.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/signup">
            Create a booking page
          </Link>
          <Link className="btn btn-secondary" href="/">
            Back home
          </Link>
        </div>
      </main>
    </>
  );
}
