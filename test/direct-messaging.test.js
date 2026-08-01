import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseConversationId, parseListingId, publicDirectMessage } from "../api/_direct.js";

const listingId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("direct messaging accepts only a Pawline UUID listing identifier", () => {
  assert.equal(parseListingId(`pawline-${listingId}`), listingId);
  assert.equal(parseListingId(listingId), listingId);
  assert.equal(parseListingId("rg-123"), null);
  assert.equal(parseListingId("pawline-../../pets"), null);
});

test("direct messaging exposes only safe message fields and marks the sender", () => {
  const message = publicDirectMessage({
    id: "9f2504e0-4f89-41d3-9a0c-0305e82c3301",
    conversation_id: "8f2504e0-4f89-41d3-9a0c-0305e82c3301",
    sender_clerk_user_id: "user_a",
    author_name: "Avery Foster",
    author_image_url: "https://images.example.org/avatar.png",
    body: "Miso does well with other cats.",
    report_count: 0,
    created_at: "2026-07-31T12:00:00.000Z",
  }, "user_a");
  assert.equal(message.mine, true);
  assert.equal(message.author.name, "Avery Foster");
  assert.equal(message.body, "Miso does well with other cats.");
  assert.equal(parseConversationId(message.conversationId), "8f2504e0-4f89-41d3-9a0c-0305e82c3301");
  assert.equal("contactEmail" in message, false);
  assert.equal("phone" in message, false);
});

test("mobile conversations use a full-width inbox or thread instead of two squeezed columns", async () => {
  const component = await readFile(new URL("../src/DirectMessages.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(component, /direct-workspace \$\{selected \? "has-selection"/);
  assert.match(component, /aria-label="Back to conversations"/);
  assert.match(styles, /\.direct-workspace \{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(styles, /\.direct-workspace\.has-selection \.direct-inbox-list/);
  assert.match(styles, /\.direct-workspace:not\(\.has-selection\) \.direct-thread/);
  assert.doesNotMatch(styles, /@media \(max-width:600px\)[\s\S]*?grid-template-columns:minmax\(128px/);
});
