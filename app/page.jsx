"use client";

import PawlineApp from "../src/App";

export default function HomePage() {
  return <PawlineApp clerkPublishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || ""} />;
}
