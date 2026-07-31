"use client";

import { ClerkProvider } from "@clerk/nextjs";
import PawlineApp from "../src/App";

export default function HomePage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const application = <PawlineApp clerkPublishableKey={publishableKey} />;
  return publishableKey
    ? (
      <ClerkProvider
        publishableKey={publishableKey}
        proxyUrl="https://pawlineadopt.com/__clerk"
      >
        {application}
      </ClerkProvider>
    )
    : application;
}
