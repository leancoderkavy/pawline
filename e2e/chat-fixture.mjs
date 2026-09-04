import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { createConversationsHandler } from "../api/direct-conversations.js";
import { createMessagesHandler } from "../api/direct-messages.js";
import { createReportHandler } from "../api/direct-message-report.js";
import { createVideoHandler } from "../api/direct-video.js";

export const ids = {
  organization: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  pet: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  otherPet: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};
export const users = {
  adopter: { id: "fixture_adopter", displayName: "Alex Morgan", imageUrl: null },
  shelter: { id: "fixture_shelter", displayName: "Robin at Willow Shelter", imageUrl: null },
  teammate: { id: "fixture_teammate", displayName: "Sam at Willow Shelter", imageUrl: null },
  stranger: { id: "fixture_stranger", displayName: "Outside member", imageUrl: null },
};

// Test-only adapter: real PostgreSQL semantics with Neon's lazy tagged queries.
// Neither this database nor the fixture identity resolver is imported by the app.
export async function createChatFixture() {
  const pg = new PGlite({ extensions: { pgcrypto } });
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await pg.exec(schema);
  const database = (strings, ...values) => {
    const sql = strings.reduce((text, part, index) => text + part + (index < values.length ? `$${index + 1}` : ""), "");
    const params = values.map(value => value instanceof Date ? value.toISOString() : value);
    const execute = client => client.query(sql, params).then(result => result.rows);
    return { execute, then: (resolve, reject) => execute(pg).then(resolve, reject) };
  };
  database.transaction = queries => pg.transaction(async tx => {
    const result = [];
    for (const query of queries) result.push(await query.execute(tx));
    return result;
  });
  await database`INSERT INTO organizations (id, name, verification_state) VALUES (${ids.organization}, 'Willow Animal Shelter', 'verified')`;
  for (const who of ["shelter", "teammate"]) await database`INSERT INTO organization_memberships (organization_id, clerk_user_id, role) VALUES (${ids.organization}, ${users[who].id}, 'administrator')`;
  for (const [id, name] of [[ids.pet, "Miso"], [ids.otherPet, "Clover"]]) await database`
    INSERT INTO pets (id, fingerprint, name, species, status, verified_at, organization_id, shelter, claimed_by_clerk_user_id, claimed_by_display_name)
    VALUES (${id}, ${id}, ${name}, 'Cat', 'available', now(), ${ids.organization}, 'Willow Animal Shelter', ${users.shelter.id}, ${users.shelter.displayName})
  `;
  const errors = [];
  const events = [];
  const dependencies = {
    getDatabase: () => database,
    authenticate: async request => {
      const key = request.headers?.authorization?.replace("Bearer fixture:", "");
      if (!users[key]) throw Object.assign(new Error("Sign in with Pawline to use this feature."), { statusCode: 401 });
      return users[key];
    },
    publish: async (_database, conversation) => { events.push({ conversationId: conversation.id }); },
    onError: error => { if (!error.statusCode) errors.push(error); },
    environment: { NODE_ENV: "test", PAWLINE_VIDEO_ENABLED: "true", PAWLINE_VIDEO_ALLOW_DIRECT: "true" },
  };
  const handlers = {
    "direct-conversations": createConversationsHandler(dependencies),
    "direct-messages": createMessagesHandler(dependencies),
    "direct-message-report": createReportHandler(dependencies),
    "direct-video": createVideoHandler(dependencies),
  };
  async function invoke(route, user = "adopter", { method = "GET", body, query = {} } = {}) {
    const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(data) { this.data = JSON.parse(JSON.stringify(data)); return this; } };
    await handlers[route]({ method, body, query, headers: { authorization: user ? `Bearer fixture:${user}` : "" } }, response);
    if (errors.length) throw errors.shift();
    return response;
  }
  return { pg, database, dependencies, handlers, invoke, events, close: () => pg.close() };
}
