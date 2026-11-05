const supporterPaths = ["/n/", "/offers/", "/my-wins", "/messages", "/account"];
function safeTarget(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : "/";
  } catch {
    return "/";
  }
}
export function roleDestination(input: {
  target: string;
  organizer: boolean;
  accountType?: string | null;
  platformAdmin?: boolean;
}) {
  const target = safeTarget(input.target);
  if (input.platformAdmin) return target === "/" ? "/admin" : target;
  if (supporterPaths.some((path) => target.startsWith(path))) return target;
  if (input.organizer)
    return target.startsWith("/onboarding") || target.startsWith("/admin")
      ? target
      : "/admin";
  return input.accountType === "organizer" ? "/onboarding" : "/account";
}
