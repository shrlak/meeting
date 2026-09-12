import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Meeting — your own booking page",
    template: "%s · Meeting",
  },
  description:
    "Share one link, let people book time that actually works for you, and get a Google Calendar invite sent to everyone automatically.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
