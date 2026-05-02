import { expect, test } from "@playwright/test";

test.describe("Auth and routing smoke", () => {
  test("renders auth page input", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("#identifier")).toBeVisible();
  });

  test("redirects /login to /auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator("#identifier")).toBeVisible();
  });

  test("redirects unauthenticated /portal to /auth", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.locator("#identifier")).toBeVisible();
  });

  test("auth page is not stuck on loader", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText("Loading…")).toHaveCount(0);
  });
});
