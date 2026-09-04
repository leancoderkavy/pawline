"use client";
import React, { useCallback, useState } from "react";
import { UserButton, useAuth } from "@clerk/nextjs";
import { LoaderCircle, MessageCircle, ShieldCheck } from "lucide-react";
import AuthModal from "./AuthModal";
import DirectMessagesWorkspace from "./DirectMessagesWorkspace.jsx";

export default function DirectMessages(props) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [authMode, setAuthMode] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const request = useCallback(async (url, options = {}) => {
    const token = await getToken();
    if (!token) throw Object.assign(new Error("Sign in with Pawline to use private messages."), { status: 401 });
    const response = await fetch(url, { ...options, cache: "no-store", signal: options.signal || AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", ...options.headers, Authorization: `Bearer ${token}` } });
    const result = await response.json().catch(() => ({ error: "Chat is temporarily unavailable. Please try again." }));
    if (!response.ok) throw Object.assign(new Error(result.error || "Chat is temporarily unavailable."), { status: response.status });
    return result;
  }, [getToken]);
  if (!isLoaded) return <div className="community-auth-state" role="status"><LoaderCircle className="community-spinner" /><h2>Opening Messages…</h2></div>;
  if (!isSignedIn) return <div className="community-auth-state">
    {showAuthModal ? <AuthModal initialMode={authMode} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} /> : null}
    <span><MessageCircle /></span><h2>Talk with a shelter or foster</h2>
    <p>Ask about a pet, answer adoption questions, or arrange a video hello. Sign in to keep your conversations together.</p>
    <div className="auth-actions"><button className="button" onClick={() => { setAuthMode("signup"); setShowAuthModal(true); }}>Create account</button><button className="button button-outline" onClick={() => { setAuthMode("signin"); setShowAuthModal(true); }}>Sign in</button></div>
    <div className="auth-safety"><ShieldCheck /><span><strong>Private conversations</strong>Messages are shared with you and the listing's caretaker or shelter team.</span></div>
  </div>;
  return <DirectMessagesWorkspace key={userId} {...props} request={request} userId={userId} accountControl={<UserButton />} />;
}
