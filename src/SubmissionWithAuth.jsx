"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { PawPrint, ShieldCheck } from "lucide-react";
import Dialog from "./Dialog";

export default function SubmissionWithAuth({ onClose, onAuthenticated }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  if (!isLoaded) return <Dialog title="List a pet" onClose={onClose}><div className="community-auth-state"><h2>Opening your account…</h2></div></Dialog>;
  if (!isSignedIn) return <Dialog title="List a pet" onClose={onClose}><div className="community-auth-state">
    <span><PawPrint /></span><h2>Register as the caretaker</h2>
    <p>Create an account before listing a pet. Once Pawline reviews the listing, this account can safely answer adoption questions in Messages.</p>
    <SignInButton mode="modal"><button className="button">Sign in to register</button></SignInButton>
    <div className="auth-safety"><ShieldCheck /><span><strong>Your information stays private</strong>Messages stay on Pawline, and contact details are never shown in the listing chat.</span></div>
  </div></Dialog>;
  return onAuthenticated(getToken);
}
