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
      <head>
        <script
          nowprocket=""
          nitro-exclude=""
          type="text/javascript"
          id="sa-dynamic-optimization"
          data-uuid="6492bd64-5a1b-4f1e-a353-0076a6c22975"
          src="https://dashboard.searchatlas.com/scripts/dynamic_optimization.js"
        ></script>
      </head>
      <body className="antialiased">
        {sandbox && <SandboxIndicator />}
        {children}
      </body>
    </html>
  );
}
