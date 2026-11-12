export function withAuthenticatedEmail<T extends { email: string }>(
  draft: T,
  authenticatedEmail: string,
): T {
  return { ...draft, email: authenticatedEmail.trim() };
}
