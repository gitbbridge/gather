import { requireAppUser } from "@/lib/auth";
import SecurityClient from "./security-client";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Security Center | Gather" };

export default async function SecurityPage() {
  await requireAppUser("/admin/security");
  return <SecurityClient supabaseConfig={{ url: supabaseUrl, publishableKey: supabasePublishableKey }} />;
}

