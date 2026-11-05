import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { postAuthDestination } from "@/lib/auth-destination";
export async function GET(request: Request) {
  const url = new URL(request.url),
    user = await getAppUser();
  if (!user)
    return NextResponse.redirect(
      new URL(
        `/auth?return_to=${encodeURIComponent(url.searchParams.get("return_to") || "/")}`,
        url.origin,
      ),
    );
  return NextResponse.redirect(
    new URL(
      await postAuthDestination(user, url.searchParams.get("return_to") || "/"),
      url.origin,
    ),
  );
}
