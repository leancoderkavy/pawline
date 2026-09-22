"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import Dialog from "./Dialog";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readErrorMessage(error) {
  const first = error?.errors?.[0];
  const code = first?.code || error?.code;
  if (code === "signed_out") {
    return "The sign-in session was lost before the request finished. Refresh the page and try again.";
  }
  if (code === "captcha_invalid" || code === "captcha_unavailable") {
    return first?.longMessage || first?.long_message
      || "Account creation temporarily unavailable. This is a configuration issue we're working on. Please try again later or contact support.";
  }
  const raw = first?.message || error?.message || "That request could not be completed.";
  return String(raw);
}

function isCaptchaError(error) {
  const first = error?.errors?.[0];
  const code = first?.code || error?.code;
  const errorMsg = readErrorMessage(error);
  return errorMsg.toLowerCase().includes("captcha")
    || code === "captcha_invalid"
    || code === "captcha_unavailable";
}

export default function AuthModal({
  initialMode = "signin",
  onClose,
  onSuccess,
}) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : initialMode === "verify" ? "verify" : "signin");
  const [verifyKind, setVerifyKind] = useState("email-signup");
  const [returnMode, setReturnMode] = useState(initialMode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
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
    setReturnMode(nextMode === "signup" ? "signup" : "signin");
    setVerifyKind(nextMode === "signup" ? "email-signup" : "email-signin");
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

  const enterVerify = (kind, statusText) => {
    setVerifyKind(kind);
    setReturnMode(kind === "email-signup" ? "signup" : "signin");
    setMode("verify");
    setCode("");
    showStatus(statusText);
  };

  const sendSignInCode = async (normalizedEmail) => {
    if (!signIn) {
      showError("The sign-in service is not ready. Please try again.");
      return false;
    }
    const { error } = await signIn.emailCode.sendCode({ emailAddress: normalizedEmail });
    if (error) throw error;
    return true;
  };

  const sendSignUpCode = async () => {
    if (!signUp) {
      showError("The account service is not ready. Please try again.");
      return false;
    }
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) throw error;
    return true;
  };

  const requestVerificationCode = async (kind = verifyKind) => {
    const normalizedEmail = normalizeEmail(email);
    showStatus(kind === "email-signin"
      ? "Sending a fresh sign-in code to your email..."
      : "Sending a fresh verification code to your email...");
    try {
      if (kind === "email-signin") {
        if (!await sendSignInCode(normalizedEmail)) return false;
        showStatus(`A sign-in code was sent to ${normalizedEmail}.`);
        return true;
      }
      if (!await sendSignUpCode()) return false;
      showStatus(`A verification code was sent to ${normalizedEmail}.`);
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

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    if (!signIn) {
      showError("The sign-in service is not ready. Please try again.");
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      showError("Enter your email address.");
      return;
    }

    setSubmitting(true);
    showStatus("Sending a one-time code…");
    try {
      if (!await sendSignInCode(normalizedEmail)) return;
      enterVerify("email-signin", `A sign-in code was sent to ${normalizedEmail}.`);
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    if (!signUp) {
      showError("The account service is not ready. Please try again.");
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      showError("Enter your email address.");
      return;
    }

    setSubmitting(true);
    showStatus("Creating your account…");
    try {
      // Passwordless path: create with email only, then email OTP verification.
      // Requires Clerk Dashboard: password not required, email verification code enabled for sign-up.
      const { error } = await signUp.create({ emailAddress: normalizedEmail });
      if (error) {
        if (isCaptchaError(error)) {
          throw new Error("Account creation temporarily unavailable. This is a configuration issue we're working on. Please try again later or contact support.");
        }
        throw error;
      }
      if (signUp.status === "complete") {
        await finalizeAuth(signUp, "Your Pawline account is ready.");
        return;
      }
      if (signUp.status === "missing_requirements" && signUp.unverifiedFields.includes("email_address")) {
        if (await sendSignUpCode()) {
          enterVerify("email-signup", `A verification code was sent to ${normalizedEmail}.`);
        }
        return;
      }
      if (signUp.missingFields?.includes("password")) {
        throw new Error("Passwordless sign-up is not enabled yet in Clerk. An admin needs to turn off required passwords and keep email verification codes for sign-up.");
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
    const cleanCode = code.trim();
    if (!cleanCode) {
      showError("Enter the six-digit verification code.");
      return;
    }

    setSubmitting(true);
    showStatus(verifyKind === "email-signin" ? "Verifying your sign-in code…" : "Verifying your email…");
    try {
      if (verifyKind === "email-signin") {
        if (!signIn) {
          showError("The sign-in service is not ready. Please try again.");
          return;
        }
        const { error } = await signIn.emailCode.verifyCode({ code: cleanCode });
        if (error) throw error;
        if (signIn.status !== "complete") throw new Error("The code was accepted, but sign-in could not be finished.");
        await finalizeAuth(signIn, "Welcome back. You are signed in.");
        return;
      }

      if (!signUp) {
        showError("The account service is not ready. Please try again.");
        return;
      }
      const { error } = await signUp.verifications.verifyEmailCode({ code: cleanCode });
      if (error) throw error;
      if (signUp.status !== "complete") throw new Error("The code was accepted, but account creation could not be finished.");
      await finalizeAuth(signUp, "Your Pawline account is ready.");
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "verify"
    ? (verifyKind === "email-signin" ? "Enter your sign-in code" : "Verify your email")
    : mode === "signup"
      ? "Create a Pawline account"
      : "Sign in to Pawline";
  const submitLabel = mode === "verify"
    ? "Verify code"
    : mode === "signup"
      ? "Create account"
      : "Send code";
  const submitHandler = mode === "verify" ? verifyEmail : mode === "signup" ? handleSignUp : handleSignIn;
  const dialogCopy = mode === "verify"
    ? "Enter the one-time code from your email to finish."
    : mode === "signup"
      ? "We'll email you a verification code to confirm your new account — no password needed."
      : "We'll email you a one-time code — no password needed.";

  return <Dialog title={title} onClose={onClose} centered>
    <p className="dialog-copy">{dialogCopy}</p>
    <form onSubmit={submitHandler}>
      {mode !== "verify" ? <label>Email
        <input type="email" name="email" required value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </label> : <p className="auth-modal-note">Code sent to {normalizeEmail(email) || "your inbox"}.</p>}
      {mode === "verify" ? <label>Verification code
        <input type="text" name="code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={8} inputMode="numeric" autoComplete="one-time-code" />
      </label> : null}
      {mode === "signup" ? <div id="clerk-captcha" /> : null}
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
      {isVerifying ? <button type="button" onClick={() => resetMode(returnMode)}>Use a different email</button> : null}
    </div>
      {message.text ? <p className={message.type === "error" ? "form-error" : message.type === "success" ? "form-success" : "form-status"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </Dialog>;
}
