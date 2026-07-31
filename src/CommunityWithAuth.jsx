"use client";

import { ClerkProvider } from "@clerk/nextjs";
import Community from "./Community";

export default function CommunityWithAuth({ publishableKey, onLeadsChange }) {
  return <ClerkProvider publishableKey={publishableKey}>
    <Community onLeadsChange={onLeadsChange} />
  </ClerkProvider>;
}
