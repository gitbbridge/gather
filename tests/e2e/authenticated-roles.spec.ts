import { expect, test, type Page } from "@playwright/test";
import { stagingSession } from "../helpers/staging-session.mjs";

const password = process.env.SANDBOX_DEMO_PASSWORD || "";
const organizerEmail =
  process.env.STAGING_ORGANIZER_EMAIL || "nonprofit@giveholidays.com";
const bidderEmail =
  process.env.STAGING_BIDDER_EMAIL || "bidder@giveholidays.com";
const administratorEmail =
  process.env.STAGING_ADMIN_EMAIL || "admin@giveholidays.com";
const origin = process.env.GATHER_TEST_ORIGIN || "http://127.0.0.1:8787";

async function signIn(
  page: Page,
  email: string,
  returnTo: string,
) {
  await page.goto(`/auth?return_to=${encodeURIComponent(returnTo)}`, {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
}

test.describe("authenticated role routing", () => {
  test.skip(!password, "SANDBOX_DEMO_PASSWORD is required for role coverage.");

  test.beforeAll(async ({ request }) => {
    const cookie = await stagingSession(organizerEmail, {
      accountType: "organizer",
    });
    const existingResponse = await request.get("/api/auction", {
      headers: { cookie },
    });
    expect(existingResponse.ok(), await existingResponse.text()).toBeTruthy();
    const existing = (await existingResponse.json()) as { list?: unknown[] };
    if (existing.list?.length) return;
    const isoDate = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const response = await request.post("/api/auction", {
      headers: { cookie, origin },
      data: {
        action: "create",
        key: crypto.randomUUID(),
        name: "Browser role verification",
        organization: "Browser Verification Fund",
        openDate: isoDate(-1),
        closeDate: isoDate(7),
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  });

  test("an existing organizer lands in the organizer workspace", async ({
    page,
  }) => {
    await signIn(page, organizerEmail, "/onboarding");
    await expect(page).toHaveURL(/\/admin(?:\?|$)/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Your auction at a glance" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Auction page", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Supporters" })).toBeVisible();
  });

  test("a bidder is routed away from the organizer workspace", async ({
    page,
  }) => {
    await stagingSession(bidderEmail, { accountType: "supporter" });
    await signIn(page, bidderEmail, "/admin");
    await expect(page).toHaveURL(/\/account(?:\?|$)/, { timeout: 15_000 });
    await expect(page.getByText("SUPPORTER HOME")).toBeVisible();
    await expect(page.getByText("My wins & purchases")).toBeVisible();
    await expect(page.getByText("Your nonprofit auctions")).toBeVisible();
  });

  test("a platform administrator reaches the administration workspace", async ({
    page,
  }) => {
    await signIn(page, administratorEmail, "/admin");
    await expect(page).toHaveURL(/\/admin(?:\?|$)/, { timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: "Email templates", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toBeVisible();

    await page.goto("/admin/give-holidays");
    await expect(
      page.getByRole("heading", { name: "Give Holidays catalog" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Auction fulfillment" }),
    ).toBeVisible();

    await page.goto("/admin/give-holidays/fulfillments");
    await expect(
      page.getByRole("heading", { name: "Travel fulfillment" }),
    ).toBeVisible();
  });
});
