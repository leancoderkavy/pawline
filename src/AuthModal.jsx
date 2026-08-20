"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import Dialog from "./Dialog";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readErrorMessage(error) {
  const raw = error?.errors?.[0]?.message || error?.message || "That request could not be completed.";
  return String(raw);
}

export default function AuthModal({
  initialMode = "signin",
  onClose,
  onSuccess,
}) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : initialMode === "verify" ? "verify" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState({ type: "idle", text: "" });
  const [submitting, setSubmitting] = useState(false);

  const signInState = useSignIn();
  const signUpState = useSignUp();
  const signInLoaded = signInState?.isLoaded === true;
  const signUpLoaded = signUpState?.isLoaded === true;
  const isSignInMode = mode === "signin";
  const isSignUpMode = mode === "signup";
  const isVerifying = mode === "verify";
  const hooksLoaded = isVerifying || isSignUpMode ? signUpLoaded : signInLoaded;

  const showError = (text) => setMessage({ type: "error", text });
  const showStatus = (text) => setMessage({ type: "status", text });
  const showSuccess = (text) => setMessage({ type: "success", text });

  const resetMode = (nextMode) => {
    setMode(nextMode);
    setCode("");
    setMessage({ type: "idle", text: "" });
  };

  const onAuthDone = async () => {
    showSuccess("Welcome back. You are signed in.");
    onSuccess?.();
    onClose?.();
  };

  const signIn = async (event) => {
    event.preventDefault();
    if (!hooksLoaded || submitting || !signInState?.signIn) return;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      showError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    showStatus("Signing in…");
    try {
      const result = await signInState.signIn.create({
        identifier: normalizedEmail,
        password,
        strategy: "password",
      });
      if (result.status !== "complete" || !result.createdSessionId) throw new Error("This account needs an additional step before sign-in.");
      if (!signInState.setActive) throw new Error("Identity session activation is unavailable.");
      await signInState.setActive({ session: result.createdSessionId });
      await onAuthDone();
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const requestVerificationCode = async () => {
    if (!signUpState?.signUp) return;
    showStatus("Sending a fresh verification code to your email...");
    try {
      await signUpState.signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      showStatus(`A verification code was sent to ${normalizeEmail(email)}.`);
    } catch (error) {
      showError(readErrorMessage(error));
      throw error;
    }
  };

  const signUp = async (event) => {
    event.preventDefault();
    if (!hooksLoaded || submitting || !signUpState?.signUp) return;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      showError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    showStatus("Creating your account…");
    try {
      const result = await signUpState.signUp.create({ emailAddress: normalizedEmail, password });
      if (result.status === "complete" && result.createdSessionId && signUpState.setActive) {
        await signUpState.setActive({ session: result.createdSessionId });
        await onAuthDone();
        return;
      }
      if (result.status === "missing_requirements" && Array.isArray(result.unverifiedFields) && result.unverifiedFields.includes("email_address")) {
        await requestVerificationCode();
        resetMode("verify");
        return;
      }
      throw new Error("Your account can’t be activated yet.");
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyEmail = async (event) => {
    event.preventDefault();
    if (!hooksLoaded || submitting || !signUpState?.signUp) return;
    const cleanCode = code.trim();
    if (!cleanCode) {
      showError("Enter the six-digit verification code.");
      return;
    }

    setSubmitting(true);
    showStatus("Verifying your email…");
    try {
      const verified = await signUpState.signUp.attemptEmailAddressVerification({ code: cleanCode });
      if (verified.status !== "complete" || !verified.createdSessionId) throw new Error("The code was accepted, but sign-in could not be finished.");
      if (!signUpState.setActive) throw new Error("Identity session activation is unavailable.");
      await signUpState.setActive({ session: verified.createdSessionId });
      await onAuthDone();
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!hooksLoaded) {
    return <Dialog title="Secure sign-in" onClose={onClose}><p role="status">Preparing your account form…</p></Dialog>;
  }

  const title = mode === "verify" ? "Verify your email" : mode === "signup" ? "Create a Pawline account" : "Sign in to Pawline";
  const submitLabel = mode === "verify" ? "Verify code" : mode === "signup" ? "Create account" : "Sign in";
  const submitHandler = mode === "verify" ? verifyEmail : mode === "signup" ? signUp : signIn;
  const codeLabel = mode === "verify" ? "Verification code" : "Password";

  return <Dialog title={title} onClose={onClose}>
    <p className="dialog-copy">Use your email and password to keep your Pawline identity private and portable across listing tools.</p>
    <form onSubmit={submitHandler}>
      {mode !== "verify" ? <label>Email
        <input type="email" name="email" required value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </label> : <p className="auth-modal-note">Email code sent to {normalizeEmail(email) || "your inbox"}.</p>}
      {mode !== "verify" ? <label>{codeLabel}
        <input type="password" name="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={8} />
      </label> : <label>Verification code
        <input type="text" name="code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={8} inputMode="numeric" />
      </label>}
      <button type="submit" className="button" disabled={submitting}>
        {submitting ? <LoaderCircle className="community-spinner" /> : submitLabel}
      </button>
    </form>
    {mode === "verify" ? <button type="button" className="text-action auth-modal-resend" onClick={requestVerificationCode} disabled={submitting}>
      {submitting ? <LoaderCircle className="community-spinner" /> : <><RefreshCcw /> Send a new code</>}
    </button> : null}
    <div className="auth-mode-switch">
      {isSignInMode ? <button type="button" onClick={() => resetMode("signup")}>Need an account? Create one</button> : null}
      {isSignUpMode ? <button type="button" onClick={() => resetMode("signin")}>Already have an account? Sign in</button> : null}
      {isVerifying ? <button type="button" onClick={() => resetMode("signup")}>Use a different email</button> : null}
    </div>
      {message.text ? <p className={message.type === "error" ? "form-error" : message.type === "success" ? "form-success" : "form-status"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </Dialog>;
}
