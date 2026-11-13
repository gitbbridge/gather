-- Security-definer functions intentionally use a restricted search path.
-- Supabase installs pgcrypto in the trusted extensions schema, so include it
-- explicitly wherever these functions call digest().

alter function private.append_audit_event(
  uuid, uuid, text, text, text, uuid, text, text, jsonb, jsonb, text, text, text, text
) set search_path to pg_catalog, extensions;

alter function public.complete_ticket_order(
  uuid, text, text, text, integer
) set search_path to pg_catalog, extensions;
