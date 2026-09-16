"use client";

import { ClerkProvider } from "@clerk/nextjs";
import SsoCallback from "../../src/SsoCallback";

export default function SsoCallbackPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!publishableKey) {
    return <main className="next-loading" role="status"><p>Sign-in is unavailable in this environment.</p></main>;
  }
  return <ClerkProvider publishableKey={publishableKey}>
    <SsoCallback />
  </ClerkProvider>;
}
