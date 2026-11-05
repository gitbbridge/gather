export const conversationStatuses = ["open", "pending", "resolved"] as const;
export const announcementAudiences = [
  "all_registered",
  "active_bidders",
  "winners",
  "unpaid_winners",
] as const;

export function cleanMessage(value: unknown, limit = 4000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, limit);
}

export function conversationKey(input: {
  bidderId: string;
  auctionId: string;
  itemId?: string | null;
}) {
  return `bidder:${input.bidderId}:auction:${input.auctionId}:item:${input.itemId || "general"}`;
}

export function resolveReceiptCopy<
  T extends {
    thankYouHeading: string;
    thankYouMessage: string;
    receiptFooter: string;
  },
>(
  organization: T,
  override?: (Partial<T> & { inheritsDefaults?: boolean }) | null,
) {
  if (!override || override.inheritsDefaults !== false) return organization;
  return {
    ...organization,
    thankYouHeading:
      override.thankYouHeading?.trim() || organization.thankYouHeading,
    thankYouMessage:
      override.thankYouMessage?.trim() || organization.thankYouMessage,
    receiptFooter: override.receiptFooter?.trim() || organization.receiptFooter,
  };
}
