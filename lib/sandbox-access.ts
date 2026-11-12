import { getAppUser } from "@/lib/auth";
import {
  assertSafeSandboxEnvironment,
  isSandboxEnvironment,
  isSandboxTester,
} from "@/lib/staging";

export async function sandboxAccess() {
  if (!isSandboxEnvironment())
    return { allowed: false, user: null, reason: "not_sandbox" as const };
  assertSafeSandboxEnvironment();
  const user = await getAppUser();
  if (!user)
    return { allowed: false, user: null, reason: "signed_out" as const };
  if (!isSandboxTester(user))
    return { allowed: false, user, reason: "not_tester" as const };
  return { allowed: true, user, reason: null };
}

export function sandboxAccessError(reason: string | null) {
  const status = reason === "signed_out" ? 401 : 403;
  return Response.json(
    { error: status === 401 ? "Sign in to the sandbox." : "Sandbox tester access required." },
    { status, headers: { "cache-control": "no-store" } },
  );
}
