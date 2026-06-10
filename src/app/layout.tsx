import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketing Task Tracker",
  description: "Track marketing tasks with manual + email-based updates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes onto <body> after SSR, causing a harmless hydration
          mismatch. This suppresses only that body-attribute noise. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
