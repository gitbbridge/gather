import type { Metadata } from "next";
import { SandboxIndicator } from "@/components/sandbox-indicator";
import {
  isSandboxEnvironment,
  sandboxSafetyErrors,
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
  const sandboxErrors = sandbox ? sandboxSafetyErrors() : [];

  if (sandboxErrors.length) {
    console.error("Sandbox configuration blocked:", sandboxErrors);
    return (
      <html lang="en">
        <body className="antialiased">
          <SandboxIndicator />
          <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-24">
            <section className="w-full rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                Sandbox configuration
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950">
                This test environment is safely paused.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The sandbox will remain unavailable until its isolated test configuration is complete.
              </p>
              <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-red-800">
                {sandboxErrors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </section>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        {/* Search Atlas requires this exact synchronous head script. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          {...{ nowprocket: "", "nitro-exclude": "" }}
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
