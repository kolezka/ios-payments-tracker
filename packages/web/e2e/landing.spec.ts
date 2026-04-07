import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows hero and CTA for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /track every/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view on github/i })).toBeVisible();
  });

  test("shows feature cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Wallet Automation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fully Private" })).toBeVisible();
  });

  test("Get started links to login", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /get started/i });
    await expect(link).toHaveAttribute("href", "/login");
  });
});
