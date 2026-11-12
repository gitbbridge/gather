export type SandboxPageLink = {
  label: string;
  href: string;
  note?: string;
};

export type SandboxPageGroup = {
  title: string;
  description: string;
  links: SandboxPageLink[];
};

// Keep this registry current whenever a user-facing route is added or retired.
// It is rendered only by the sandbox Testing Center.
export const sandboxPageGroups: SandboxPageGroup[] = [
  {
    title: "Public and account",
    description: "Marketing, registration, and supporter-facing entry points.",
    links: [
      { label: "Marketing homepage", href: "/" },
      { label: "Demo auction", href: "/demo" },
      { label: "About Give Holidays", href: "/about/give-holidays" },
      { label: "Sign in", href: "/auth" },
      { label: "Create organizer account", href: "/auth?mode=signup&return_to=%2Fonboarding" },
      { label: "Forgot password", href: "/auth?mode=forgot" },
      { label: "Supporter home", href: "/account" },
      { label: "My Wins", href: "/my-wins" },
      { label: "Messages", href: "/messages" },
    ],
  },
  {
    title: "Organizer workspace",
    description: "Auction setup, records, communications, and closeout.",
    links: [
      { label: "Five-step onboarding", href: "/onboarding" },
      { label: "Organizer dashboard", href: "/admin" },
      { label: "Auction page builder", href: "/homepage" },
      { label: "Give Holidays experiences", href: "/admin/experiences", note: "Select an auction to add packages." },
      { label: "Supporter records", href: "/admin/supporters" },
      { label: "Email and receipts", href: "/admin/settings/email-receipts" },
      { label: "Event closeout", href: "/closeout" },
      { label: "Event settlement", href: "/admin/settlement" },
      { label: "Event sponsors", href: "/admin/sponsors" },
      { label: "Ticket management", href: "/admin/tickets" },
      { label: "Gather Live controls", href: "/admin/live" },
      { label: "Security Center", href: "/admin/security" },
    ],
  },
  {
    title: "Platform and Give Holidays",
    description: "Restricted operational tools for authorized administrators.",
    links: [
      { label: "Master travel catalog", href: "/admin/give-holidays" },
      { label: "Auction travel fulfillment", href: "/admin/give-holidays/fulfillments" },
      { label: "Direct-offer fulfillment", href: "/admin/give-holidays/direct-fulfillments" },
      { label: "Direct fundraising offers", href: "/admin/direct-offers" },
      { label: "Email template library", href: "/admin/email-templates" },
      { label: "Sponsor portal", href: "/sponsor/portal" },
    ],
  },
  {
    title: "Help and policies",
    description: "Published guidance, legal drafts, and support pages.",
    links: [
      { label: "Help Center", href: "/help" },
      { label: "Organizer Guide", href: "/help/organizers" },
      { label: "Bidder Guide", href: "/help/bidders" },
      { label: "Fees and Payments", href: "/help/fees" },
      { label: "Travel Experiences Guide", href: "/help/travel" },
      { label: "Contact Support", href: "/support" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Cookie Policy", href: "/legal/cookies" },
      { label: "Refunds and Fulfillment", href: "/legal/refunds" },
    ],
  },
];
