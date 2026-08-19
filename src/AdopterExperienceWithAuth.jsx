"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Heart, UserRound } from "lucide-react";
import AdopterExperience from "./AdopterExperience";
import FavoritesSyncWithAuth from "./FavoritesSyncWithAuth";

export default function AdopterExperienceWithAuth({
  localFavorites, onLoadFavorites, onFavoriteSessionChange, onFavoriteError,
  onSave, onOpenMap, onOpenMessages, onOpenShelter, pets,
}) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  if (!isLoaded) return <div className="adopter-experience journey-loading" role="status"><Heart /><p>Preparing your adoption journey…</p></div>;
  const authAction = isSignedIn
    ? <span className="journey-auth-actions"><span className="journey-account-state"><UserRound /> Signed in</span><button type="button" onClick={onOpenShelter}>Shelter workspace</button></span>
    : <span className="journey-auth-actions"><SignUpButton mode="modal"><button type="button">Create account</button></SignUpButton><SignInButton mode="modal"><button type="button">Sign in</button></SignInButton></span>;
  return <>
    <FavoritesSyncWithAuth localFavorites={localFavorites} onLoad={onLoadFavorites} onSessionChange={onFavoriteSessionChange} onError={onFavoriteError} />
    <AdopterExperience
      pets={pets}
      saved={localFavorites}
      onSave={onSave}
      clerkConfigured
      isSignedIn={isSignedIn}
      getToken={isSignedIn ? getToken : null}
      authAction={authAction}
      initialView={isSignedIn ? "home" : "discover"}
      onOpenMap={onOpenMap}
      onOpenMessages={onOpenMessages}
    />
  </>;
}
