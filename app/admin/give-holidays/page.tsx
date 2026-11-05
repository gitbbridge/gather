import { Leaf, LockKeyhole } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import CatalogAdminClient from "./catalog-admin-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Give Holidays catalog | Gather" };

export default async function GiveHolidaysAdminPage() {
  const user = await requireAppUser("/admin/give-holidays");
  if (!isPlatformAdmin(user)) {
    return (
      <main className="min-h-screen bg-[#f8faf9] px-5 py-12">
        <div className="mx-auto max-w-xl">
          <a
            href="/"
            className="flex items-center gap-2 text-2xl font-semibold text-[#175b47]"
          >
            <Leaf size={22} />
            gather<span className="text-[#78a68b]">.</span>
          </a>
          <section className="mt-12 rounded-2xl border bg-white p-8 shadow-sm">
            <LockKeyhole className="text-[#175b47]" />
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">
              Platform admin access required
            </h1>
            <p className="mt-3 leading-7 text-muted-foreground">
              This catalog controls package cost, markup, availability, and
              fulfillment terms across every nonprofit. Add your signed-in email
              to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                PLATFORM_ADMIN_EMAILS
              </code>
              , restart Gather, and return here.
            </p>
            <p className="mt-5 rounded-lg bg-[#f5f8f6] p-3 text-sm">
              Signed in as <strong>{user.email}</strong>
            </p>
            <a
              href="/admin"
              className="mt-6 inline-flex text-sm font-semibold text-[#175b47]"
            >
              Return to auction dashboard →
            </a>
          </section>
        </div>
      </main>
    );
  }
  return (
    <>
      <div className="fixed right-5 top-5 z-50 flex gap-2">
        <a
          href="/admin/give-holidays/fulfillments"
          className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-[#175b47] shadow-sm"
        >
          Auction fulfillment
        </a>
        <a
          href="/admin/give-holidays/direct-fulfillments"
          className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-[#175b47] shadow-sm"
        >
          Direct-offer concierge
        </a>
      </div>
      <CatalogAdminClient />
    </>
  );
}
