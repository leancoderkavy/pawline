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

  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const isSignInMode = mode === "signin";
  const isSignUpMode = mode === "signup";
  const isVerifying = mode === "verify";
  const isBusy = submitting || signInFetchStatus === "fetching" || signUpFetchStatus === "fetching";

  const showError = (text) => setMessage({ type: "error", text });
  const showStatus = (text) => setMessage({ type: "status", text });
  const showSuccess = (text) => setMessage({ type: "success", text });

  const resetMode = (nextMode) => {
    setMode(nextMode);
    setCode("");
    setMessage({ type: "idle", text: "" });
  };

  const onAuthDone = async (successMessage) => {
    showSuccess(successMessage);
    onSuccess?.();
    onClose?.();
  };

  const finalizeAuth = async (resource, successMessage) => {
    const { error } = await resource.finalize();
    if (error) {
      showError(readErrorMessage(error));
      return false;
    }
    await onAuthDone(successMessage);
    return true;
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    if (!signIn) {
      showError("The sign-in service is not ready. Please try again.");
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      showError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    showStatus("Signing in…");
    try {
      const { error } = await signIn.password({
        emailAddress: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (signIn.status !== "complete") throw new Error("This account needs an additional step before sign-in.");
      await finalizeAuth(signIn, "Welcome back. You are signed in.");
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const requestVerificationCode = async () => {
    if (!signUp) {
      showError("The account service is not ready. Please try again.");
      return false;
    }
    showStatus("Sending a fresh verification code to your email...");
    try {
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) throw error;
      showStatus(`A verification code was sent to ${normalizeEmail(email)}.`);
      return true;
    } catch (error) {
      showError(readErrorMessage(error));
      return false;
    }
  };

  const resendVerificationCode = async () => {
    if (isBusy) return;
    setSubmitting(true);
    await requestVerificationCode();
    setSubmitting(false);
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    if (!signUp) {
      showError("The account service is not ready. Please try again.");
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      showError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    showStatus("Creating your account…");
    try {
      const { error } = await signUp.password({ emailAddress: normalizedEmail, password });
      if (error) throw error;
      if (signUp.status === "complete") {
        await finalizeAuth(signUp, "Your Pawline account is ready.");
        return;
      }
      if (signUp.status === "missing_requirements" && signUp.unverifiedFields.includes("email_address")) {
        if (await requestVerificationCode()) {
          setMode("verify");
          setCode("");
        }
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
    if (isBusy) return;
    if (!signUp) {
      showError("The account service is not ready. Please try again.");
      return;
    }
    const cleanCode = code.trim();
    if (!cleanCode) {
      showError("Enter the six-digit verification code.");
      return;
    }

    setSubmitting(true);
    showStatus("Verifying your email…");
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code: cleanCode });
      if (error) throw error;
      if (signUp.status !== "complete") throw new Error("The code was accepted, but sign-in could not be finished.");
      await finalizeAuth(signUp, "Your Pawline account is ready.");
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "verify" ? "Verify your email" : mode === "signup" ? "Create a Pawline account" : "Sign in to Pawline";
  const submitLabel = mode === "verify" ? "Verify code" : mode === "signup" ? "Create account" : "Sign in";
  const submitHandler = mode === "verify" ? verifyEmail : mode === "signup" ? handleSignUp : handleSignIn;
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
      <button type="submit" className="button" disabled={isBusy}>
        {isBusy ? <LoaderCircle className="community-spinner" /> : submitLabel}
      </button>
    </form>
    {mode === "verify" ? <button type="button" className="text-action auth-modal-resend" onClick={resendVerificationCode} disabled={isBusy}>
      {isBusy ? <LoaderCircle className="community-spinner" /> : <><RefreshCcw /> Send a new code</>}
    </button> : null}
    <div className="auth-mode-switch">
      {isSignInMode ? <button type="button" onClick={() => resetMode("signup")}>Need an account? Create one</button> : null}
      {isSignUpMode ? <button type="button" onClick={() => resetMode("signin")}>Already have an account? Sign in</button> : null}
      {isVerifying ? <button type="button" onClick={() => resetMode("signup")}>Use a different email</button> : null}
    </div>
      {message.text ? <p className={message.type === "error" ? "form-error" : message.type === "success" ? "form-success" : "form-status"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </Dialog>;
}
