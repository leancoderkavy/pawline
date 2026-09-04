"use client";

import { useAuth } from "@clerk/nextjs";
import AdopterExperience from "./AdopterExperience";

export default function AdopterExperienceWithAuth(props) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  if (!isLoaded) return <div className="journey-loading" role="status">Opening your adoption tools…</div>;
  return <AdopterExperience key={userId || "guest"} {...props} isSignedIn={isSignedIn} getToken={isSignedIn ? getToken : null} />;
}
