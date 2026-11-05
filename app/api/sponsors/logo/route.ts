import { z } from "zod";
import { managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const allowed = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const form = await request.formData();
    const organizationId = String(form.get("organizationId") || "");
    const file = form.get("logo");
    if (!z.string().uuid().safeParse(organizationId).success)
      return Response.json({ error: "Choose a nonprofit." }, { status: 400 });
    if (!(file instanceof File) || !allowed.has(file.type) || file.size <= 0 || file.size > 2_097_152)
      return Response.json({ error: "Upload a PNG, JPEG, or WebP logo under 2 MB." }, { status: 400 });
    if (!(await managedOrganization(organizationId)))
      return Response.json({ error: "Access denied." }, { status: 403 });
    const path = `${organizationId}/${crypto.randomUUID()}.${allowed.get(file.type)}`;
    const client = createSupabaseAdminClient();
    const { error } = await client.storage.from("sponsor-logos").upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    if (error) throw error;
    const { data } = client.storage.from("sponsor-logos").getPublicUrl(path);
    return Response.json({ url: data.publicUrl });
  } catch (error) {
    console.error("Unable to upload sponsor logo:", error);
    return Response.json({ error: "Unable to upload this logo." }, { status: 500 });
  }
}
