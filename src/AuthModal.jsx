"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import Dialog from "./Dialog";
import {
  normalizeEmail,
  normalizePhone,
  startEmailSignUp,
  startSignIn,
  verifyEmailSignUp,
  verifySignInCode,
} from "./authFlow";

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
  const raw = first?.longMessage || first?.long_message || first?.message || error?.message
    || "That request could not be completed.";
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
  const startingMode = initialMode === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState(initialMode === "verify" ? "verify" : startingMode);
  const [authMethod, setAuthMethod] = useState("email-code");
  const [verifyKind, setVerifyKind] = useState("email-signin");
  const [returnMode, setReturnMode] = useState(startingMode);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
    setReturnMode(nextMode);
    setAuthMethod(authMethod === "phone-code" ? "email-code" : authMethod);
    setVerifyKind(nextMode === "signup" ? "email-signup" : "email-signin");
    setPassword("");
    setCode("");
    setMessage({ type: "idle", text: "" });
  };

  const selectMethod = (method) => {
    setAuthMethod(method);
    setPassword("");
    setCode("");
    setMessage({ type: "idle", text: "" });
  };

  const onAuthDone = async (successMessage) => {
    showSuccess(successMessage);
    onSuccess?.();
    onClose?.();
  };

  const enterVerify = (kind, statusText) => {
    setVerifyKind(kind);
    setReturnMode(kind === "email-signup" ? "signup" : "signin");
    setMode("verify");
    setCode("");
    showStatus(statusText);
  };

  const resendVerificationCode = async () => {
    if (isBusy) return;
    setSubmitting(true);
    try {
      if (verifyKind === "phone-signin") {
        const phoneNumber = normalizePhone(phone);
        if (!phoneNumber) throw new Error("Enter a valid phone number, including country code.");
        showStatus("Sending a fresh sign-in code to your phone...");
        const { error } = await signIn.phoneCode.sendCode({ phoneNumber });
        if (error) throw error;
        showStatus(`A sign-in code was sent to ${phoneNumber}.`);
      } else if (verifyKind === "email-signin") {
        const emailAddress = normalizeEmail(email);
        showStatus("Sending a fresh sign-in code to your email...");
        const { error } = await signIn.emailCode.sendCode({ emailAddress });
        if (error) throw error;
        showStatus(`A sign-in code was sent to ${emailAddress}.`);
      } else {
        showStatus("Sending a fresh verification code to your email...");
        const { error } = await signUp.verifications.sendEmailCode();
        if (error) throw error;
        showStatus(`A verification code was sent to ${normalizeEmail(email)}.`);
      }
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    if (!signIn) {
      showError("The sign-in service is not ready. Please try again.");
      return;
    }

    setSubmitting(true);
    showStatus(authMethod === "email-password" ? "Signing you in..." : "Sending a one-time code...");
    try {
      const result = await startSignIn({
        signIn,
        method: authMethod,
        email,
        phone,
        password,
      });
      if (result.status === "complete") {
        await onAuthDone("Welcome back. You are signed in.");
        return;
      }
      const destination = result.kind === "phone-signin" ? normalizePhone(phone) : normalizeEmail(email);
      enterVerify(result.kind, `A sign-in code was sent to ${destination}.`);
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

    setSubmitting(true);
    showStatus("Creating your account...");
    try {
      const result = await startEmailSignUp({
        signUp,
        email,
        password,
        usePassword: authMethod === "email-password",
      });
      if (result.status === "complete") {
        await onAuthDone("Your Pawline account is ready.");
        return;
      }
      enterVerify("email-signup", `A verification code was sent to ${normalizeEmail(email)}.`);
    } catch (error) {
      if (isCaptchaError(error)) {
        showError("Account creation temporarily unavailable. This is a configuration issue we're working on. Please try again later or contact support.");
      } else {
        showError(readErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    const cleanCode = code.trim();
    if (!cleanCode) {
      showError("Enter the six-digit verification code.");
      return;
    }

    setSubmitting(true);
    showStatus(verifyKind === "email-signup" ? "Verifying your email..." : "Verifying your sign-in code...");
    try {
      if (verifyKind === "email-signup") {
        await verifyEmailSignUp({ signUp, code: cleanCode });
        await onAuthDone("Your Pawline account is ready.");
      } else {
        await verifySignInCode({ signIn, kind: verifyKind, code: cleanCode });
        await onAuthDone("Welcome back. You are signed in.");
      }
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const title = isVerifying
    ? (verifyKind === "email-signup" ? "Verify your email" : "Enter your sign-in code")
    : isSignUpMode
      ? "Create a Pawline account"
      : "Sign in to Pawline";
  const submitLabel = isVerifying
    ? "Verify code"
    : isSignUpMode
      ? "Create account"
      : authMethod === "email-password"
        ? "Sign in"
        : "Send code";
  const submitHandler = isVerifying ? verifyCode : isSignUpMode ? handleSignUp : handleSignIn;
  const destination = verifyKind === "phone-signin" ? normalizePhone(phone) : normalizeEmail(email);
  const dialogCopy = isVerifying
    ? `Enter the one-time code sent to ${destination || "your account"}.`
    : isSignUpMode
      ? "Create an account with an email code or choose a password."
      : "Choose the sign-in method that works for you.";

  return <Dialog title={title} onClose={onClose} centered>
    <p className="dialog-copy">{dialogCopy}</p>
    {!isVerifying ? <div className="auth-method" aria-label="Authentication method">
      <button type="button" className={authMethod === "email-code" ? "selected" : ""} onClick={() => selectMethod("email-code")}>Email code</button>
      <button type="button" className={authMethod === "email-password" ? "selected" : ""} onClick={() => selectMethod("email-password")}>Email + password</button>
      {isSignInMode && process.env.NEXT_PUBLIC_CLERK_PHONE_SIGN_IN_ENABLED === "true" ? <button type="button" className={authMethod === "phone-code" ? "selected" : ""} onClick={() => selectMethod("phone-code")}>Phone code</button> : null}
    </div> : null}
    <form onSubmit={submitHandler}>
      {!isVerifying && authMethod !== "phone-code" ? <label>Email
        <input type="email" name="email" required value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </label> : null}
      {!isVerifying && authMethod === "phone-code" ? <label>Phone number
        <input type="tel" name="phone" required value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} placeholder="+1 415 555 0100" />
        <span className="field-help">SMS sign-in is available for U.S. and Canadian numbers.</span>
      </label> : null}
      {!isVerifying && authMethod === "email-password" ? <label>Password
        <input type="password" name="password" required value={password} autoComplete={isSignUpMode ? "new-password" : "current-password"} onChange={(event) => setPassword(event.target.value)} minLength={8} />
      </label> : null}
      {isVerifying ? <label>Verification code
        <input type="text" name="code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={8} inputMode="numeric" autoComplete="one-time-code" />
      </label> : null}
      {mode === "signup" ? <div id="clerk-captcha" /> : null}
      <button type="submit" className="button" disabled={isBusy}>
        {isBusy ? <LoaderCircle className="community-spinner" /> : submitLabel}
      </button>
    </form>
    {isVerifying ? <button type="button" className="text-action auth-modal-resend" onClick={resendVerificationCode} disabled={isBusy}>
      {isBusy ? <LoaderCircle className="community-spinner" /> : <><RefreshCcw /> Send a new code</>}
    </button> : null}
    <div className="auth-mode-switch">
      {isSignInMode ? <button type="button" onClick={() => resetMode("signup")}>Need an account? Create one</button> : null}
      {isSignUpMode ? <button type="button" onClick={() => resetMode("signin")}>Already have an account? Sign in</button> : null}
      {isVerifying ? <button type="button" onClick={() => resetMode(returnMode)}>Use a different {verifyKind === "phone-signin" ? "phone number" : "email"}</button> : null}
    </div>
    {message.text ? <p className={message.type === "error" ? "form-error" : message.type === "success" ? "form-success" : "form-status"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </Dialog>;
}
