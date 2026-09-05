"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { PawPrint, ShieldCheck } from "lucide-react";
import Dialog from "./Dialog";
import AuthModal from "./AuthModal";

export default function SubmissionWithAuth({ onClose, onAuthenticated }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  if (!isLoaded) return <Dialog title="List a pet" onClose={onClose}><div className="community-auth-state"><h2>Opening your account…</h2></div></Dialog>;
  if (!isSignedIn) return <Dialog title="List a pet" onClose={onClose}><div className="community-auth-state">
    <span><PawPrint /></span><h2>Register as the caretaker</h2>
    <p>Create an account before listing a pet. Once Pawline reviews the listing, this account can safely answer adoption questions in Messages.</p>
    <div className="auth-actions">
      <button className="button" onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }}>Create account</button>
      <button className="button button-outline" onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }}>Sign in</button>
    </div>
    <div className="auth-safety"><ShieldCheck /><span><strong>Your information stays private</strong>Messages stay on Pawline, and contact details are never shown in the listing chat.</span></div>
    {showAuthModal ? <AuthModal initialMode={authMode} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} /> : null}
  </div></Dialog>;
  return onAuthenticated(getToken, userId);
}
