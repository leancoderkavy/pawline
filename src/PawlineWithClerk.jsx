"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import PawlineApp from "./App";

function AuthenticatedLanding({ publishableKey }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="methodology-page">
    <article className="methodology-content">
      <h1>Find adoptable dogs and cats near you</h1>
      <p>Explore shelter listings on Pawline's adoption map and compare listed needs with your home and routine. Confirm availability and adoption requirements with the original shelter or rescue.</p>
      <p role="status">Opening Pawline…</p>
      <nav className="search-page-nav" aria-label="Adoption resources">
        <a href="/guides">Read the adoption guides</a>
        <a href="/how-pawline-works">How Pawline checks listing sources</a>
      </nav>
    </article>
  </main>;
  return <PawlineApp clerkPublishableKey={publishableKey} isSignedIn={Boolean(isSignedIn)} />;
}

export default function PawlineWithClerk({ publishableKey }) {
  return <ClerkProvider publishableKey={publishableKey}>
    <AuthenticatedLanding publishableKey={publishableKey} />
  </ClerkProvider>;
}
