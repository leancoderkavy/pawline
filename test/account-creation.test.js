import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every signed-out account gate offers explicit signup and sign-in actions", async () => {
  const files = await Promise.all([
    read("src/Community.jsx"),
    read("src/DirectMessages.jsx"),
    read("src/SubmissionWithAuth.jsx"),
  ]);

  for (const source of files) {
    assert.match(source, />Create account<\/button>/);
    assert.match(source, /<button className="button button-outline"[\s\S]*?>Sign in<\/button>/);
    assert.match(source, /setShowAuthModal\(true\)/);
    assert.match(source, /<AuthModal/);
    assert.doesNotMatch(source, /<SignInButton|<SignUpButton/);
  }
});

test("documented Clerk parties include current local Next.js preview origins", async () => {
  const example = await read(".env.example");
  assert.match(example, /CLERK_AUTHORIZED_PARTIES=.*http:\/\/localhost:3000/);
  assert.match(example, /http:\/\/localhost:4173/);
  assert.match(example, /http:\/\/127\.0\.0\.1:4173/);
  assert.match(example, /https:\/\/www\.pawlineadopt\.com/);
});
