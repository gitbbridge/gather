import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gather | Simple Online Auctions for Nonprofits",
  description: "Launch a branded online silent auction with mobile bidding, clear winner checkout, transparent fees, and risk-free Give Holidays travel experiences.",
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
