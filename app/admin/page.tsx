import { requireAppUser } from "@/lib/auth";
import AdminClient from "./admin-client";
import { Toaster } from "sonner";
import { postAuthDestination } from "@/lib/auth-destination";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAppUser("/admin");
  const destination = await postAuthDestination(user, "/admin");
  if (destination !== "/admin") redirect(destination);
  return <main><AdminClient /><Toaster richColors /></main>;
}
