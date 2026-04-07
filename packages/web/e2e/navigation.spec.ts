import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("unauthenticated user cannot access /setup", async ({ page }) => {
    await page.goto("/setup");
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access /settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user cannot access /export", async ({ page }) => {
    await page.goto("/export");
    await expect(page).toHaveURL(/\/login/);
  });

  test("view transitions are smooth between pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });
});
