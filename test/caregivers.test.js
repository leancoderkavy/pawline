import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createChatFixture, ids, users } from "../e2e/chat-fixture.mjs";
import { normalizeCaregiver, createCaregiversHandler } from "../api/caregivers.js";

const profile = { kind: "foster", name: "Neighborhood Foster", city: "Pasadena", region: "California", country: "United States", authorityConfirmed: true };
const pet = { name: "Poppy", species: "Dog", breed: "Mixed", city: "Pasadena", region: "California", country: "United States", postalCode: "91101", email: "adopter@example.test", shelter: "Forged name", authorityConfirmed: true, disclosureConfirmed: true, localLawConfirmed: true };

test("caregiver registration accepts local shelters, rescues and fosters without private address fields", () => {
  for (const kind of ["foster", "shelter", "rescue"]) assert.equal(normalizeCaregiver({ ...profile, kind }).kind, kind);
  for (const patch of [{ kind: "administrator" }, { authorityConfirmed: "true" }, { city: "" }, { name: "a" }]) assert.throws(() => normalizeCaregiver({ ...profile, ...patch }));
  assert.deepEqual(normalizeCaregiver({ ...profile, address: "PRIVATE", email: "PRIVATE", verified: true, organizationId: ids.organization }), { kind: "foster", name: profile.name, city: profile.city, region: profile.region, country: profile.country });
});

