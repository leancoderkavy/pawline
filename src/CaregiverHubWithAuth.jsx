"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import AuthModal from "./AuthModal";
import CaregiverHub, { CaregiverWelcome } from "./CaregiverHub";
import ShelterWorkspaceWithAuth from "./ShelterWorkspaceWithAuth";

export default function CaregiverHubWithAuth({ onListPet, onOpenMessages }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [mode, setMode] = useState(null);
  if (!isLoaded) return <p role="status">Opening registration…</p>;
  if (!isSignedIn) return <><CaregiverWelcome onSignIn={() => setMode("signin")} onSignUp={() => setMode("signup")} />{mode ? <AuthModal initialMode={mode} onClose={() => setMode(null)} onSuccess={() => setMode(null)} /> : null}</>;
  return <CaregiverHub key={userId} getToken={getToken} onListPet={profile => onListPet({ ...profile, accountId: userId })} onOpenMessages={onOpenMessages}><details><summary>Organization hours and applications</summary><ShelterWorkspaceWithAuth /></details></CaregiverHub>;
}
