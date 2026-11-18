export type ProviderReadiness = { provider: string; configured: boolean; mode: "sandbox" | "live"; detail: string };

const configured = (name: string) => Boolean(process.env[name]?.trim());
const staging = process.env.GATHER_ENVIRONMENT === "staging" || process.env.EMAIL_DELIVERY_MODE === "test_sink";

export function emailMarketingProviderReadiness(): Record<string, ProviderReadiness> {
  return {
    ses: { provider: "Amazon SES", configured: configured("AWS_SES_ACCESS_KEY_ID") && configured("AWS_SES_SECRET_ACCESS_KEY") && configured("AWS_SES_REGION"), mode: staging ? "sandbox" : "live", detail: staging ? "Sandbox delivery is restricted to the configured test sink." : "Campaign delivery requires a verified SES identity and configuration set." },
    opensrs: { provider: "OpenSRS", configured: configured("OPENSRS_API_KEY") && configured("OPENSRS_USERNAME"), mode: staging ? "sandbox" : "live", detail: "Domain searches and purchases remain approval-gated even when configured." },
    reoon: { provider: "Reoon", configured: configured("REOON_API_KEY"), mode: staging ? "sandbox" : "live", detail: "Paid verification credits are never consumed without an explicit organization limit." },
  };
}

export function assertSandboxSafeMarketingSend(recipient: string) {
  if (!staging) return;
  const sink = process.env.TEST_EMAIL_RECIPIENT?.trim().toLowerCase();
  if (!sink || recipient.trim().toLowerCase() !== sink) throw new Error("Sandbox marketing email may only be sent to the configured test inbox.");
}

export async function sendSesTestEmail(input: { to: string; from: string; replyTo: string; subject: string; html: string }) {
  assertSandboxSafeMarketingSend(input.to);
  const readiness = emailMarketingProviderReadiness().ses;
  if (!readiness.configured) throw new Error("Amazon SES is not configured for this environment.");
  const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
  const client = new SESv2Client({
    region: process.env.AWS_SES_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY!,
    },
  });
  const result = await client.send(new SendEmailCommand({
    FromEmailAddress: input.from,
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: [input.replyTo],
    ConfigurationSetName: process.env.AWS_SES_MARKETING_CONFIGURATION_SET || undefined,
    Content: { Simple: { Subject: { Data: input.subject, Charset: "UTF-8" }, Body: { Html: { Data: input.html, Charset: "UTF-8" } } } },
    EmailTags: [{ Name: "message_type", Value: "marketing_test" }],
  }));
  return { messageId: result.MessageId || null };
}
