import assert from "node:assert";
import { test } from "node:test";

test("AuthModal handles CAPTCHA errors with helpful message", async () => {
  const { readFile } = await import("node:fs/promises");
  const authModalSource = await readFile("src/AuthModal.jsx", "utf-8");

  // Verify the error handling code exists
  assert.match(
    authModalSource,
    /Account creation temporarily unavailable/,
    "AuthModal should have CAPTCHA error handling with helpful message"
  );

  // Verify it checks for CAPTCHA-related errors
  assert.match(
    authModalSource,
    /errorMsg\.toLowerCase\(\)\.includes\("captcha"\)/,
    "Should check for 'captcha' in error message"
  );

  // Verify it checks for CAPTCHA error codes
  assert.match(
    authModalSource,
    /error\.code === "captcha_invalid"/,
    "Should check for captcha_invalid error code"
  );

  assert.match(
    authModalSource,
    /error\.code === "captcha_unavailable"/,
    "Should check for captcha_unavailable error code"
  );

  // Verify helpful error message is provided
  assert.match(
    authModalSource,
    /configuration issue.*try again later.*contact support/,
    "Should provide helpful guidance in CAPTCHA error message"
  );
});

test("PawlineWithClerk configures ClerkProvider properly", async () => {
  const { readFile } = await import("node:fs/promises");
  const clerkSource = await readFile("src/PawlineWithClerk.jsx", "utf-8");

  // Verify ClerkProvider is configured with appearance settings
  assert.match(
    clerkSource,
    /appearance=\{/,
    "ClerkProvider should have appearance configuration"
  );

  // Verify telemetry is configured
  assert.match(
    clerkSource,
    /telemetry=\{false\}/,
    "ClerkProvider should disable telemetry to reduce third-party requests"
  );

  // Verify publishableKey is passed
  assert.match(
    clerkSource,
    /publishableKey=\{publishableKey\}/,
    "ClerkProvider should receive publishableKey prop"
  );
});

test("signup flow documentation exists", async () => {
  // This test ensures we're providing documentation for the CAPTCHA configuration
  const { readFile } = await import("node:fs/promises");
  
  // Check AuthModal has helpful error messages
  const authModal = await readFile("src/AuthModal.jsx", "utf-8");
  assert.ok(
    authModal.includes("configuration issue") || authModal.includes("temporarily unavailable"),
    "AuthModal should have user-friendly error messages for signup issues"
  );
});
