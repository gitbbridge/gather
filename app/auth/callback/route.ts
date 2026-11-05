import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { postAuthDestination } from "@/lib/auth-destination";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnTo = safeReturnPath(url.searchParams.get("return_to") || "/");
  const callbackError = url.searchParams.get("error");
  if (callbackError) {
    const reset = returnTo === "/auth/update-password";
    return NextResponse.redirect(
      new URL(
        `/auth?mode=${reset ? "forgot" : "signin"}&return_to=${encodeURIComponent(reset ? "/admin" : returnTo)}&error=${reset ? "expired_reset" : "callback"}`,
        url.origin,
      ),
    );
  }
  const supabase = await createSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = await getAppUser();
      return NextResponse.redirect(
        new URL(
          user ? await postAuthDestination(user, returnTo) : returnTo,
          url.origin,
        ),
      );
    }
  }

  const reset = returnTo === "/auth/update-password";
  return NextResponse.redirect(
    new URL(
      `/auth?mode=${reset ? "forgot" : "signin"}&return_to=${encodeURIComponent(reset ? "/admin" : returnTo)}&error=${reset ? "expired_reset" : "callback"}`,
      url.origin,
    ),
  );
}
