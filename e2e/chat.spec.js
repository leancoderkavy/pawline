import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ids } from "./chat-fixture.mjs";

const evidence = name => join(tmpdir(), `pawline-chat-${name}.png`);
const api = async (context, user, route, data, method = "POST") => {
  const response = await context.request.fetch(`/api/${route}`, { method, headers: { Authorization: `Bearer fixture:${user}` }, ...(data ? { data } : {}) });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
};

test.beforeEach(async ({ request }) => {
  for (const listingId of [ids.pet, ids.otherPet]) await api({ request }, "adopter", "direct-conversations", { listingId });
});

test("adopter and shelter can message, manage questions and complete a real WebRTC call", async ({ browser }) => {
  const adopterContext = await browser.newContext({ permissions: ["camera", "microphone"], baseURL: `http://127.0.0.1:${process.env.PAWLINE_CHAT_PORT || 4317}`, viewport: { width: 1280, height: 850 } });
  const shelterContext = await browser.newContext({ permissions: ["camera", "microphone"], baseURL: `http://127.0.0.1:${process.env.PAWLINE_CHAT_PORT || 4317}`, viewport: { width: 390, height: 844 } });
  const adopter = await adopterContext.newPage();
  const shelter = await shelterContext.newPage();
  const errors = [];
  for (const page of [adopter, shelter]) {
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().includes("422") && !message.text().includes("404")) errors.push(message.text()); });
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.qaMediaStreams = [];
      navigator.mediaDevices.getUserMedia = async options => { const stream = await original(options); window.qaMediaStreams.push(stream); return stream; };
    });
  }
  try {
    const opened = await api(adopterContext, "adopter", "direct-conversations", { listingId: ids.pet });
    await api(adopterContext, "adopter", "direct-conversations", { listingId: ids.otherPet });
    await adopter.goto("/?user=adopter");
    await shelter.goto("/?user=shelter");
    await expect(adopter).toHaveTitle("Pawline — Chat QA");
    await expect(adopter.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
    await adopter.getByRole("button", { name: /Miso.*Willow/ }).click();
    await adopter.getByLabel("Ask about Miso").fill("Does Miso enjoy living with other cats?");
    await adopter.getByRole("button", { name: "Send", exact: true }).click();
    await expect(shelter.getByLabel("1 unread messages")).toBeVisible();
    await shelter.getByRole("button", { name: /Miso.*Alex/ }).click();
    await expect(shelter.getByRole("log")).toContainText("Does Miso enjoy living with other cats?");
    await shelter.getByLabel("Reply to Alex Morgan").fill("We can talk through Miso's routine and introduce you on a video call.");
    await shelter.getByRole("button", { name: "Send", exact: true }).click();
    await expect(adopter.getByRole("log")).toContainText("introduce you on a video call");
    await adopter.getByLabel("Ask about Miso").fill("Please wire money before meeting");
    await adopter.getByRole("button", { name: "Send", exact: true }).click();
    await expect(adopter.getByRole("alert")).toContainText("safety");
    await expect(adopter.getByLabel("Ask about Miso")).toHaveValue("Please wire money before meeting");
    await adopter.getByLabel("Ask about Miso").fill("");
    await adopter.getByLabel("Dismiss message").click();
    await adopter.screenshot({ path: evidence("desktop"), fullPage: true });
    await shelter.screenshot({ path: evidence("mobile"), fullPage: true });
    await expect(shelter.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await shelter.getByLabel("Back to conversations").click();
    await shelter.getByLabel("Search conversations").fill("Clover");
    await expect(shelter.getByRole("button", { name: /Miso.*Alex/ })).toHaveCount(0);
    await shelter.getByLabel("Search conversations").fill("");
    await shelter.getByRole("button", { name: /Miso.*Alex/ }).click();

    await adopter.getByRole("button", { name: "Video call", exact: true }).click();
    await expect(adopter.getByRole("dialog")).toBeVisible();
    expect(await adopter.evaluate(() => window.qaMediaStreams.length)).toBe(0);
    await adopter.getByRole("button", { name: "Preview devices" }).click();
    await expect(adopter.getByLabel("Your camera preview")).toBeVisible();
    await adopter.getByRole("button", { name: "Start call", exact: true }).click();
    await expect(shelter.getByRole("button", { name: "Review invitation" })).toBeVisible();
    expect(await shelter.evaluate(() => window.qaMediaStreams.length)).toBe(0);
    await shelter.getByRole("button", { name: "Review invitation" }).click();
    await shelter.getByRole("button", { name: "Preview devices" }).click();
    await shelter.getByRole("button", { name: "Accept and join" }).click();
    await expect(adopter.getByRole("dialog").getByRole("status")).toHaveText("Connected", { timeout: 30000 });
    await expect(shelter.getByRole("dialog").getByRole("status")).toHaveText("Connected", { timeout: 30000 });
    await expect.poll(() => adopter.getByLabel("Other participant video").evaluate(video => video.videoWidth)).toBeGreaterThan(0);
    await expect.poll(() => shelter.getByLabel("Other participant video").evaluate(video => video.videoWidth)).toBeGreaterThan(0);
    await adopter.screenshot({ path: evidence("video-connected"), fullPage: true });
    await adopter.getByRole("button", { name: "Mute microphone", exact: true }).click();
    expect(await adopter.evaluate(() => window.qaMediaStreams.at(-1).getAudioTracks()[0].enabled)).toBe(false);
    await shelter.getByRole("button", { name: "Turn camera off", exact: true }).click();
    expect(await shelter.evaluate(() => window.qaMediaStreams.at(-1).getVideoTracks()[0].enabled)).toBe(false);
    await shelter.getByRole("button", { name: "End call", exact: true }).click();
    await expect(adopter.getByRole("dialog").getByRole("status")).toHaveText("Call ended");
    for (const page of [adopter, shelter]) expect(await page.evaluate(() => window.qaMediaStreams.every(stream => stream.getTracks().every(track => track.readyState === "ended")))).toBe(true);
    await adopter.getByRole("button", { name: "Back to messages", exact: true }).click();
    await shelter.getByRole("button", { name: "Mark resolved" }).click();
    await expect(adopter.getByText("This question is resolved.", { exact: false })).toBeVisible();
    await adopter.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(adopter.getByLabel("Ask about Miso")).toBeVisible();
    await adopter.getByRole("button", { name: "Block", exact: true }).click();
    await expect(shelter.getByText("Messages and calls are paused", { exact: false })).toBeVisible();
    await expect(shelter.getByRole("button", { name: "Block", exact: true })).toBeDisabled();
    await adopter.getByRole("button", { name: "Unblock", exact: true }).click();
    await expect(shelter.getByLabel("Reply to Alex Morgan")).toBeVisible();
    await shelter.reload();
    await shelter.getByRole("button", { name: /Miso.*Alex/ }).click();
    await expect(shelter.getByRole("log")).toContainText("Does Miso enjoy living with other cats?");
    await api(adopterContext, "adopter", "direct-messages", { conversationId: opened.conversation.id, clientMessageId: randomUUID(), body: "Thank you for taking the time to chat." });
    await expect(shelter.getByRole("log")).toContainText("Thank you for taking the time to chat.");
    expect(errors).toEqual([]);
  } finally { await adopterContext.close(); await shelterContext.close(); }
});

