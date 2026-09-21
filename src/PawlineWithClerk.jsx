"use client";

import { useEffect, useRef } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import PawlineApp from "./App";
import { capture, identifyUser, resetAnalytics } from "./analytics";
import { clerkBrowserOptions } from "./clerkBrowserOptions";

function PostHogIdentity() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const identifiedId = useRef(null);
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const name = user?.fullName || "";

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && userId) {
      identifyUser(userId, { email, name });
      identifiedId.current = userId;
      return;
    }
    if (identifiedId.current) {
      capture("user_signed_out");
      resetAnalytics();
      identifiedId.current = null;
    }
  }, [email, isLoaded, isSignedIn, name, userId]);

  return null;
}

function AuthenticatedLanding({ publishableKey }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="next-loading" role="status">Opening Pawline…</main>;
  return <PawlineApp clerkPublishableKey={publishableKey} isSignedIn={Boolean(isSignedIn)} />;
}

export default function PawlineWithClerk({ publishableKey }) {
  return <ClerkProvider {...clerkBrowserOptions(publishableKey)}>
    <PostHogIdentity />
    <AuthenticatedLanding publishableKey={publishableKey} />
  </ClerkProvider>;
}
