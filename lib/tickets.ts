export type TicketSalesStatus =
  "draft" | "scheduled" | "on_sale" | "sold_out" | "closed" | "cancelled";

export type TicketTypeAvailability = {
  status: TicketSalesStatus;
  salesStartAt: string | null;
  salesEndAt: string | null;
  capacity: number;
  reserved: number;
  sold: number;
};

export function remainingTicketInventory(ticket: TicketTypeAvailability) {
  return Math.max(0, ticket.capacity - ticket.reserved - ticket.sold);
}

export function effectiveTicketStatus(
  ticket: TicketTypeAvailability,
  now = new Date(),
): TicketSalesStatus {
  if (["draft", "cancelled"].includes(ticket.status)) return ticket.status;
  if (remainingTicketInventory(ticket) === 0) return "sold_out";
  if (ticket.salesEndAt && new Date(ticket.salesEndAt) <= now) return "closed";
  if (ticket.salesStartAt && new Date(ticket.salesStartAt) > now)
    return "scheduled";
  return ticket.status === "closed" ? "closed" : "on_sale";
}

export function ticketOrderTotals(
  lines: { unitPriceCents: number; quantity: number }[],
  processingFeeCents = 0,
  taxCents = 0,
) {
  const subtotalCents = lines.reduce(
    (total, line) => total + line.unitPriceCents * line.quantity,
    0,
  );
  return {
    subtotalCents,
    platformFeeCents: 0,
    processingFeeCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
  };
}

export const defaultTicketDesign = {
  version: 1,
  template: "classic",
  orientation: "landscape",
  colors: {
    background: "#ffffff",
    primary: "#175b47",
    accent: "#78a68b",
    text: "#17332a",
  },
  typography: { fontFamily: "Arial", titleSize: 28, bodySize: 14 },
  alignment: "left",
  border: { radius: 20, width: 1, color: "#dce6e0" },
  showOrganizationLogo: true,
  showEventImage: true,
  footerMessage: "Thank you for supporting our mission.",
} as const;

export function validTicketDesign(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const design = value as Record<string, unknown>;
  const colors = design.colors as Record<string, unknown> | undefined;
  return (
    design.version === 1 &&
    ["classic", "modern", "minimal", "blank"].includes(
      String(design.template),
    ) &&
    ["landscape", "portrait"].includes(String(design.orientation)) &&
    Boolean(colors) &&
    ["background", "primary", "accent", "text"].every((key) =>
      /^#[0-9a-f]{6}$/i.test(String(colors?.[key] || "")),
    )
  );
}
