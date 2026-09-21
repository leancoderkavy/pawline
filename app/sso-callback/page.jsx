"use client";

import { ClerkProvider } from "@clerk/nextjs";
import SsoCallback from "../../src/SsoCallback";
import { clerkBrowserOptions } from "../../src/clerkBrowserOptions";

export default function SsoCallbackPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!publishableKey) {
    return <main className="next-loading" role="status"><p>Sign-in is unavailable in this environment.</p></main>;
  }
  return <ClerkProvider {...clerkBrowserOptions(publishableKey)}>
    <SsoCallback />
  </ClerkProvider>;
}
