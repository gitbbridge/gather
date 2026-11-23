import { z } from "zod";
import { managedOrganization } from "@/lib/organizer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const uuid = z.string().uuid();
const allowed = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);

function extension(file: File) {
  const known: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "text/plain": "txt" };
  return known[file.type] || "bin";
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const form = await request.formData();
    const organizationId = String(form.get("organizationId") || "");
    const supporterId = String(form.get("supporterId") || "");
    const opportunityId = String(form.get("opportunityId") || "");
    const file = form.get("file");
    if (!uuid.safeParse(organizationId).success || (supporterId && !uuid.safeParse(supporterId).success) || (opportunityId && !uuid.safeParse(opportunityId).success)) return Response.json({ error: "Check the attachment destination." }, { status: 400 });
    if (!(file instanceof File) || !allowed.has(file.type) || file.size > 10 * 1024 * 1024) return Response.json({ error: "Use a PDF, PNG, JPEG, or text file no larger than 10 MB." }, { status: 400 });
    const access = await managedOrganization(organizationId);
    if (!access) return Response.json({ error: "Access denied." }, { status: 403 });
    const client = createSupabaseAdminClient();
    const owner = supporterId || opportunityId;
    if (!owner) return Response.json({ error: "Choose a contact or opportunity." }, { status: 400 });
    const storagePath = `${organizationId}/${owner}/${crypto.randomUUID()}.${extension(file)}`;
    const { error: uploadError } = await client.storage.from("crm-attachments").upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await client.from("crm_attachments").insert({ organization_id: organizationId, supporter_id: supporterId || null, opportunity_id: opportunityId || null, file_name: file.name.slice(0, 240), storage_path: storagePath, content_type: file.type, size_bytes: file.size, uploaded_by: access.user.userId }).select("*").single();
    if (error) { await client.storage.from("crm-attachments").remove([storagePath]); throw error; }
    return Response.json({ attachment: data });
  } catch (error) {
    console.error("Unable to upload CRM attachment:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to upload attachment." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organization") || "";
  const id = url.searchParams.get("id") || "";
  if (!uuid.safeParse(organizationId).success || !uuid.safeParse(id).success) return Response.json({ error: "Invalid attachment." }, { status: 400 });
  const access = await managedOrganization(organizationId);
  if (!access) return Response.json({ error: "Access denied." }, { status: 403 });
  const client = createSupabaseAdminClient();
  const { data, error } = await client.from("crm_attachments").select("storage_path,file_name").eq("organization_id", organizationId).eq("id", id).single();
  if (error || !data) return Response.json({ error: "Attachment not found." }, { status: 404 });
  const { data: signed, error: signedError } = await client.storage.from("crm-attachments").createSignedUrl(data.storage_path, 120, { download: data.file_name });
  if (signedError) return Response.json({ error: "Unable to open attachment." }, { status: 500 });
  return Response.json({ url: signed.signedUrl });
}

export async function DELETE(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organization") || "";
    const id = url.searchParams.get("id") || "";
    if (!uuid.safeParse(organizationId).success || !uuid.safeParse(id).success) return Response.json({ error: "Invalid attachment." }, { status: 400 });
    const access = await managedOrganization(organizationId);
    if (!access) return Response.json({ error: "Access denied." }, { status: 403 });
    const client = createSupabaseAdminClient();
    const { data, error } = await client.from("crm_attachments").select("storage_path").eq("organization_id", organizationId).eq("id", id).single();
    if (error || !data) return Response.json({ error: "Attachment not found." }, { status: 404 });
    const { error: removeError } = await client.storage.from("crm-attachments").remove([data.storage_path]);
    if (removeError) throw removeError;
    const { error: deleteError } = await client.from("crm_attachments").delete().eq("organization_id", organizationId).eq("id", id);
    if (deleteError) throw deleteError;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete attachment." }, { status: 500 });
  }
}
