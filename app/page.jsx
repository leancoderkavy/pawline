"use client";

import dynamic from "next/dynamic";
import PawlineApp from "../src/App";

const PawlineWithClerk = dynamic(() => import("../src/PawlineWithClerk"));

export default function HomePage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  return publishableKey
    ? <PawlineWithClerk publishableKey={publishableKey} proxyUrl="https://pawlineadopt.com/__clerk" />
    : <PawlineApp clerkPublishableKey="" />;
}
