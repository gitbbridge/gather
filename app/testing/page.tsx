import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAppUser, signOutPath } from "@/lib/auth";
import {
  assertSafeSandboxEnvironment,
  isSandboxEnvironment,
  isSandboxTester,
} from "@/lib/staging";
import TestingCenterClient from "./testing-center-client";

export const dynamic = "force-dynamic";

export default async function TestingCenterPage() {
  if (!isSandboxEnvironment()) notFound();
  assertSafeSandboxEnvironment();
  const user = await requireAppUser("/testing");
  if (!isSandboxTester(user)) notFound();

  return (
    <main className="min-h-screen bg-[#f4f7f5] px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-[#175b47]">
            gather<span className="text-[#78a68b]">.</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[#65776d] sm:inline">{user.email}</span>
            <a href={signOutPath("/testing")} className="rounded-full border border-[#cfdad3] bg-white px-4 py-2 font-semibold text-[#175b47] hover:bg-[#eaf1ed]">
              Sign out
            </a>
          </div>
        </header>
        <TestingCenterClient />
      </div>
    </main>
  );
}
