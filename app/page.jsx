"use client";

import { ClerkProvider } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const PawlineApp = dynamic(() => import("../src/App"), {
  ssr: false,
  loading: () => <main className="next-loading"><span aria-hidden="true">🐾</span><p>Opening Pawline…</p></main>,
});

export default function HomePage() {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const application = <PawlineApp clerkConfigured={Boolean(clerkKey)} />;
  return clerkKey
    ? (
      <ClerkProvider publishableKey={clerkKey} proxyUrl="/__clerk">
        {application}
      </ClerkProvider>
    )
    : application;
}
