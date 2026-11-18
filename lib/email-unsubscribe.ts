type UnsubscribeToken = { organizationId: string; supporterId: string; campaignId: string; expiresAt: number };

const encoder = new TextEncoder();
const encode = (value: Uint8Array | string) => {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const decode = (value: string) => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
async function key() {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Email unsubscribe signing is not configured.");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createUnsubscribeToken(payload: UnsubscribeToken) {
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), encoder.encode(encodedPayload)));
  return `${encodedPayload}.${encode(signature)}`;
}

export async function verifyUnsubscribeToken(token: string): Promise<UnsubscribeToken | null> {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  const valid = await crypto.subtle.verify("HMAC", await key(), decode(encodedSignature), encoder.encode(encodedPayload));
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(decode(encodedPayload))) as UnsubscribeToken;
  if (!payload.organizationId || !payload.supporterId || !payload.campaignId || payload.expiresAt < Date.now()) return null;
  return payload;
}
