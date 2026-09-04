"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import AdopterExperience from "./AdopterExperience";
import AuthModal from "./AuthModal";

export default function AdopterExperienceWithAuth(props) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  if (!isLoaded) return <div className="journey-loading" role="status">Opening your adoption tools…</div>;
  return <>
    {authMode ? <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} onSuccess={() => setAuthMode(null)} /> : null}
    <AdopterExperience key={userId || "guest"} {...props} clerkConfigured onOpenAuth={setAuthMode} isSignedIn={isSignedIn} getToken={isSignedIn ? getToken : null} />
  </>;
}
