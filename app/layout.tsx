import type { Metadata } from "next";
import { SandboxIndicator } from "@/components/sandbox-indicator";
import {
  assertSafeSandboxEnvironment,
  isSandboxEnvironment,
} from "@/lib/staging";
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
  const sandbox = isSandboxEnvironment();
  if (sandbox) assertSafeSandboxEnvironment();

  return (
    <html lang="en">
      <body className="antialiased">
        {sandbox && <SandboxIndicator />}
        {children}
      </body>
    </html>
  );
}
