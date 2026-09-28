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

test("the mobile Messages gate opens the configured custom auth modal", async () => {
  const [journey, journeyWithAuth] = await Promise.all([
    read("src/AdopterExperience.jsx"),
    read("src/AdopterExperienceWithAuth.jsx"),
  ]);

  assert.match(journey, /function ApplicationMessages\(\{ applications, isSignedIn, getToken, onDiscover, onOpenAuth \}\)/);
  assert.match(journey, /className="journey-guest-auth-actions"/);
  assert.match(journey, /onOpenAuth\("signup"\).*?>Create account<\/button>/);
  assert.match(journey, /onOpenAuth\("signin"\).*?>Sign in<\/button>/);
  assert.match(journeyWithAuth, /onOpenAuth=\{setAuthMode\}/);
});

test("documented Clerk parties include current local Next.js preview origins", async () => {
  const example = await read(".env.example");
  assert.match(example, /CLERK_AUTHORIZED_PARTIES=.*http:\/\/localhost:3000/);
  assert.match(example, /http:\/\/localhost:4173/);
  assert.match(example, /http:\/\/127\.0\.0\.1:4173/);
  assert.match(example, /https:\/\/www\.pawlineadopt\.com/);
});

test("the custom account modal offers email code, Google, and phone code sign-in", async () => {
  const modal = await read("src/AuthModal.jsx");

  assert.match(modal, /const \{ signIn, fetchStatus: signInFetchStatus \} = useSignIn\(\)/);
  assert.match(modal, /const \{ signUp, fetchStatus: signUpFetchStatus \} = useSignUp\(\)/);
  assert.match(modal, /method:\s*authMethod/);
  assert.match(modal, /email-code/);
  assert.match(modal, /phone-code/);
  assert.match(modal, />Email code<\/button>/);
  assert.match(modal, /Continue with Google<\/button>/);
  assert.match(modal, /strategy: "oauth_google"/);
  assert.match(modal, />Phone code<\/button>/);
  assert.doesNotMatch(modal, /type="password"/);
  assert.match(modal, /type="tel"/);
  assert.match(modal, /<form onSubmit=\{submitHandler\}>/);
  assert.match(modal, /code === "signed_out"/);
  assert.match(modal, /id="clerk-captcha"/);
  assert.doesNotMatch(modal, /Preparing your account form/);
  assert.doesNotMatch(modal, /\.isLoaded|\.setActive\(|prepareEmailAddressVerification|attemptEmailAddressVerification/);
});

test("Google sign-in returns through a Clerk-backed callback", async () => {
  const [modal, page, callback] = await Promise.all([
    read("src/AuthModal.jsx"),
    read("app/sso-callback/page.jsx"),
    read("src/SsoCallback.jsx"),
  ]);
  assert.match(modal, /redirectCallbackUrl: "\/sso-callback"/);
  assert.match(page, /<ClerkProvider/);
  assert.match(callback, /signIn\.finalize\(\)/);
  assert.match(callback, /signUp\.finalize\(\)/);
});
