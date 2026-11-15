"use client";

import { Check, ChevronDown, Clipboard, ExternalLink, FlaskConical } from "lucide-react";
import { useState } from "react";
import { sandboxPageGroups } from "@/lib/sandbox-page-directory";

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
  const [directoryOpen, setDirectoryOpen] = useState(false);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1500);
  }

  function selectAccount(email: string) {
    window.dispatchEvent(
      new CustomEvent("gather:demo-account", {
        detail: { email, password },
      }),
    );
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
        <button
          type="button"
          onClick={() => setDirectoryOpen((open) => !open)}
          aria-expanded={directoryOpen}
          aria-controls="sandbox-page-directory"
          className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-[#b9cec2] bg-white px-3 text-xs font-semibold text-[#175b47] hover:bg-[#f7faf8]"
        >
          Page directory
          <ChevronDown
            size={14}
            className={`ml-1.5 transition-transform ${directoryOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {directoryOpen ? (
        <div id="sandbox-page-directory" className="border-b bg-[#fbfcfb] px-5 py-5">
          <p className="text-sm font-semibold text-[#173d31]">Gather page directory</p>
          <p className="mt-1 text-xs leading-5 text-[#60736a]">
            Public pages open immediately. Workspace pages ask you to sign in with the matching demo account.
          </p>
          <div className="mt-4 grid gap-4">
            {sandboxPageGroups.map((group) => (
              <div key={group.title}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#648371]">
                  {group.title}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {group.links.map((link) => (
                    <a
                      key={`${link.label}-${link.href}`}
                      href={link.href}
                      className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#dce6e0] bg-white px-3 py-2 text-xs font-semibold text-[#244c3e] hover:border-[#9db9aa] hover:bg-[#f7faf8]"
                    >
                      <span>{link.label}</span>
                      <ExternalLink size={13} className="shrink-0 text-[#6f8a7c]" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
                onClick={() => selectAccount(account.email)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold text-[#175b47] hover:bg-[#f2f7f4]"
                aria-label={`Use ${account.role} demo account`}
              >
                <Check size={14} />
                Use account
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
