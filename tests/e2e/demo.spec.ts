import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";

async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin PIN").fill(process.env.ADMIN_PIN!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "A smoother break starts here." }),
  ).toBeVisible();
  await expect(page.locator(".stat-card").first()).toBeVisible();
}
async function freshQueue(page: Page) {
  await page.goto("/admin/settings");
  await page
    .getByRole("button", { name: "Start new queue", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start new queue", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "New queue started" }),
  ).toBeVisible();
}

test("judge flow: auto token, duplicate scan, live admin, next, serving, completed, QR and history", async ({
  page,
  browser,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (err) => failures.push(err.message));
  await login(page);
  await freshQueue(page);
  await page.getByRole("button", { name: "Load demo queue" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Demo ready" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page.locator(".serving-number")).toHaveText("Q-001");
  await expect(page.locator(".queue-row")).toHaveCount(4);

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const student = await phone.newPage();
  student.on("pageerror", (err) => failures.push(err.message));
  await student.goto("/join/canteen");
  await expect(student).toHaveURL(/\/token\/[0-9a-f-]+/);
  const tokenUrl = student.url();
  await expect(student.locator(".student-token-number")).toHaveText("Q-006");
  await expect(student.locator(".position>strong")).toHaveText("4");
  await expect(
    page.locator(".queue-row").filter({ hasText: "Q-006" }),
  ).toBeVisible();
  await student.reload();
  await expect(student.locator(".student-token-number")).toHaveText("Q-006");
  await student.goto("/join/canteen");
  await expect(student).toHaveURL(tokenUrl);
  await expect(page.locator(".queue-row")).toHaveCount(5);
  await page.screenshot({
    path: "test-results/admin-desktop.png",
    fullPage: true,
  });
  await student.screenshot({
    path: "test-results/student-waiting.png",
    fullPage: true,
  });
  for (const ahead of [3, 2, 1, 0]) {
    await page.getByRole("button", { name: "Complete & call next" }).click();
    await expect(student.locator(".position>strong")).toHaveText(String(ahead));
    if (ahead === 2)
      await expect(
        student.getByRole("heading", { name: "Almost there." }),
      ).toBeVisible();
    if (ahead <= 1)
      await expect(
        student.getByRole("heading", { name: "You’re next." }),
      ).toBeVisible();
  }
  await page.getByRole("button", { name: "Complete & call next" }).click();
  await expect(
    student.getByRole("heading", { name: "It’s your turn!" }),
  ).toBeVisible();
  await expect(student.locator(".proceed")).toContainText("Counter 01");
  await student.screenshot({
    path: "test-results/student-serving.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Complete & call next" }).click();
  await expect(
    student.getByRole("heading", { name: "All done!" }),
  ).toBeVisible();
  await page.goto("/admin/history");
  await expect(
    page.getByRole("row").filter({ hasText: "Q-006" }).first(),
  ).toContainText("completed");
  await page.goto("/admin/display");
  const qr = page.getByRole("img", { name: /Scan to automatically get/ });
  await expect(qr).toBeVisible();
  const src = await qr.getAttribute("src");
  const png = PNG.sync.read(Buffer.from(src!.split(",")[1], "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded?.data).toBe(`${process.env.NEXT_PUBLIC_APP_URL}/join/canteen`);
  await page.screenshot({
    path: "test-results/qr-display.png",
    fullPage: true,
  });
  await phone.close();
  expect(failures).toEqual([]);
});

test("paused/closed admissions, protected APIs, skipped tokens, and invalid URLs", async ({
  page,
  browser,
  request,
}) => {
  const unauthorized = await request.get("/api/queue?admin=1");
  expect(unauthorized.status()).toBe(401);
  const noOrigin = await request.post("/api/admin/action", { data: {} });
  expect(noOrigin.status()).toBe(403);
  const badPin = await request.post("/api/admin/login", {
    headers: { Origin: "http://localhost:3000" },
    data: { pin: "wrong-pin" },
  });
  expect(badPin.status()).toBe(401);
  await login(page);
  await freshQueue(page);
  await page.getByRole("button", { name: "Paused Take a short break" }).click();
  await expect(
    page.getByRole("button", { name: "Paused Take a short break" }),
  ).toHaveAttribute("aria-pressed", "true");
  const phone = await browser.newContext();
  const student = await phone.newPage();
  await student.goto("/join/canteen");
  await expect(student.locator(".error-notice")).toContainText("short pause");
  await page.getByRole("button", { name: "Closed Done for now" }).click();
  await expect(
    page.getByRole("button", { name: "Closed Done for now" }),
  ).toHaveAttribute("aria-pressed", "true");
  await student.reload();
  await expect(student.locator(".error-notice")).toContainText(
    "currently closed",
  );
  await page.getByRole("button", { name: "Open Welcome new scans" }).click();
  await expect(
    page.getByRole("button", { name: "Open Welcome new scans" }),
  ).toHaveAttribute("aria-pressed", "true");
  await student.reload();
  await expect(student.locator(".student-token-number")).toHaveText("Q-001");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Call next", exact: true }).click();
  await expect(
    student.getByRole("heading", { name: "It’s your turn!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip this token" }).click();
  await expect(
    student.getByRole("heading", { name: "We missed you." }),
  ).toBeVisible();
  await student.goto("/token/not-a-valid-id");
  await expect(student.locator(".error-notice")).toContainText("couldn’t find");
  await phone.close();
});

test("simultaneous HTTP joins and same-browser tabs remain unique", async ({
  page,
  browser,
  playwright,
}) => {
  await login(page);
  await freshQueue(page);
  const clients = await Promise.all(
    Array.from({ length: 12 }, () =>
      playwright.request.newContext({
        baseURL: "http://localhost:3000",
        extraHTTPHeaders: { Origin: "http://localhost:3000" },
      }),
    ),
  );
  const joined = await Promise.all(
    clients.map(async (c) => {
      await c.post("/api/session");
      const response = await c.post("/api/join");
      expect(response.ok()).toBe(true);
      return response.json();
    }),
  );
  expect(new Set(joined.map((j) => j.id)).size).toBe(12);
  const phone = await browser.newContext();
  const tabs = await Promise.all([phone.newPage(), phone.newPage()]);
  await Promise.all(tabs.map((tab) => tab.goto("/join/canteen")));
  await Promise.all(tabs.map((tab) => expect(tab).toHaveURL(/\/token\//)));
  expect(tabs[0].url()).toBe(tabs[1].url());
  await phone.close();
  await Promise.all(clients.map((c) => c.dispose()));
});

test("mobile layouts and automatic recovery after a network interruption", async ({
  page,
  browser,
}) => {
  await login(page);
  await freshQueue(page);
  await page.getByRole("button", { name: "Load demo queue" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Demo ready" }),
  ).toBeVisible();
  await page.goto("/admin");
  const phone = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
  });
  const student = await phone.newPage();
  await student.goto("/join/canteen");
  await expect(student.locator(".student-token-number")).toHaveText("Q-006");
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [393, 852],
    [430, 932],
  ]) {
    await student.setViewportSize({ width, height });
    expect(
      await student.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(student.locator(".token-card")).toBeVisible();
  }
  await phone.setOffline(true);
  await expect(
    student.getByText("Reconnecting…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete & call next" }).click();
  await phone.setOffline(false);
  await expect(student.locator(".position>strong")).toHaveText("3");
  await expect(student.locator(".error-notice")).toHaveCount(0);
  await phone.close();
  for (const route of [
    "/",
    "/admin",
    "/admin/settings",
    "/admin/history",
    "/admin/display",
  ]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/landing-desktop.png",
    fullPage: true,
  });
  // Leave a fresh, ready-to-present queue after the automated demo.
  await freshQueue(page);
  await page.getByRole("button", { name: "Load demo queue" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Demo ready" }),
  ).toBeVisible();
});
