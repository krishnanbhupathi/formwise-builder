import { expect, test } from "@playwright/test";

test("save, publish, fill in the public link, then read and export the submission", async ({ page, context, browserName }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Save form" }).click();
  await expect(page).toHaveURL(/\/edit\/[2-9a-z]{10}#.{43}$/);
  const editUrl = page.url();
  const id = new URL(editUrl).pathname.split("/")[2]!;
  await expect(page.getByRole("status").filter({ hasText: "All changes saved" })).toBeVisible();

  // Edit → autosave.
  await page.getByRole("textbox", { name: "Title" }).fill("E2E intake");
  await expect(page.getByText("All changes saved")).toBeVisible();

  // Not live until published.
  const visitor = await context.newPage();
  await visitor.goto(`/f/${id}`);
  await expect(visitor.getByText("This form isn't available")).toBeVisible();

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const share = page.getByRole("dialog", { name: "Share" });
  await expect(share.getByRole("textbox", { name: "Public link" })).toHaveValue(new RegExp(`/f/${id}$`));
  await share.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Published" })).toBeDisabled();

  // A later edit doesn't change the live form until "Publish changes".
  await page.getByRole("textbox", { name: "Title" }).fill("E2E intake v2");
  await expect(page.getByRole("button", { name: "Publish changes" })).toBeEnabled();

  // Visitor fills in v1.
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "E2E intake" })).toBeVisible();
  await visitor.getByLabel(/Student's name/).fill("Robin, Jr");
  await visitor.getByLabel(/Parent or student email/).fill("robin@example.com");
  await visitor.getByLabel(/Level/).selectOption("A-level");
  await visitor.getByLabel(/Exam board/).fill("OCR");
  await visitor.getByLabel(/I agree/).check();
  await visitor.getByRole("button", { name: "Submit" }).click();
  await expect(visitor.getByText("Thanks, your answers were sent.")).toBeVisible();

  // Owner reads it.
  await page.getByRole("link", { name: "Submissions" }).click();
  await expect(page.getByText("1 submission")).toBeVisible();
  const row = page.getByRole("row").nth(1);
  await expect(row).toContainText("Robin, Jr");
  await expect(row).toContainText("OCR");
  await expect(row).toContainText("v1");

  if (browserName === "chromium") {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("E2E-intake-v2-submissions.csv");
    const csv = await (await import("node:fs/promises")).readFile((await file.path())!, "utf8");
    expect(csv).toContain('"Robin, Jr",robin@example.com,A-level,OCR');
  }

  // The edit link works in a fresh browser (no localStorage), and a bad token doesn't.
  const other = await (await page.context().browser()!.newContext()).newPage();
  await other.goto(editUrl.replace("#", "/submissions#"));
  await expect(other.getByText("1 submission")).toBeVisible();
  await other.goto(`/edit/${id}#not-the-token`);
  await expect(other.getByText("This edit link isn't valid.")).toBeVisible();
});

test("a second tab's stale save is refused, not silently overwritten", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Save form" }).click();
  await expect(page).toHaveURL(/\/edit\//);
  const tabB = await context.newPage();
  await tabB.goto(page.url());
  await expect(tabB.getByText("All changes saved")).toBeVisible();

  await page.getByRole("textbox", { name: "Title" }).fill("From tab A");
  await expect(page.getByText("All changes saved")).toBeVisible();

  await tabB.getByRole("textbox", { name: "Title" }).fill("From tab B");
  await expect(tabB.getByText("Edited elsewhere")).toBeVisible();
  await expect(tabB.getByRole("button", { name: "Reload" })).toBeVisible();
});
