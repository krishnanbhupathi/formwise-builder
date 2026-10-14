import { expect, test } from "@playwright/test";

// Locally this runs against the fake model (FORMWISE_FAKE_AI=1); against a deployment it uses Claude.
test("describe a form, get it on the canvas, and undo back", async ({ page }) => {
  test.skip(!!process.env.E2E_BASE_URL, "uses the deterministic fake model; run manually against production");
  await page.goto("/");
  const questions = page.getByRole("list", { name: "Questions" }).getByRole("listitem");
  await expect(questions).toHaveCount(6);

  await page.getByRole("button", { name: "Describe" }).click();
  const dialog = page.getByRole("dialog", { name: "Describe your form" });
  await expect(dialog.getByRole("button", { name: "Generate form" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Event RSVP" }).click();
  await dialog.getByRole("button", { name: "Generate form" }).click();

  await expect(dialog).toBeHidden();
  await expect(questions).toHaveCount(4);
  await expect(questions.filter({ hasText: "Which topic?" })).toContainText("Shown if “Topic” matches");
  await expect(page.getByRole("status").first()).toContainText("with 4 questions");

  // The generated form works in the live preview, condition included.
  await page.getByRole("tab", { name: "Preview" }).click();
  const preview = page.getByRole("tabpanel");
  await expect(preview.getByLabel(/Which topic/)).toHaveCount(0);
  await preview.getByLabel(/^Topic/).selectOption("Other");
  await expect(preview.getByLabel(/Which topic/)).toBeVisible();

  await page.locator("body").press("ControlOrMeta+z");
  await expect(questions).toHaveCount(6);
  await expect(questions.first()).toContainText("Student's name");
});
