import { expect, test, type Locator, type Page } from "@playwright/test";

/** The clickable card body (has aria-pressed; the drag handle doesn't). */
const card = (page: Page, name: string) => questions(page).filter({ hasText: name }).locator("button[aria-pressed]");
const questions = (page: Page) => page.getByRole("list", { name: "Questions" }).getByRole("listitem");

/** dnd-kit needs real intermediate pointer moves to pass its activation distance. */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 5 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
  await page.mouse.up();
}

const questionNames = (page: Page) =>
  questions(page).evaluateAll((items) => items.map((li) => li.querySelector("button[aria-pressed] .truncate")?.textContent ?? ""));

test("build a form with clicks and keyboard, then fill it in the preview", async ({ page }) => {
  await page.goto("/");
  await expect(questions(page)).toHaveCount(6);

  // Click-to-add inserts after the selected question and selects the new one.
  await card(page, "Student's name").click();
  await page.getByRole("button", { name: "Add Number" }).click();
  await expect(questions(page)).toHaveCount(7);
  const question = page.getByRole("textbox", { name: "Question", exact: true });
  await question.fill("Age");
  await page.getByRole("checkbox", { name: "Required", exact: true }).check();
  await page.getByRole("spinbutton", { name: "Minimum" }).fill("5");
  await expect((await questionNames(page))[1]).toBe("Age");

  // Keyboard reorder: focus the handle, Space to lift, ArrowDown, Space to drop.
  await page.getByRole("button", { name: /^Move Age/ }).focus();
  const live = page.locator("#DndLiveRegion-0");
  await page.keyboard.press("Space");
  await expect(live).toContainText("“Age” is at position 2");
  await page.keyboard.press("ArrowDown");
  await expect(live).toContainText("is over “Parent or student email”");
  await page.keyboard.press("Space");
  await expect(live).toContainText("Dropped “Age”");
  await expect.poll(() => questionNames(page)).toEqual([
    "Student's name",
    "Parent or student email",
    "Age",
    "Level",
    "Exam board",
    "What would you like to work on?",
    "I agree to lessons being scheduled by email",
  ]);

  // Live preview uses the real renderer: conditional field + validation.
  await page.getByRole("tab", { name: "Preview" }).click();
  const preview = page.getByRole("tabpanel");
  await expect(preview.getByLabel(/Exam board/)).toHaveCount(0);
  await preview.getByLabel(/Level/).selectOption("A-level");
  await expect(preview.getByLabel(/Exam board/)).toBeVisible();
  await preview.getByLabel(/Age/).fill("3");
  await preview.getByRole("button", { name: "Test submit" }).click();
  await expect(preview.getByText("Must be at least 5")).toBeVisible();

  await preview.getByLabel(/Student's name/).fill("Sam");
  await preview.getByLabel(/email/i).first().fill("sam@example.com");
  await preview.getByLabel(/Age/).fill("15");
  await preview.getByLabel(/Exam board/).fill("AQA");
  await preview.getByLabel(/I agree/).check();
  await preview.getByRole("button", { name: "Test submit" }).click();
  await expect(preview.getByRole("status")).toContainText('"f_board": "AQA"');
});

test("drag a field type from the palette and reorder by mouse", async ({ page, isMobile }) => {
  test.skip(isMobile, "the palette is a horizontal strip on phones; adding there is click-to-add (covered above)");
  await page.goto("/");

  await drag(page, page.getByRole("button", { name: "Add Date" }), questions(page).nth(1));
  await expect(questions(page)).toHaveCount(7);
  expect((await questionNames(page))[1]).toBe("Untitled question");
  await expect(page.getByRole("heading", { name: "Date settings" })).toBeVisible();

  // Drag "Exam board" above "Level": its condition would point downwards, so it's removed with a notice.
  await drag(page, page.getByRole("button", { name: /^Move Exam board/ }), page.getByRole("button", { name: /^Move Level/ }));
  await expect.poll(async () => (await questionNames(page)).indexOf("Exam board")).toBeLessThan((await questionNames(page)).indexOf("Level"));
  await expect(page.getByRole("status").first()).toContainText('Removed the show-if condition from "Exam board"');
});

test("deleting a question others depend on clears their condition", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Delete Level" }).click();
  await expect(questions(page)).toHaveCount(5);
  await expect(page.getByText(/Removed the show-if condition from "Exam board"/)).toBeVisible();
  await expect(page.getByText(/Shown if/)).toHaveCount(0);
});

test("set a condition in the properties panel", async ({ page }) => {
  await page.goto("/");
  await card(page, "What would you like to work on?").click();
  await page.getByLabel("Show this question").selectOption({ label: "Only if “Level”…" });
  await page.getByLabel("is", { exact: true }).selectOption({ label: "is “GCSE”" });
  await expect(questions(page).nth(4)).toContainText("Shown if “Level” matches");

  await page.getByRole("tab", { name: "Preview" }).click();
  const preview = page.getByRole("tabpanel");
  await expect(preview.getByLabel(/work on/)).toHaveCount(0);
  await preview.getByLabel(/Level/).selectOption("GCSE");
  await expect(preview.getByLabel(/work on/)).toBeVisible();
});

test("undo and redo: typing is one step, a deletion restores its condition", async ({ page }) => {
  await page.goto("/");
  await card(page, "Student's name").click();
  const question = page.getByRole("textbox", { name: "Question", exact: true });
  await question.fill("");
  await question.pressSequentially("Full name");
  await expect(questions(page).first()).toContainText("Full name");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(questions(page).first()).toContainText("Student's name");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(questions(page).first()).toContainText("Full name");

  await page.getByRole("button", { name: "Delete Level" }).click();
  await expect(page.getByText(/Shown if/)).toHaveCount(0);
  await page.locator("body").press("ControlOrMeta+z");
  await expect(questions(page)).toHaveCount(6);
  await expect(questions(page).filter({ hasText: "Exam board" })).toContainText("Shown if “Level” matches");
});
