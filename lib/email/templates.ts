export type EmailCategory =
  | "Authentication"
  | "Security"
  | "Bidding"
  | "Payments"
  | "Give Holidays"
  | "Organizer";
export type EmailProvider = "Supabase Auth" | "Gather notifications";
export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  category: EmailCategory;
  provider: EmailProvider;
  subject: string;
  html: string;
  variables: string[];
  providerKey?: string;
  subjectKey?: string;
};

const green = "#175b47",
  pale = "#eef4f0",
  ink = "#16221d",
  muted = "#617068",
  border = "#dfe7e2";
const esc = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const p = (text: string) =>
  `<p style="margin:0 0 18px;color:${muted};font-size:16px;line-height:1.65;">${text}</p>`;
const strong = (text: string) =>
  `<strong style="color:${ink};font-weight:700;">${text}</strong>`;
const details = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid ${border};border-radius:12px;border-collapse:separate;overflow:hidden;">${rows.map(([label, value]) => `<tr><td style="padding:12px 16px;border-bottom:1px solid ${border};color:${muted};font-size:13px;">${label}</td><td align="right" style="padding:12px 16px;border-bottom:1px solid ${border};color:${ink};font-size:14px;font-weight:700;">${value}</td></tr>`).join("")}</table>`;
const notice = (content: string, tone: "green" | "amber" | "red" = "green") => {
  const colors =
    tone === "red"
      ? ["#fff2f0", "#922b21"]
      : tone === "amber"
        ? ["#fff8e8", "#815b13"]
        : [pale, green];
  return `<div style="margin:22px 0;padding:16px 18px;border-radius:10px;background:${colors[0]};color:${colors[1]};font-size:14px;line-height:1.55;">${content}</div>`;
};

