"use client";

import { ClerkProvider } from "@clerk/nextjs";
import PawlineApp from "./App";

export default function PawlineWithClerk({ publishableKey }) {
  return <ClerkProvider publishableKey={publishableKey}>
    <PawlineApp clerkPublishableKey={publishableKey} />
  </ClerkProvider>;
}
