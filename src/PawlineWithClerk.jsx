"use client";

import { ClerkProvider } from "@clerk/nextjs";
import PawlineApp from "./App";

export default function PawlineWithClerk({ publishableKey, proxyUrl }) {
  return <ClerkProvider publishableKey={publishableKey} proxyUrl={proxyUrl}>
    <PawlineApp clerkPublishableKey={publishableKey} />
  </ClerkProvider>;
}
