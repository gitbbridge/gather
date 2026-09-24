import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gather | Auctions that give back",
  description: "Discover meaningful experiences, bid for a cause, and manage your nonprofit's silent auctions.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
