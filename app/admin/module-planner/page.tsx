import { LockKeyhole } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import ModulePlannerClient from "./module-planner-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Module Planner | Gather" };

export default async function ModulePlannerPage() {
  const user = await requireAppUser("/admin/module-planner");
  if (!isPlatformAdmin(user)) {
    return (
      <main className="min-h-screen bg-[#f4f7f5] px-5 py-12">
        <section className="mx-auto max-w-xl rounded-2xl border border-[#d8e3dc] bg-white p-8 shadow-sm">
          <LockKeyhole className="text-[#175b47]" />
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#173e32]">Platform admin access required</h1>
          <p className="mt-3 leading-7 text-[#60786c]">The Module Planner contains protected product decisions, approval records, and implementation evidence.</p>
          <a href="/admin" className="mt-6 inline-flex font-semibold text-[#175b47]">Return to organizer workspace →</a>
        </section>
      </main>
    );
  }
  return <ModulePlannerClient userName={user.displayName} />;
}
