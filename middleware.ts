import { NextResponse, type NextRequest } from "next/server";

import { productionSecurityHeaders } from "@/lib/security/headers";

export function middleware(_request: NextRequest) {
  const response = NextResponse.next();

  for (const { key, value } of productionSecurityHeaders) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