test("register, persist, list for review, receive public questions, reply, and remove adopted pets with tenant isolation", async () => {
  const fixture = await createChatFixture();
  const { invoke, database, pg } = fixture;
  try {
    assert.equal((await invoke("caregivers", null)).statusCode, 401);
    assert.equal((await invoke("caregivers", "adopter", { method: "POST", body: { ...profile, authorityConfirmed: false } })).statusCode, 422);
    const created = await invoke("caregivers", "adopter", { method: "POST", body: { ...profile, organizationId: ids.organization, verificationState: "verified" } });
    assert.equal(created.statusCode, 201);
    const organization = created.data.organizations[0];
    assert.equal(organization.kind, "foster");
    assert.equal(organization.verificationState, "unclaimed");
    assert.notEqual(organization.id, ids.organization);
    const retried = await invoke("caregivers", "adopter", { method: "POST", body: profile });
    assert.equal(retried.data.organizations[0].id, organization.id);
    assert.equal(retried.data.organizations.length, 1);
    const concurrent = await Promise.all([1, 2].map(() => invoke("caregivers", "adopter", { method: "POST", body: profile })));
    assert.ok(concurrent.every(result => result.statusCode === 201 && result.data.organizations[0].id === organization.id));
    const unverified = createCaregiversHandler({ ...fixture.dependencies, authenticate: async () => ({ id: "unverified", email: null }) });
    const response = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; } };
    await unverified({ method: "POST", body: profile }, response);
    assert.equal(response.statusCode, 403);
    // Replaying an additive migration preserves registration and existing teams.
    await pg.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    assert.equal((await invoke("caregivers", "adopter")).data.organizations[0].id, organization.id);
    assert.equal((await invoke("submissions", "adopter", { method: "POST", body: { ...pet, organizationId: ids.organization } })).statusCode, 403);
    const photoBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=", "base64");
    const submitted = await invoke("submissions", "adopter", { method: "POST", body: { ...pet, organizationId: organization.id, files: [{ name: "poppy.png", type: "image/png", size: photoBytes.length, data: `data:image/png;base64,${photoBytes.toString("base64")}` }] } });
    assert.equal(submitted.statusCode, 202, JSON.stringify(submitted.data));
    const petId = submitted.data.id;
    let row = (await database`SELECT * FROM pets WHERE id = ${petId}`)[0];
    assert.equal(row.organization_id, organization.id);
    assert.equal(row.shelter, profile.name);
    assert.equal(row.status, "pending");
    assert.equal(row.verified_at, null);
    assert.equal(row.image_url, `/api/pet-media?id=${petId}`);
    assert.equal((await database`SELECT count(*)::integer AS n FROM pet_submission_files WHERE pet_id = ${petId}`)[0].n, 1);
    assert.equal((await invoke("submissions", "stranger", { method: "POST", body: { ...pet, organizationId: organization.id } })).statusCode, 403);
    assert.equal((await invoke("caregivers", "stranger")).data.pets.length, 0);
    assert.equal((await invoke("caregivers", "adopter")).data.pets[0].id, petId);
    assert.equal((await invoke("direct-conversations", "stranger", { method: "POST", body: { listingId: petId } })).statusCode, 409);
    assert.equal((await invoke("caregiver-pets", "adopter", { method: "PATCH", body: { petId, status: "available" } })).statusCode, 422);
    // Simulate Pawline moderation; registrants cannot run this operation.
    await database`UPDATE pets SET status = 'available', verified_at = now() WHERE id = ${petId}`;
    const changed = await invoke("submissions", "adopter", { method: "POST", body: { ...pet, description: "Updated details for review", organizationId: organization.id } });
    assert.equal(changed.statusCode, 202);
    row = (await database`SELECT status, verified_at FROM pets WHERE id = ${petId}`)[0];
    assert.equal(row.status, "pending", "Resubmission cannot bypass moderation");
    assert.equal(row.verified_at, null);
    await database`UPDATE pets SET status = 'available', verified_at = now() WHERE id = ${petId}`;
    const opened = await invoke("direct-conversations", "stranger", { method: "POST", body: { listingId: petId } });
    assert.equal(opened.statusCode, 201);
    const conversationId = opened.data.conversation.id;
    assert.equal((await invoke("direct-messages", "stranger", { method: "POST", body: { conversationId, body: "Does Poppy enjoy walks?", clientMessageId: randomUUID() } })).statusCode, 201);
    assert.equal((await invoke("direct-conversations", "adopter")).data.conversations[0].unreadCount, 1);
    assert.equal((await invoke("direct-messages", "adopter", { method: "POST", body: { conversationId, body: "Yes, Poppy likes a short morning walk.", clientMessageId: randomUUID() } })).statusCode, 201);
    assert.equal((await invoke("direct-messages", "shelter", { query: { conversationId } })).statusCode, 404);
    assert.equal((await invoke("direct-messages", "stranger", { query: { conversationId } })).data.messages.length, 2);
    assert.equal((await invoke("caregiver-pets", "stranger", { method: "PATCH", body: { petId, status: "adopted" } })).statusCode, 404);
    assert.equal((await invoke("caregiver-pets", "adopter", { method: "PATCH", body: { petId, status: "adopted" } })).statusCode, 200);
    assert.equal((await invoke("direct-conversations", "teammate", { method: "POST", body: { listingId: petId } })).statusCode, 409);
    await database`DELETE FROM organization_memberships WHERE organization_id = ${organization.id} AND clerk_user_id = ${users.adopter.id}`;
    assert.equal((await invoke("caregivers", "adopter")).data.pets.length, 0);
    assert.equal((await invoke("caregivers", "adopter")).data.canRegister, false, "Revocation cannot be bypassed by registering again");
    assert.equal((await invoke("direct-messages", "adopter", { query: { conversationId } })).statusCode, 404);
  } finally { await fixture.close(); }
});

test("upgrade from the prior schema preserves existing shelter memberships and can be replayed", async () => {
  const fixture = await createChatFixture();
  try {
    await fixture.pg.exec("DROP TABLE caregiver_registrations; ALTER TABLE organizations DROP CONSTRAINT organizations_kind_check; ALTER TABLE organizations ADD CONSTRAINT organizations_kind_check CHECK (kind IN ('municipal_shelter','shelter','rescue'));");
    const missingSchema = createCaregiversHandler({ ...fixture.dependencies, onError: () => {} });
    const response = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; } };
    await missingSchema({ method: "GET", headers: { authorization: "Bearer fixture:shelter" } }, response);
    assert.equal(response.statusCode, 503);
    const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
    await fixture.pg.exec(schema);
    await fixture.pg.exec(schema);
    const restored = await fixture.invoke("caregivers", "shelter");
    assert.equal(restored.statusCode, 200);
    assert.equal(restored.data.organizations[0].id, ids.organization);
    assert.equal(restored.data.pets.length, 2);
    assert.equal(restored.data.canRegister, true, "Existing team members can register their separate foster work");
  } finally { await fixture.close(); }
});