test("narrow mobile and network failure preserve drafts and isolate rapid thread selection", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/?user=adopter");
  await page.getByRole("button", { name: /Miso.*Willow/ }).click();
  await page.getByLabel("Ask about Miso").fill("A question I am still writing");
  await page.getByLabel("Back to conversations").click();
  await page.getByRole("button", { name: /Clover.*Willow/ }).click();
  await expect(page.getByLabel("Ask about Clover")).toHaveValue("");
  await page.getByLabel("Back to conversations").click();
  await page.getByRole("button", { name: /Miso.*Willow/ }).click();
  await expect(page.getByLabel("Ask about Miso")).toHaveValue("A question I am still writing");
  await page.route("**/api/direct-messages", route => route.abort("failed"));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Ask about Miso")).toHaveValue("A question I am still writing");
  await page.unroute("**/api/direct-messages");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("A question I am still writing");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: evidence("320px"), fullPage: true });
});

test("camera permission failures, declined invitations and closing a pending preview release devices", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${process.env.PAWLINE_CHAT_PORT || 4317}`, viewport: { width: 390, height: 844 }, permissions: ["camera", "microphone"] });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.qaDenyMedia = true;
      window.qaSlowMedia = false;
      window.qaMediaStreams = [];
      navigator.mediaDevices.getUserMedia = async options => {
        if (window.qaDenyMedia) throw new DOMException("Permission denied", "NotAllowedError");
        const stream = await original(options);
        window.qaMediaStreams.push(stream);
        if (window.qaSlowMedia) await new Promise(resolve => setTimeout(resolve, 800));
        return stream;
      };
    });
    await page.goto("/?user=adopter");
    await page.getByRole("button", { name: /Miso.*Willow/ }).click();
    await page.getByRole("button", { name: "Video call", exact: true }).click();
    await page.getByRole("button", { name: "Preview devices" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("permission was denied");
    expect(await page.evaluate(() => window.qaMediaStreams.length)).toBe(0);
    await page.evaluate(() => { window.qaDenyMedia = false; });
    await page.getByRole("button", { name: "Preview devices" }).click();
    await page.getByRole("button", { name: "Start call", exact: true }).click();
    const inbox = await api(context, "shelter", "direct-conversations", null, "GET");
    const incoming = inbox.conversations.find(item => item.incomingCall);
    await api(context, "shelter", "direct-video", { conversationId: incoming.id, callId: incoming.incomingCall.id, action: "decline" });
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText("Call declined");
    expect(await page.evaluate(() => window.qaMediaStreams.every(stream => stream.getTracks().every(track => track.readyState === "ended")))).toBe(true);
    await page.getByRole("button", { name: "Back to messages", exact: true }).click();
    await page.getByRole("button", { name: "Video call", exact: true }).click();
    await page.evaluate(() => { window.qaSlowMedia = true; });
    await page.getByRole("button", { name: "Preview devices" }).click();
    await expect.poll(() => page.evaluate(() => window.qaMediaStreams.length)).toBe(2);
    await page.getByLabel("Close video call").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.qaMediaStreams.every(stream => stream.getTracks().every(track => track.readyState === "ended")))).toBe(true);
  } finally { await context.close(); }
});

test("chat fits the map sidebar with a visible composer at 320px and desktop", async ({ page }) => {
  for (const viewport of [{ width: 320, height: 740 }, { width: 1280, height: 850 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/?user=adopter&embedded");
    await page.getByRole("button", { name: /Miso.*Willow/ }).click();
    const textarea = page.getByLabel("Ask about Miso");
    await expect(textarea).toBeVisible();
    const rect = await textarea.boundingBox();
    expect(rect.y + rect.height).toBeLessThan(viewport.height);
    const send = await page.getByRole("button", { name: "Send", exact: true }).boundingBox();
    expect(send.y + send.height).toBeLessThan(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    const rail = page.locator(".rail-content");
    expect(await rail.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: evidence(`embedded-${viewport.width}`), fullPage: true });
  }
});
