import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("shows magic link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /payment tracker/i })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("requires email to submit", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByPlaceholder("you@example.com");
    await expect(emailInput).toHaveAttribute("required", "");
  });
});
