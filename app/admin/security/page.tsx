import { requireAppUser } from "@/lib/auth";
import SecurityClient from "./security-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security Center | Gather" };

export default async function SecurityPage() {
  await requireAppUser("/admin/security");
  return <SecurityClient />;
}

