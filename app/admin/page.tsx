import { requireAppUser, signOutPath } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import AdminClient from "./admin-client";
import { Toaster } from "sonner";
import { postAuthDestination } from "@/lib/auth-destination";
import { redirect } from "next/navigation";
import { Menu } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await requireAppUser("/admin");
  const destination = await postAuthDestination(user, "/admin");
  if (destination !== "/admin") redirect(destination);
  return (
    <main className="min-h-screen bg-[#f8faf9] px-4 py-5 pb-24 sm:px-5 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex items-center justify-between">
          <a
            href="/"
            className="text-2xl font-semibold tracking-tight text-[#175b47]"
          >
            gather<span className="text-[#78a68b]">.</span>
          </a>
          <div className="hidden items-center gap-4 sm:flex">
            <a
              href="/admin/security"
              className="min-h-11 content-center text-sm font-medium text-[#175b47] hover:underline"
            >
              Security
            </a>
            {isPlatformAdmin(user) && (
              <a
                href="/admin/email-templates"
                className="min-h-11 content-center text-sm font-medium text-[#175b47] hover:underline"
              >
                Email templates
              </a>
            )}
            <a
              href="/"
              className="min-h-11 content-center text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Back to auction
            </a>
            <a
              href={signOutPath("/")}
              className="min-h-11 content-center text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign out
            </a>
          </div>
          <details className="relative sm:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border bg-white px-3 text-sm font-semibold text-[#175b47]">
              <Menu size={17} /> Menu
            </summary>
            <div className="absolute right-0 z-50 mt-2 grid min-w-48 overflow-hidden rounded-xl border bg-white p-2 shadow-lg">
              <a href="/admin/security" className="rounded-lg px-3 py-3 text-sm font-medium text-[#175b47] hover:bg-[#f1f6f3]">Security</a>
              {isPlatformAdmin(user) && (
                <a href="/admin/email-templates" className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f1f6f3]">Email templates</a>
              )}
              <a href="/" className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-[#f1f6f3]">Back to auction</a>
              <a href={signOutPath("/")} className="rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-[#f1f6f3]">Sign out</a>
            </div>
          </details>
        </div>
        <AdminClient />
      </div>
      <Toaster richColors />
    </main>
  );
}
