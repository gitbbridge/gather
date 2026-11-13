"use client";

import { Check, Clipboard, FlaskConical } from "lucide-react";
import { useState } from "react";

const demoAccounts = [
  {
    role: "Nonprofit organizer",
    email: "nonprofit@giveholidays.com",
    destination: "Organizer workspace and onboarding",
  },
  {
    role: "Bidder / donor",
    email: "bidder@giveholidays.com",
    destination: "Supporter home, bidding, and My Wins",
  },
  {
    role: "Platform administrator",
    email: "admin@giveholidays.com",
    destination: "Platform and Give Holidays administration",
  },
] as const;

export function SandboxDemoAccounts({ password }: { password: string }) {
  const [copied, setCopied] = useState("");

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1500);
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#cfded5] bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b bg-[#eef5f1] px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#175b47] text-white">
          <FlaskConical size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#173d31]">Sandbox demo access</p>
          <p className="mt-1 text-xs leading-5 text-[#60736a]">
            Test-only accounts. No real payments, customer email, or travel
            fulfillment will occur.
          </p>
        </div>
        <a
          href="/testing#page-directory"
          className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[#b9cec2] bg-white px-3 text-xs font-semibold text-[#175b47] hover:bg-[#f7faf8]"
        >
          Page directory
        </a>
      </div>

      <div className="divide-y">
        {demoAccounts.map((account) => (
          <div key={account.email} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#173d31]">
                  {account.role}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {account.destination}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copy(account.email, account.email)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-[#175b47] hover:bg-[#f2f7f4]"
                aria-label={`Copy ${account.role} email`}
              >
                {copied === account.email ? <Check size={14} /> : <Clipboard size={14} />}
                {copied === account.email ? "Copied" : "Copy email"}
              </button>
            </div>
            <code className="mt-3 block overflow-x-auto rounded-lg bg-[#f5f8f6] px-3 py-2 text-xs text-[#244c3e]">
              {account.email}
            </code>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-[#fbfcfb] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#648371]">
            Shared demo password
          </p>
          <code className="mt-1 block text-sm font-semibold text-[#173d31]">
            {password}
          </code>
        </div>
        <button
          type="button"
          onClick={() => void copy(password, "password")}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[#175b47] px-4 text-xs font-semibold text-white hover:bg-[#104735]"
        >
          {copied === "password" ? <Check size={15} /> : <Clipboard size={15} />}
          {copied === "password" ? "Copied" : "Copy password"}
        </button>
      </div>
    </section>
  );
}
