import { test, expect } from "@playwright/test";

// Full user flow: sign in → create a project with content → open the export
// view → validate the generated OpenAPI spec → see the success result. Stays
// inside the SPA (no reloads) so the active project persists across navigation.
//
// Credentials default to the e2e/compose admin; override with
// E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD.
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "e2e-admin-not-secret";

test("create a project and validate its generated spec", async ({ page }) => {
  await page.goto("/");

  // ── Sign in ──────────────────────────────────────────────
  await page.getByPlaceholder("Admin username").fill(ADMIN_USERNAME);
  await page.getByPlaceholder("Admin password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // ── Create a project with real content ───────────────────
  // The starter project ships with endpoints + a schema, so its generated spec
  // is non-trivial and valid. Creating it navigates into the editor.
  await page
    .getByRole("button", { name: /starter project/i })
    .first()
    .click();

  // We should land in the editor; its header has an "Export Spec" button.
  const exportButton = page.getByRole("button", { name: /export spec/i });
  await expect(exportButton).toBeVisible({ timeout: 15_000 });
  await exportButton.click();

  // ── Validate the generated spec ──────────────────────────
  // The Validate button stays disabled until the spec has loaded.
  const validateButton = page.getByRole("button", { name: /^validate$/i });
  await expect(validateButton).toBeEnabled({ timeout: 15_000 });
  await validateButton.click();

  await expect(page.getByText(/spec is valid openapi/i)).toBeVisible();
});
