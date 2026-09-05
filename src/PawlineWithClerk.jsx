"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import PawlineApp from "./App";

function AuthenticatedLanding({ publishableKey }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="next-loading" role="status">Opening Pawline…</main>;
  return <PawlineApp clerkPublishableKey={publishableKey} isSignedIn={Boolean(isSignedIn)} />;
}

export default function PawlineWithClerk({ publishableKey }) {
  return <ClerkProvider publishableKey={publishableKey}>
    <AuthenticatedLanding publishableKey={publishableKey} />
  </ClerkProvider>;
}
