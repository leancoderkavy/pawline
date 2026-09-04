"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { UserRound } from "lucide-react";
import AuthModal from "./AuthModal";

export default function MapAccountActions({ onProfile }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  return <>
    <button className="map-account-button" type="button" disabled={!isLoaded} onClick={() => isSignedIn ? onProfile() : setAuthMode("signin")}><UserRound /><span>{isSignedIn ? "Account" : "Sign in"}</span></button>
    {authMode ? <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} onSuccess={() => setAuthMode(null)} /> : null}
  </>;
}
