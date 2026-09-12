"use client";

import { useState } from "react";

export default function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context) — the link is visible to copy by hand.
    }
  }

  return (
    <div className="copy-link">
      <code>{url.replace(/^https?:\/\//, "")}</code>
      <button className="btn btn-secondary btn-sm" onClick={copy}>
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
        Preview ↗
      </a>
    </div>
  );
}
