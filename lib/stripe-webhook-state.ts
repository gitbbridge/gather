export const WEBHOOK_PROCESSING_LEASE_SECONDS = 5 * 60;

export type WebhookDeliveryState =
  | "accepted"
  | "processing"
  | "processed"
  | "failed";

export function webhookDeliveryIsClaimable(
  status: WebhookDeliveryState,
  claimedAtSeconds: number,
  nowSeconds: number,
) {
  if (status === "accepted" || status === "failed") return true;
  if (status === "processed") return false;
  return claimedAtSeconds <= nowSeconds - WEBHOOK_PROCESSING_LEASE_SECONDS;
}

export function webhookFailureMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1000)
    : "Unknown processing error";
}
