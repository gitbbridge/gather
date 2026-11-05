export type FeeCoverage = "platform" | "processing" | "both";

export const defaultSponsorTiers = [
  { name: "Presenting Sponsor", rank: 10, style: "presenting" },
  { name: "Platinum Sponsor", rank: 20, style: "prominent" },
  { name: "Gold Sponsor", rank: 30, style: "prominent" },
  { name: "Silver Sponsor", rank: 40, style: "compact" },
  { name: "Community Sponsor", rank: 50, style: "compact" },
] as const;

export function coverageFlags(coverage: FeeCoverage) {
  return {
    coversPlatform: coverage === "platform" || coverage === "both",
    coversProcessing: coverage === "processing" || coverage === "both",
  };
}

export function coverageLabel(coverage: FeeCoverage) {
  if (coverage === "platform") return "Gather platform fees";
  if (coverage === "processing") return "eligible payment-processing fees";
  return "Gather platform and eligible payment-processing fees";
}

export function sponsorRecognitionCopy(input: {
  sponsorName: string;
  coverage: FeeCoverage;
  maximumCents: number;
  remainingCents: number;
}) {
  if (input.remainingCents <= 0) return "";
  if (input.coverage === "platform")
    return `Thanks to ${input.sponsorName} for helping cover Gather platform fees for this event, allowing more proceeds to support our mission.`;
  if (input.coverage === "processing")
    return `Thanks to ${input.sponsorName} for helping cover eligible payment-processing expenses for this event.`;
  return `${input.sponsorName} is generously contributing toward eligible event transaction fees, up to its sponsorship commitment.`;
}

export function sponsorshipBalance(input: {
  maximumCents: number;
  allocatedCents: number;
  chargedCents: number;
  refundedCents?: number;
}) {
  const maximum = Math.max(0, Math.trunc(input.maximumCents));
  const allocated = Math.max(0, Math.trunc(input.allocatedCents));
  const charged = Math.max(0, Math.trunc(input.chargedCents));
  const refunded = Math.max(0, Math.trunc(input.refundedCents || 0));
  return {
    maximumCents: maximum,
    allocatedCents: allocated,
    chargedCents: charged,
    refundedCents: refunded,
    remainingCents: Math.max(0, maximum - allocated),
    outstandingCents: Math.max(0, allocated - charged + refunded),
  };
}

export function boundedAllocation(eligibleCents: number, remainingCents: number) {
  if (!Number.isInteger(eligibleCents) || eligibleCents < 0)
    throw new Error("Invalid eligible fee amount.");
  if (!Number.isInteger(remainingCents) || remainingCents < 0)
    throw new Error("Invalid remaining sponsorship amount.");
  return Math.min(eligibleCents, remainingCents);
}

export function randomPortalToken(bytes = 32) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashPortalToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

export function safeSponsorWebsite(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
