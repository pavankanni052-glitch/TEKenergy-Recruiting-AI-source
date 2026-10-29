import { test, expect } from "@playwright/test";
test("demo recruiter can sign in and reach the dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in to demo" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Human approval required for outreach")).toBeVisible();
});
