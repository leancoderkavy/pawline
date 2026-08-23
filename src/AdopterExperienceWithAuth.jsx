"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Heart, UserRound } from "lucide-react";
import AdopterExperience from "./AdopterExperience";
import FavoritesSyncWithAuth from "./FavoritesSyncWithAuth";
import AuthModal from "./AuthModal";

export default function AdopterExperienceWithAuth({
  localFavorites, onLoadFavorites, onFavoriteSessionChange, onFavoriteError,
  onSave, onOpenMap, onOpenMessages, onOpenShelter, pets, feed,
}) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [authMode, setAuthMode] = useState("signin");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const openAuth = (mode = "signin") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };
  if (!isLoaded) return <div className="adopter-experience journey-loading" role="status"><Heart /><p>Preparing your adoption journey…</p></div>;
  const authAction = isSignedIn
    ? <span className="journey-auth-actions"><span className="journey-account-state"><UserRound /> Signed in</span><button type="button" onClick={onOpenShelter}>Shelter workspace</button></span>
    : <span className="journey-auth-actions"><button type="button" onClick={() => openAuth("signup")}>Create account</button><button type="button" onClick={() => openAuth("signin")}>Sign in</button></span>;
  return <>
    {showAuthModal ? <AuthModal initialMode={authMode} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} /> : null}
    <FavoritesSyncWithAuth localFavorites={localFavorites} onLoad={onLoadFavorites} onSessionChange={onFavoriteSessionChange} onError={onFavoriteError} />
    <AdopterExperience
      pets={pets}
      feed={feed}
      saved={localFavorites}
      onSave={onSave}
      clerkConfigured
      isSignedIn={isSignedIn}
      getToken={isSignedIn ? getToken : null}
      authAction={authAction}
      onOpenAuth={openAuth}
      initialView={isSignedIn ? "home" : "discover"}
      onOpenMap={onOpenMap}
      onOpenMessages={onOpenMessages}
    />
  </>;
}