function shell(input: {
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  secondary?: string;
}) {
  const button = input.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 24px;"><tr><td bgcolor="${green}" style="border-radius:8px;"><a href="${input.cta.href}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">${input.cta.label}</a></td></tr></table>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.title)}</title></head><body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:${ink};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${input.preheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;"><tr><td style="padding:0 4px 20px;color:${green};font-size:26px;font-weight:700;letter-spacing:-1px;">gather<span style="color:#78a68b;">.</span></td></tr><tr><td style="background:#ffffff;border:1px solid ${border};border-radius:16px;padding:36px 38px;"><div style="margin-bottom:12px;color:#648371;font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">${input.eyebrow}</div><h1 style="margin:0 0 18px;color:${ink};font-size:30px;line-height:1.2;letter-spacing:-.5px;">${input.title}</h1>${input.body}${button}${input.secondary ? `<div style="margin-top:22px;padding-top:20px;border-top:1px solid ${border};color:${muted};font-size:12px;line-height:1.6;">${input.secondary}</div>` : ""}</td></tr><tr><td style="padding:22px 10px 0;text-align:center;color:#78867f;font-size:11px;line-height:1.6;">Gather · Simple online auctions with risk-free travel experiences<br><a href="https://gatherforgood.bid" style="color:${green};text-decoration:none;">gatherforgood.bid</a> · Support: <a href="mailto:support@gatherforgood.bid" style="color:${green};text-decoration:none;">support@gatherforgood.bid</a></td></tr></table></td></tr></table></body></html>`;
}

const auth = (
  id: string,
  name: string,
  description: string,
  subject: string,
  providerKey: string,
  input: Parameters<typeof shell>[0],
  variables: string[],
): EmailTemplate => ({
  id,
  name,
  description,
  category: id.startsWith("security-") ? "Security" : "Authentication",
  provider: "Supabase Auth",
  subject,
  providerKey,
  subjectKey: providerKey
    .replace("mailer_templates_", "mailer_subjects_")
    .replace("_content", ""),
  variables,
  html: shell(input),
});
const app = (
  id: string,
  name: string,
  description: string,
  category: EmailCategory,
  subject: string,
  input: Parameters<typeof shell>[0],
  variables: string[],
): EmailTemplate => ({
  id,
  name,
  description,
  category,
  provider: "Gather notifications",
  subject,
  variables,
  html: shell(input),
});

export const emailTemplates: EmailTemplate[] = [
  auth(
    "auth-confirm-signup",
    "Confirm sign up",
    "Ask new users to verify their email address.",
    "Confirm your Gather account",
    "mailer_templates_confirmation_content",
    {
      preheader:
        "Confirm your email address to finish creating your Gather account.",
      eyebrow: "Welcome to Gather",
      title: "Confirm your email address",
      body:
        p(
          "You’re one step away from creating auctions, bidding for a cause, and supporting your community.",
        ) + p("Confirm that <strong>{{ .Email }}</strong> belongs to you."),
      cta: { label: "Confirm email address", href: "{{ .ConfirmationURL }}" },
      secondary:
        "This link expires for your security. If you did not create a Gather account, you can ignore this email.",
    },
    [".Email", ".ConfirmationURL"],
  ),
  auth(
    "auth-invite-user",
    "Invite user",
    "Invite someone to create a Gather account.",
    "You’re invited to Gather",
    "mailer_templates_invite_content",
    {
      preheader: "You have been invited to join Gather.",
      eyebrow: "You’re invited",
      title: "Join Gather",
      body: p(
        "You’ve been invited to create a Gather account and help make good things happen through online auctions.",
      ),
      cta: { label: "Accept invitation", href: "{{ .ConfirmationURL }}" },
      secondary:
        "This invitation was sent to {{ .Email }}. If you were not expecting it, you can ignore this email.",
    },
    [".Email", ".ConfirmationURL"],
  ),
  auth(
    "auth-magic-link",
    "Magic link or OTP",
    "Send a one-time sign-in link and verification code.",
    "Your secure Gather sign-in link",
    "mailer_templates_magic_link_content",
    {
      preheader: "Use this secure link or verification code to sign in.",
      eyebrow: "Secure sign in",
      title: "Your sign-in link",
      body:
        p(
          "Use the button below to sign in to Gather. The link can only be used once.",
        ) +
        notice(
          `Verification code: <span style="font-size:22px;font-weight:800;letter-spacing:4px;">{{ .Token }}</span>`,
        ),
      cta: { label: "Sign in to Gather", href: "{{ .ConfirmationURL }}" },
      secondary:
        "If you did not request this sign-in link, you can safely ignore this email.",
    },
    [".Token", ".ConfirmationURL"],
  ),
  auth(
    "auth-change-email",
    "Change email address",
    "Verify a requested new email address.",
    "Confirm your new Gather email",
    "mailer_templates_email_change_content",
    {
      preheader: "Confirm your new email address for Gather.",
      eyebrow: "Account update",
      title: "Confirm your new email",
      body:
        p("A request was made to change your Gather email address to:") +
        notice(strong("{{ .NewEmail }}")),
      cta: { label: "Confirm new email", href: "{{ .ConfirmationURL }}" },
      secondary:
        "If you did not request this change, do not click the button. Contact support immediately.",
    },
    [".NewEmail", ".ConfirmationURL"],
  ),
  auth(
    "auth-reset-password",
    "Reset password",
    "Send a secure password recovery link.",
    "Reset your Gather password",
    "mailer_templates_recovery_content",
    {
      preheader: "Use this secure link to choose a new Gather password.",
      eyebrow: "Password recovery",
      title: "Reset your password",
      body:
        p(
          "We received a request to reset the password for <strong>{{ .Email }}</strong>.",
        ) + p("Choose a new password using the secure button below."),
      cta: { label: "Choose a new password", href: "{{ .ConfirmationURL }}" },
      secondary:
        "If you did not request a password reset, you can ignore this email. Your password will not change.",
    },
    [".Email", ".ConfirmationURL"],
  ),
  auth(
    "auth-reauthentication",
    "Reauthentication",
    "Verify identity before a sensitive account action.",
    "{{ .Token }} is your Gather verification code",
    "mailer_templates_reauthentication_content",
    {
      preheader: "Your one-time Gather verification code.",
      eyebrow: "Identity check",
      title: "Verify it’s you",
      body:
        p(
          "Enter this one-time code to continue with your secure account action:",
        ) +
        notice(
          `<div style="text-align:center;font-size:30px;font-weight:800;letter-spacing:7px;">{{ .Token }}</div>`,
        ),
      secondary:
        "This code expires shortly. Gather will never ask you to send this code by email or text.",
    },
    [".Token"],
  ),
  auth(
    "security-password-changed",
    "Password changed",
    "Notify a user after their password changes.",
    "Your Gather password was changed",
    "mailer_templates_password_changed_notification_content",
    {
      preheader: "The password for your Gather account was changed.",
      eyebrow: "Security notice",
      title: "Your password was changed",
      body:
        p(
          "The password for <strong>{{ .Email }}</strong> was recently changed.",
        ) + notice("If you made this change, no action is needed.", "green"),
      cta: {
        label: "Secure my account",
        href: "{{ .SiteURL }}/auth?mode=forgot",
      },
      secondary:
        "If this was not you, reset your password immediately and contact Gather support.",
    },
    [".Email", ".SiteURL"],
  ),
  auth(
    "security-email-changed",
    "Email address changed",
    "Notify a user after their email address changes.",
    "Your Gather email address was changed",
    "mailer_templates_email_changed_notification_content",
    {
      preheader: "The email address on your Gather account was changed.",
      eyebrow: "Security notice",
      title: "Your email was changed",
      body:
        p("Your Gather account email changed from:") +
        details([
          ["Previous email", "{{ .OldEmail }}"],
          ["New email", "{{ .Email }}"],
        ]),
      cta: {
        label: "Contact Gather support",
        href: "mailto:support@gatherforgood.bid",
      },
      secondary:
        "If you made this change, no action is needed. If not, contact support immediately.",
    },
    [".OldEmail", ".Email"],
  ),
  auth(
    "security-phone-changed",
    "Phone number changed",
    "Notify a user after their phone number changes.",
    "Your Gather phone number was changed",
    "mailer_templates_phone_changed_notification_content",
    {
      preheader: "The phone number on your Gather account was changed.",
      eyebrow: "Security notice",
      title: "Your phone number was changed",
      body: details([
        ["Previous number", "{{ .OldPhone }}"],
        ["New number", "{{ .Phone }}"],
      ]),
      cta: {
        label: "Contact Gather support",
        href: "mailto:support@gatherforgood.bid",
      },
      secondary:
        "If you made this change, no action is needed. If not, contact support immediately.",
    },
    [".OldPhone", ".Phone"],
  ),
  auth(
    "security-signin-linked",
    "Sign-in method linked",
    "Notify a user when a new sign-in method is linked.",
    "A sign-in method was linked to Gather",
    "mailer_templates_identity_linked_notification_content",
    {
      preheader: "A new sign-in method was linked to your Gather account.",
      eyebrow: "Security notice",
      title: "New sign-in method linked",
      body: p(
        "A <strong>{{ .Provider }}</strong> sign-in method was linked to <strong>{{ .Email }}</strong>.",
      ),
      cta: {
        label: "Contact Gather support",
        href: "mailto:support@gatherforgood.bid",
      },
      secondary:
        "If you linked this method, no action is needed. If not, contact support immediately.",
    },
    [".Provider", ".Email"],
  ),
  auth(
    "security-signin-removed",
    "Sign-in method removed",
    "Notify a user when a sign-in method is removed.",
    "A sign-in method was removed from Gather",
    "mailer_templates_identity_unlinked_notification_content",
    {
      preheader: "A sign-in method was removed from your Gather account.",
      eyebrow: "Security notice",
      title: "Sign-in method removed",
      body: p(
        "The <strong>{{ .Provider }}</strong> sign-in method was removed from <strong>{{ .Email }}</strong>.",
      ),
      cta: {
        label: "Contact Gather support",
        href: "mailto:support@gatherforgood.bid",
      },
      secondary:
        "If you removed this method, no action is needed. If not, contact support immediately.",
    },
    [".Provider", ".Email"],
  ),
  auth(
    "security-mfa-added",
    "MFA method added",
    "Notify a user when a verification method is added.",
    "A verification method was added to Gather",
    "mailer_templates_mfa_factor_enrolled_notification_content",
    {
      preheader: "A verification method was added to your Gather account.",
      eyebrow: "Security notice",
      title: "Verification method added",
      body: p(
        "A <strong>{{ .FactorType }}</strong> verification method was added to your account.",
      ),
      cta: {
        label: "Contact Gather support",
        href: "mailto:support@gatherforgood.bid",
      },
      secondary:
        "If you added this method, no action is needed. If not, contact support immediately.",
    },
    [".FactorType"],
  ),
  auth(
    "security-mfa-removed",
    "MFA method removed",
    "Notify a user when a verification method is removed.",
    "A verification method was removed from Gather",
    "mailer_templates_mfa_factor_unenrolled_notification_content",
    {
      preheader: "A verification method was removed from your Gather account.",
      eyebrow: "Security notice",
      title: "Verification method removed",
      body: p(
        "A <strong>{{ .FactorType }}</strong> verification method was removed from your account.",
      ),
      cta: {
        label: "Contact Gather support",
        href: "mailto:support@gatherforgood.bid",
      },
      secondary:
        "If you removed this method, no action is needed. If not, contact support immediately.",
    },
    [".FactorType"],
  ),
  app(
    "bidder-registration",
    "Bidder registration",
    "Welcome a bidder after registration.",
    "Bidding",
    "You’re registered for {{auctionName}}",
    {
      preheader: "You are ready to bid for a cause.",
      eyebrow: "Registration confirmed",
      title: "You’re ready to bid",
      body:
        p(
          "Hi {{firstName}}, you’re registered for <strong>{{auctionName}}</strong>, supporting <strong>{{organizationName}}</strong>.",
        ) +
        details([
          ["Auction opens", "{{opensAt}}"],
          ["Auction closes", "{{closesAt}}"],
        ]),
      cta: { label: "Explore the auction", href: "{{auctionUrl}}" },
      secondary:
        "Keep this email for easy access to the auction. Bid updates will be sent to this address.",
    },
    [
      "firstName",
      "auctionName",
      "organizationName",
      "opensAt",
      "closesAt",
      "auctionUrl",
    ],
  ),
  app(
    "bid-confirmation",
    "Bid confirmation",
    "Confirm a bidder’s maximum bid was recorded.",
    "Bidding",
    "Your bid is in for {{itemTitle}}",
    {
      preheader: "Your maximum bid was recorded.",
      eyebrow: "Bid confirmed",
      title: "Your bid is in",
      body:
        p(
          "Your maximum bid for <strong>{{itemTitle}}</strong> was recorded securely.",
        ) +
        details([
          ["Current bid", "{{currentBid}}"],
          ["Your private maximum", "{{maximumBid}}"],
          ["Auction closes", "{{closesAt}}"],
        ]),
      cta: { label: "View my bids", href: "{{myBidsUrl}}" },
      secondary:
        "Gather increases your bid only as needed, up to your private maximum. Your maximum is never shown to other bidders.",
    },
    ["itemTitle", "currentBid", "maximumBid", "closesAt", "myBidsUrl"],
  ),
  app(
    "outbid",
    "Outbid alert",
    "Tell a bidder when another maximum bid takes the lead.",
    "Bidding",
    "You’ve been outbid on {{itemTitle}}",
    {
      preheader: "Another bidder is leading—there is still time.",
      eyebrow: "Bid update",
      title: "You’ve been outbid",
      body:
        p("Another bidder is now leading on <strong>{{itemTitle}}</strong>.") +
        details([
          ["Current bid", "{{currentBid}}"],
          ["Next minimum bid", "{{minimumBid}}"],
          ["Time remaining", "{{timeRemaining}}"],
        ]),
      cta: { label: "Bid again", href: "{{itemUrl}}" },
      secondary:
        "Auction extensions may apply when bids arrive near closing. You will never be charged until the auction ends and you win.",
    },
    ["itemTitle", "currentBid", "minimumBid", "timeRemaining", "itemUrl"],
  ),
  app(
    "auction-ending",
    "Auction ending soon",
    "Remind watched and active bidders before close.",
    "Bidding",
    "{{auctionName}} ends {{timeRemaining}}",
    {
      preheader: "Your auction favorites are closing soon.",
      eyebrow: "Closing soon",
      title: "The auction ends {{timeRemaining}}",
      body:
        p(
          "There is still time to check your bids and watchlist for <strong>{{auctionName}}</strong>.",
        ) + notice("{{watchlistSummary}}", "amber"),
      cta: { label: "Review my bids", href: "{{myBidsUrl}}" },
      secondary:
        "Last-minute bids may extend an item briefly to give every bidder a fair chance.",
    },
    ["auctionName", "timeRemaining", "watchlistSummary", "myBidsUrl"],
  ),
  app(
    "winner",
    "Winner notification",
    "Tell a bidder they won one or more auction items.",
    "Bidding",
    "You won at {{auctionName}}!",
    {
      preheader: "Congratulations—your winning items are ready in My Wins.",
      eyebrow: "Congratulations",
      title: "You won!",
      body:
        p(
          "Thank you for supporting <strong>{{organizationName}}</strong>. Your winning items are waiting in My Wins.",
        ) + notice("{{itemSummary}}"),
      cta: { label: "View My Wins", href: "{{myWinsUrl}}" },
      secondary:
        "Your organizer will send one combined invoice for all winning items from this auction.",
    },
    ["auctionName", "organizationName", "itemSummary", "myWinsUrl"],
  ),
  app(
    "invoice-ready",
    "Winner invoice ready",
    "Send the combined winner invoice after auction close.",
    "Payments",
    "Your {{auctionName}} invoice is ready",
    {
      preheader: "Your combined winner invoice is ready for secure payment.",
      eyebrow: "Invoice ready",
      title: "Your winner invoice is ready",
      body:
        p(
          "All your winning items from <strong>{{auctionName}}</strong> are combined into one secure invoice.",
        ) +
        details([
          ["Winning bids", "{{hammerSubtotal}}"],
          ["Your share of Gather’s capped 5% fee", "{{bidderFee}}"],
          ["Total due", "{{totalDue}}"],
          ["Due date", "{{dueDate}}"],
        ]),
      cta: { label: "Pay securely", href: "{{checkoutUrl}}" },
      secondary:
        "Stripe processing fees are disclosed separately and are not part of Gather’s 5% platform fee, which is capped at $100 per item.",
    },
    [
      "auctionName",
      "hammerSubtotal",
      "bidderFee",
      "totalDue",
      "dueDate",
      "checkoutUrl",
    ],
  ),
  app(
    "payment-receipt",
    "Paid receipt",
    "Confirm a verified payment with item, fee, transaction, and fulfillment details.",
    "Payments",
    "Payment received — {{auctionName}}",
    {
      preheader: "Thank you—your auction payment was received.",
      eyebrow: "Payment complete",
      title: "{{thankYouHeading}}",
      body:
        p("{{thankYouMessage}}") +
        p(
          "Hi {{bidderName}}, your payment to support <strong>{{organizationName}}</strong> was successful.",
        ) +
        details([
          ["Receipt number", "{{receiptNumber}}"],
          ["Bidder email", "{{bidderEmail}}"],
          ["Winning items", "{{itemSummary}}"],
          ["Winning bids", "{{hammerSubtotal}}"],
          ["Your share of Gather’s capped 5% fee", "{{bidderFee}}"],
          ["Payment-processing fee", "{{processingFee}}"],
          ["Total amount charged", "{{amountPaid}}"],
          ["Payment status", "{{paymentStatus}}"],
          ["Transaction ID", "{{transactionId}}"],
          ["Paid on", "{{paidAt}}"],
          ["Payment method", "{{paymentMethod}}"],
        ]) +
        notice("{{fulfillmentInstructions}}"),
      cta: { label: "View receipt and wins", href: "{{myWinsUrl}}" },
      secondary:
        "{{receiptFooter}} Payment receipts are issued only after Stripe confirms payment.",
    },
    [
      "auctionName",
      "organizationName",
      "thankYouHeading",
      "thankYouMessage",
      "receiptFooter",
      "bidderName",
      "bidderEmail",
      "receiptNumber",
      "itemSummary",
      "hammerSubtotal",
      "bidderFee",
      "processingFee",
      "amountPaid",
      "paymentStatus",
      "transactionId",
      "paidAt",
      "paymentMethod",
      "fulfillmentInstructions",
      "myWinsUrl",
    ],
  ),
  app(
    "refund",
    "Refund confirmation",
    "Confirm a full or partial refund.",
    "Payments",
    "Your Gather refund was issued",
    {
      preheader: "A refund was issued for your auction payment.",
      eyebrow: "Refund processed",
      title: "Your refund is on the way",
      body:
        p("A refund has been issued for <strong>{{itemOrInvoice}}</strong>.") +
        details([
          ["Refund amount", "{{refundAmount}}"],
          ["Refund reference", "{{refundReference}}"],
          ["Reason", "{{refundReason}}"],
        ]) +
        notice(
          "Most refunds appear on the original payment method within 5–10 business days.",
          "amber",
        ),
      cta: { label: "View My Wins", href: "{{myWinsUrl}}" },
      secondary:
        "Timing is controlled by your bank or card issuer after Stripe processes the refund.",
    },
    [
      "itemOrInvoice",
      "refundAmount",
      "refundReference",
      "refundReason",
      "myWinsUrl",
    ],
  ),
  app(
    "travel-details-needed",
    "Traveler details needed",
    "Invite a paid travel winner to claim their experience.",
    "Give Holidays",
    "Claim your {{packageTitle}} experience",
    {
      preheader: "Your travel package is paid and ready to claim.",
      eyebrow: "Give Holidays",
      title: "Claim your experience",
      body:
        p(
          "Payment is confirmed for <strong>{{packageTitle}}</strong>. Tell us who is traveling and share your preferred dates.",
        ) +
        details([
          ["Destination", "{{destination}}"],
          ["Stay", "{{staySummary}}"],
          ["Book by", "{{expirationDate}}"],
        ]),
      cta: { label: "Submit traveler details", href: "{{claimUrl}}" },
      secondary:
        "Preferred dates are requests, not instant reservations. Give Holidays confirms availability before booking.",
    },
    [
      "packageTitle",
      "destination",
      "staySummary",
      "expirationDate",
      "claimUrl",
    ],
  ),
  app(
    "travel-details-received",
    "Traveler details received",
    "Confirm receipt of the winner’s travel request.",
    "Give Holidays",
    "We received your travel details",
    {
      preheader:
        "Give Holidays received your traveler details and preferred dates.",
      eyebrow: "Give Holidays",
      title: "Traveler details received",
      body:
        p(
          "We received the traveler information for <strong>{{packageTitle}}</strong>.",
        ) +
        details([
          ["Travelers", "{{travelerNames}}"],
          ["Preferred dates", "{{preferredDates}}"],
          ["Current status", "Booking review"],
        ]),
      cta: { label: "Track my experience", href: "{{myWinsUrl}}" },
      secondary:
        "We will contact you if additional details are needed. No dates are confirmed until you receive a booking confirmation.",
    },
    ["packageTitle", "travelerNames", "preferredDates", "myWinsUrl"],
  ),
  app(
    "travel-dates-requested",
    "Travel dates requested",
    "Tell the winner their dates were sent for availability.",
    "Give Holidays",
    "Your travel dates have been requested",
    {
      preheader: "Your preferred travel dates are being checked.",
      eyebrow: "Give Holidays",
      title: "Dates requested",
      body:
        p(
          "We sent your preferred dates for <strong>{{packageTitle}}</strong> to the booking team.",
        ) +
        details([
          ["Requested dates", "{{preferredDates}}"],
          ["Booking lead time", "{{bookingLeadTime}}"],
          ["Current status", "Availability check"],
        ]),
      cta: { label: "Track my experience", href: "{{myWinsUrl}}" },
      secondary:
        "Please do not purchase non-refundable transportation until your package is confirmed.",
    },
    ["packageTitle", "preferredDates", "bookingLeadTime", "myWinsUrl"],
  ),
  app(
    "travel-confirmed",
    "Travel booking confirmed",
    "Deliver the confirmed booking details.",
    "Give Holidays",
    "Your {{packageTitle}} booking is confirmed",
    {
      preheader: "Your Give Holidays travel booking is confirmed.",
      eyebrow: "Booking confirmed",
      title: "Your experience is confirmed",
      body:
        p(
          "Your <strong>{{packageTitle}}</strong> booking is confirmed. We hope you have an unforgettable trip.",
        ) +
        details([
          ["Confirmation", "{{confirmationReference}}"],
          ["Travel dates", "{{confirmedDates}}"],
          ["Travelers", "{{travelerNames}}"],
        ]),
      cta: { label: "View booking details", href: "{{myWinsUrl}}" },
      secondary:
        "Review all package terms before travel. Contact Give Holidays promptly if any confirmed detail appears incorrect.",
    },
    [
      "packageTitle",
      "confirmationReference",
      "confirmedDates",
      "travelerNames",
      "myWinsUrl",
    ],
  ),
  app(
    "travel-fulfilled",
    "Travel experience fulfilled",
    "Close the fulfillment record after travel.",
    "Give Holidays",
    "Thank you for traveling with Give Holidays",
    {
      preheader: "Your Give Holidays experience is marked fulfilled.",
      eyebrow: "Experience complete",
      title: "We hope it was wonderful",
      body:
        p(
          "Your <strong>{{packageTitle}}</strong> experience is now marked fulfilled.",
        ) +
        p(
          "Thank you for supporting <strong>{{organizationName}}</strong> through your winning bid.",
        ),
      cta: { label: "View My Wins", href: "{{myWinsUrl}}" },
      secondary:
        "Questions about a completed booking? Reply to this email or contact support@gatherforgood.bid.",
    },
    ["packageTitle", "organizationName", "myWinsUrl"],
  ),
  app(
    "direct-offer-welcome",
    "Direct offer guest welcome",
    "Welcome a paid direct-offer guest and explain proactive concierge care.",
    "Give Holidays",
    "Your Give Holidays experience supports {{organizationName}}",
    {
      preheader:
        "Your purchase is confirmed and Give Holidays will take it from here.",
      eyebrow: "The People Who Give Deserve Our Very Best",
      title: "Thank you for showing up for others",
      body:
        p(
          "Hi {{guestName}}, your purchase of <strong>{{packageTitle}}</strong> is confirmed and supports <strong>{{organizationName}}</strong>.",
        ) +
        details([
          ["Receipt", "{{receiptNumber}}"],
          ["Amount paid", "{{amountPaid}}"],
          ["Quantity", "{{quantity}}"],
        ]) +
        p(
          "Give Holidays has created your guest record. A travel concierge will proactively contact you to discuss preferences and desired dates—there is no voucher you need to submit to begin.",
        ),
      cta: { label: "View the experience", href: "{{offerUrl}}" },
      secondary:
        "The people who show up for others deserve a travel partner who shows up for them. Travel dates remain subject to package terms and confirmed availability.",
    },
    [
      "organizationName",
      "guestName",
      "packageTitle",
      "receiptNumber",
      "amountPaid",
      "quantity",
      "offerUrl",
    ],
  ),
  app(
    "organizer-auction-launched",
    "Auction launched",
    "Confirm that an organizer’s auction is live.",
    "Organizer",
    "{{auctionName}} is live",
    {
      preheader: "Your Gather auction is live and ready to share.",
      eyebrow: "Auction launched",
      title: "Your auction is live",
      body:
        p(
          "<strong>{{auctionName}}</strong> is open for online and mobile bidding.",
        ) +
        details([
          ["Public link", "{{auctionUrl}}"],
          ["Opens", "{{opensAt}}"],
          ["Closes", "{{closesAt}}"],
        ]),
      cta: { label: "Open organizer dashboard", href: "{{dashboardUrl}}" },
      secondary:
        "Share the auction link or QR code with supporters. Gather handles online bidding; event-night sequencing, ticketing, and seating are not included.",
    },
    ["auctionName", "auctionUrl", "opensAt", "closesAt", "dashboardUrl"],
  ),
  app(
    "organizer-auction-closed",
    "Auction closed summary",
    "Send the organizer a closeout summary and next actions.",
    "Organizer",
    "{{auctionName}} has closed",
    {
      preheader: "Review winners, invoices, payments, and fulfillment.",
      eyebrow: "Auction closed",
      title: "Bidding has ended",
      body:
        p(
          "<strong>{{auctionName}}</strong> is closed. Review the results before creating winner invoices.",
        ) +
        details([
          ["Winning bids", "{{winningBidTotal}}"],
          ["Winners", "{{winnerCount}}"],
          ["Items sold", "{{itemsSold}}"],
          ["Unpaid invoices", "{{unpaidInvoiceCount}}"],
        ]),
      cta: { label: "Review closeout", href: "{{closeoutUrl}}" },
      secondary:
        "Give Holidays fulfillment begins only after the winning bidder’s payment is confirmed.",
    },
    [
      "auctionName",
      "winningBidTotal",
      "winnerCount",
      "itemsSold",
      "unpaidInvoiceCount",
      "closeoutUrl",
    ],
  ),
  app(
    "sponsor-fee-invitation",
    "Transaction fee sponsor invitation",
    "Invite a business to review a capped event fee sponsorship agreement.",
    "Organizer",
    "An invitation to support {{auctionName}} as a Transaction Fee Sponsor",
    {
      preheader: "Review a sponsorship invitation from {{organizationName}}.",
      eyebrow: "A special invitation",
      title: "Help more of every dollar make a difference",
      body:
        p("Hello {{sponsorContactName}},") +
        p(
          "<strong>{{organizationName}}</strong> would like to invite <strong>{{sponsorBusinessName}}</strong> to participate as an Official Transaction Fee Sponsor for <strong>{{auctionName}}</strong>.",
        ) +
        p(
          "By helping cover eligible event transaction fees, your business can help direct more fundraising proceeds toward the mission.",
        ) +
        details([
          ["Event", "{{auctionName}}"],
          ["Organization", "{{organizationName}}"],
          ["Requested coverage", "{{coverageLabel}}"],
          ["Proposed maximum", "{{maximumCommitment}}"],
          ["Coverage period", "{{coveragePeriod}}"],
        ]) +
        notice("{{invitationMessage}}"),
      cta: {
        label: "Review sponsorship invitation",
        href: "{{invitationUrl}}",
      },
      secondary:
        "Your card will not be charged merely by opening this invitation. Future charges require the explicit authorization shown in the secure sponsor portal.",
    },
    [
      "sponsorContactName",
      "organizationName",
      "sponsorBusinessName",
      "auctionName",
      "coverageLabel",
      "maximumCommitment",
      "coveragePeriod",
      "invitationMessage",
      "invitationUrl",
    ],
  ),
  app(
    "sponsor-authorization-confirmed",
    "Sponsor authorization confirmation",
    "Confirm the approved categories, cap, and billing terms after sponsor authorization.",
    "Organizer",
    "Your fee sponsorship for {{auctionName}} is confirmed",
    {
      preheader: "Keep a copy of your approved Gather sponsorship terms.",
      eyebrow: "Sponsorship authorized",
      title: "Thank you for supporting the mission",
      body:
        p(
          "<strong>{{sponsorBusinessName}}</strong> has authorized a transaction fee sponsorship benefiting <strong>{{organizationName}}</strong>.",
        ) +
        details([
          ["Event", "{{auctionName}}"],
          ["Fee coverage", "{{coverageLabel}}"],
          ["Maximum commitment", "{{maximumCommitment}}"],
          ["Billing schedule", "End-of-event settlement"],
          ["Status", "{{agreementStatus}}"],
        ]),
      cta: { label: "Open sponsor portal", href: "{{portalUrl}}" },
      secondary:
        "The authorized maximum is a hard cap. Gather will not exceed it without an additional approved agreement. A saved payment method is not an immediate charge.",
    },
    [
      "sponsorBusinessName",
      "organizationName",
      "auctionName",
      "coverageLabel",
      "maximumCommitment",
      "agreementStatus",
      "portalUrl",
    ],
  ),
  app(
    "private-message",
    "Private message",
    "Notify a participant after an in-app message is safely stored.",
    "Organizer",
    "New message about {{conversationSubject}}",
    {
      preheader: "You have a new private message in Gather.",
      eyebrow: "Gather Messages",
      title: "You have a new message",
      body:
        p(
          "<strong>{{senderName}}</strong> sent a message about <strong>{{conversationSubject}}</strong>.",
        ) + notice("{{messagePreview}}"),
      cta: { label: "Open conversation", href: "{{conversationUrl}}" },
      secondary:
        "Reply securely in Gather. This is a private conversation between the bidder and the nonprofit organizer.",
    },
    ["senderName", "conversationSubject", "messagePreview", "conversationUrl"],
  ),
  app(
    "event-announcement",
    "Event announcement",
    "Deliver an organizer announcement to a supported auction audience.",
    "Organizer",
    "{{announcementTitle}} — {{auctionName}}",
    {
      preheader: "An update from your auction organizer.",
      eyebrow: "Auction announcement",
      title: "{{announcementTitle}}",
      body:
        p(
          "An update from <strong>{{organizationName}}</strong> about <strong>{{auctionName}}</strong>:",
        ) + notice("{{announcementBody}}"),
      cta: { label: "Open auction", href: "{{auctionUrl}}" },
      secondary:
        "This announcement was sent through Gather to registered auction participants.",
    },
    [
      "announcementTitle",
      "auctionName",
      "organizationName",
      "announcementBody",
      "auctionUrl",
    ],
  ),
  app(
    "reply-to-verification",
    "Verify reply-to address",
    "Verify ownership before an organization reply-to address is activated.",
    "Organizer",
    "Verify your Gather reply-to email",
    {
      preheader:
        "Verify this email before Gather uses it as a reply-to address.",
      eyebrow: "Organization email settings",
      title: "Verify your reply-to address",
      body:
        p(
          "A Gather organizer requested to use <strong>{{replyToEmail}}</strong> as the reply-to address for <strong>{{organizationName}}</strong>.",
        ) + p("Confirm ownership using the secure button below."),
      cta: { label: "Verify email address", href: "{{verificationUrl}}" },
      secondary:
        "If you did not request this change, ignore this email. The address will not be activated.",
    },
    ["replyToEmail", "organizationName", "verificationUrl"],
  ),
  app(
    "receipt-settings-test",
    "Receipt preview",
    "Send the organizer a safe preview of current email and receipt settings.",
    "Organizer",
    "Gather receipt preview — {{organizationName}}",
    {
      preheader: "Preview your organization’s Gather receipt branding.",
      eyebrow: "Receipt preview",
      title: "{{thankYouHeading}}",
      body:
        p("{{thankYouMessage}}") +
        details([
          ["Sample receipt", "GTH-PREVIEW"],
          ["Sample total", "$125.00"],
          ["Status", "Preview only"],
        ]),
      cta: { label: "Open email settings", href: "{{settingsUrl}}" },
      secondary: "{{receiptFooter}}",
    },
    [
      "organizationName",
      "thankYouHeading",
      "thankYouMessage",
      "settingsUrl",
      "receiptFooter",
    ],
  ),
];

const samples: Record<string, string> = {
  firstName: "Avery",
  guestName: "Avery Reed",
  quantity: "1",
  offerUrl: "https://gatherforgood.bid/travel",
  auctionName: "Spring for Good Auction",
  organizationName: "Community Fund",
  opensAt: "April 12 at 9:00 AM",
  closesAt: "April 19 at 8:00 PM",
  auctionUrl:
    "https://gatherforgood.bid/n/community-fund/auction/spring-for-good",
  itemTitle: "Five nights in Tuscany",
  currentBid: "$2,450",
  maximumBid: "$3,000",
  minimumBid: "$2,500",
  timeRemaining: "2 hours, 14 minutes",
  itemUrl: "https://gatherforgood.bid/auction/item/tuscany",
  myBidsUrl: "https://gatherforgood.bid/my-bids",
  watchlistSummary:
    "Two watched items have active bids. You are leading on one item.",
  itemSummary: "Five nights in Tuscany · Winning bid $2,850",
  myWinsUrl: "https://gatherforgood.bid/my-wins",
  hammerSubtotal: "$3,600.00",
  bidderFee: "$90.00",
  processingFee: "$0.00 (paid by nonprofit)",
  totalDue: "$3,690.00",
  dueDate: "April 26, 2027",
  checkoutUrl: "https://gatherforgood.bid/my-wins",
  bidderName: "Avery Reed",
  bidderEmail: "avery@example.org",
  receiptNumber: "GTH-10482",
  amountPaid: "$3,690.00",
  paymentStatus: "Paid",
  transactionId: "pi_3GatherExample",
  paidAt: "April 20, 2027",
  paymentMethod: "Stripe checkout",
  fulfillmentInstructions:
    "The nonprofit will provide pickup details. Give Holidays will contact you separately for paid travel experiences.",
  itemOrInvoice: "Spring for Good winner invoice",
  refundAmount: "$250.00",
  refundReference: "RF-83921",
  refundReason: "Organizer-approved partial refund",
  packageTitle: "Five nights in Tuscany",
  destination: "Tuscany, Italy",
  staySummary: "5 nights · 2 travelers",
  expirationDate: "October 20, 2028",
  claimUrl: "https://gatherforgood.bid/my-wins",
  travelerNames: "Avery Reed and Jordan Reed",
  preferredDates: "September 8–13 or September 22–27",
  bookingLeadTime: "60 days",
  confirmationReference: "GH-IT-42891",
  confirmedDates: "September 8–13, 2027",
  dashboardUrl: "https://gatherforgood.bid/admin",
  winningBidTotal: "$48,750",
  winnerCount: "34",
  itemsSold: "52",
  unpaidInvoiceCount: "7",
  closeoutUrl: "https://gatherforgood.bid/closeout",
  conversationSubject: "Five nights in Tuscany",
  senderName: "Avery Reed",
  messagePreview: "Could you clarify the booking deadline?",
  conversationUrl: "https://gatherforgood.bid/messages",
  announcementTitle: "Pickup details are ready",
  announcementBody:
    "Please review the pickup window and location before arriving.",
  replyToEmail: "events@communityfund.org",
  verificationUrl:
    "https://gatherforgood.bid/api/email-settings/verify?token=preview",
  thankYouHeading: "Thank you for supporting our mission",
  thankYouMessage: "Your generosity makes our community programs possible.",
  settingsUrl: "https://gatherforgood.bid/admin/settings/email-receipts",
  receiptFooter: "Keep this receipt for your records.",
  sponsorContactName: "Morgan Lee",
  sponsorBusinessName: "ABC Company",
  coverageLabel: "Gather platform and eligible payment-processing fees",
  maximumCommitment: "$2,500.00",
  coveragePeriod: "Through event closeout",
  invitationMessage: "We would be honored to recognize your support.",
  invitationUrl: "https://gatherforgood.bid/sponsor/invitation/example",
  agreementStatus: "Active",
  portalUrl: "https://gatherforgood.bid/sponsor/portal",
};
const supabaseSamples: Record<string, string> = {
  ".Email": "avery@example.org",
  ".NewEmail": "avery.new@example.org",
  ".OldEmail": "avery@example.org",
  ".Phone": "+1 (303) 555-0142",
  ".OldPhone": "+1 (303) 555-0108",
  ".Provider": "Google",
  ".FactorType": "Authenticator app",
  ".Token": "482193",
  ".ConfirmationURL": "https://gatherforgood.bid/auth/callback?code=preview",
  ".SiteURL": "https://gatherforgood.bid",
};

export function previewTemplate(template: EmailTemplate) {
  let html = template.html,
    subject = template.subject;
  for (const [key, value] of Object.entries({
    ...samples,
    ...supabaseSamples,
  })) {
    html = html
      .replaceAll(`{{${key}}}`, value)
      .replaceAll(`{{ ${key} }}`, value);
    subject = subject
      .replaceAll(`{{${key}}}`, value)
      .replaceAll(`{{ ${key} }}`, value);
  }
  return { ...template, html, subject };
}
export function renderEmailTemplate(
  id: string,
  values: Record<string, string>,
) {
  const template = emailTemplates.find((item) => item.id === id);
  if (!template) throw new Error(`Unknown email template: ${id}`);
  let html = template.html,
    subject = template.subject;
  for (const variable of template.variables) {
    const value = values[variable];
    if (value === undefined)
      throw new Error(`Missing email variable: ${variable}`);
    html = html
      .replaceAll(`{{${variable}}}`, esc(value))
      .replaceAll(`{{ ${variable} }}`, esc(value));
    const subjectValue = value.replace(/[\r\n]+/g, " ");
    subject = subject
      .replaceAll(`{{${variable}}}`, subjectValue)
      .replaceAll(`{{ ${variable} }}`, subjectValue);
  }
  return { subject, html };
}
export function supabaseEmailConfig() {
  return Object.fromEntries(
    emailTemplates
      .filter((template) => template.provider === "Supabase Auth")
      .flatMap((template) => [
        [template.providerKey!, template.html],
        [template.subjectKey!, template.subject],
      ]),
  );
}
