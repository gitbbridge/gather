import { expect, test } from "@playwright/test";

test.describe("public launch surfaces", () => {
  test("approved Gather homepage is present and routes to travel", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Raise more with an auction that’s easier to run.",
      }),
    ).toBeVisible();
    await expect(page.getByText("5% platform fee, capped at $100 per item.")).toBeVisible();

    const travelLink = page.getByRole("link", { name: "About Give Holidays" });
    await expect(travelLink).toHaveAttribute("href", "/about/give-holidays");
    await travelLink.click();
    await expect(page).toHaveURL(/\/about\/give-holidays$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Exceptional Travel Packages for Charity Auctions",
      }),
    ).toBeVisible();
  });

  test("help, privacy, and support pages remain reachable", async ({ page }) => {
    for (const [path, heading] of [
      ["/help", "Help Center"],
      ["/legal/privacy", "Privacy Policy"],
      ["/support", "Contact Support"],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.ok(), `${path} should return a successful response`).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("protected organizer pages send signed-out visitors through auth", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\?return_to=%2Fadmin$/);
    await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  });

  test("layout does not overflow the viewport", async ({ page }) => {
    for (const path of ["/", "/about/give-holidays", "/help", "/auth?return_to=%2Fadmin"]) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, `${path} should not scroll horizontally`).toBeLessThanOrEqual(
        dimensions.viewport + 1,
      );
    }
  });
});
