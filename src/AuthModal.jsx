"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import Dialog from "./Dialog";

const SOCIAL_PROVIDERS = [
  { strategy: "oauth_google", label: "Google", icon: GoogleMark },
  { strategy: "oauth_apple", label: "Apple", icon: AppleMark },
  { strategy: "oauth_facebook", label: "Facebook", icon: FacebookMark },
];

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePhone(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : "";
}

function readErrorMessage(error) {
  const first = error?.errors?.[0];
  const code = first?.code || error?.code;
  if (code === "captcha_invalid" || code === "captcha_unavailable") {
    return first?.longMessage || first?.long_message
      || "Account creation could not complete the security check. Refresh and try again, or disable blockers for challenges.cloudflare.com.";
  }
  const raw = first?.longMessage || first?.message || error?.message || "That request could not be completed.";
  return String(raw);
}

function GoogleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.2 2.8-2.5 3.6v3h4c2.4-2.2 3.6-5.4 3.6-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-4-3c-1.1.8-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.3v3.1C3.3 21.3 7.4 24 12 24z"/><path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4V6.5H1.3C.5 8.2 0 10.1 0 12s.5 3.8 1.3 5.5l4.1-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.1 15.2 0 12 0 7.4 0 3.3 2.7 1.3 6.5l4.1 3.1C6.3 6.8 8.9 4.8 12 4.8z"/></svg>;
}

function AppleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.3-.9-2.5-3.5zM14.7 5.6c.6-.8 1.1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.6-1.3z"/></svg>;
}

function FacebookMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.1 4.4 23.1 10.1 24v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.6 4.5-4.6 1.3 0 2.6.2 2.6.2v2.9h-1.5c-1.5 0-1.9.9-1.9 1.9v2.2h3.3l-.5 3.5h-2.8V24C19.6 23.1 24 18.1 24 12.1z"/></svg>;
}

export default function AuthModal({
  initialMode = "signin",
  onClose,
  onSuccess,
}) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : initialMode === "verify" ? "verify" : "signin");
  const [identifierKind, setIdentifierKind] = useState("email");
  const [verifyKind, setVerifyKind] = useState("email");
  const [returnMode, setReturnMode] = useState(initialMode === "signup" ? "signup" : "signin");
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
  const isPhone = identifierKind === "phone";
  const isBusy = submitting || signInFetchStatus === "fetching" || signUpFetchStatus === "fetching";

  const showError = (text) => setMessage({ type: "error", text });
  const showStatus = (text) => setMessage({ type: "status", text });
  const showSuccess = (text) => setMessage({ type: "success", text });

  const resetMode = (nextMode) => {
    setMode(nextMode);
    setReturnMode(nextMode === "signup" ? "signup" : "signin");
    setVerifyKind("email");
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

  const startSso = async (strategy) => {
    if (isBusy) return;
    setSubmitting(true);
    showStatus(`Continuing with ${strategy.replace("oauth_", "")}…`);
    try {
      if (isSignUpMode) {
        const { error } = await signUp.sso({ strategy, redirectCallbackUrl: "/sso-callback", redirectUrl: "/" });
        if (error) throw error;
      } else {
        const { error } = await signIn.sso({ strategy, redirectCallbackUrl: "/sso-callback", redirectUrl: "/" });
        if (error) throw error;
      }
    } catch (error) {
      showError(readErrorMessage(error));
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
    if (isPhone) {
      await handlePhoneSignIn();
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

  const handlePhoneSignIn = async () => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      showError("Enter a valid phone number, including country code.");
      return;
    }
    setSubmitting(true);
    showStatus("Sending a sign-in code…");
    try {
      const { error } = await signIn.create({ identifier: normalizedPhone });
      if (error) throw error;
      const sent = await signIn.phoneCode.sendCode({ phoneNumber: normalizedPhone });
      if (sent?.error) throw sent.error;
      setReturnMode("signin");
      setVerifyKind("phone-signin");
      setMode("verify");
      setCode("");
      showStatus(`A verification code was sent to ${normalizedPhone}.`);
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const requestVerificationCode = async (kind = verifyKind) => {
    if (kind === "phone-signin") {
      if (!signIn) {
        showError("The sign-in service is not ready. Please try again.");
        return false;
      }
      showStatus("Sending a fresh verification code to your phone...");
      try {
        const { error } = await signIn.phoneCode.sendCode({ phoneNumber: normalizePhone(phone) });
        if (error) throw error;
        showStatus(`A verification code was sent to ${normalizePhone(phone)}.`);
        return true;
      } catch (error) {
        showError(readErrorMessage(error));
        return false;
      }
    }
    if (kind === "phone") {
      if (!signUp) {
        showError("The account service is not ready. Please try again.");
        return false;
      }
      showStatus("Sending a fresh verification code to your phone...");
      try {
        const { error } = await signUp.verifications.sendPhoneCode();
        if (error) throw error;
        showStatus(`A verification code was sent to ${normalizePhone(phone)}.`);
        return true;
      } catch (error) {
        showError(readErrorMessage(error));
        return false;
      }
    }
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

  const handlePhoneSignUp = async () => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      showError("Enter a valid phone number, including country code.");
      return;
    }
    setSubmitting(true);
    showStatus("Creating your account…");
    try {
      const { error } = await signUp.create({ phoneNumber: normalizedPhone });
      if (error) throw error;
      if (signUp.status === "complete") {
        await finalizeAuth(signUp, "Your Pawline account is ready.");
        return;
      }
      if (signUp.status === "missing_requirements" && signUp.unverifiedFields.includes("phone_number")) {
        const sent = await signUp.verifications.sendPhoneCode();
        if (sent?.error) throw sent.error;
        setReturnMode("signup");
        setVerifyKind("phone");
        setMode("verify");
        setCode("");
        showStatus(`A verification code was sent to ${normalizedPhone}.`);
        return;
      }
      throw new Error("Your account can’t be activated yet.");
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
    if (isPhone) {
      await handlePhoneSignUp();
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
        setVerifyKind("email");
        setReturnMode("signup");
        if (await requestVerificationCode("email")) {
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

  const verifyCode = async (event) => {
    event.preventDefault();
    if (isBusy) return;
    const cleanCode = code.trim();
    if (!cleanCode) {
      showError("Enter the six-digit verification code.");
      return;
    }

    setSubmitting(true);
    showStatus(verifyKind === "email" ? "Verifying your email…" : "Verifying your phone…");
    try {
      if (verifyKind === "phone-signin") {
        if (!signIn) throw new Error("The sign-in service is not ready. Please try again.");
        const { error } = await signIn.phoneCode.verifyCode({ code: cleanCode });
        if (error) throw error;
        if (signIn.status !== "complete") throw new Error("The code was accepted, but sign-in could not be finished.");
        await finalizeAuth(signIn, "Welcome back. You are signed in.");
        return;
      }
      if (!signUp) throw new Error("The account service is not ready. Please try again.");
      const verified = verifyKind === "phone"
        ? await signUp.verifications.verifyPhoneCode({ code: cleanCode })
        : await signUp.verifications.verifyEmailCode({ code: cleanCode });
      if (verified?.error) throw verified.error;
      if (signUp.status !== "complete") throw new Error("The code was accepted, but sign-in could not be finished.");
      await finalizeAuth(signUp, "Your Pawline account is ready.");
    } catch (error) {
      showError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === "verify"
    ? (verifyKind === "email" ? "Verify your email" : "Verify your phone")
    : mode === "signup" ? "Create a Pawline account" : "Sign in to Pawline";
  const submitLabel = mode === "verify" ? "Verify code" : isPhone ? "Send code" : mode === "signup" ? "Create account" : "Sign in";
  const submitHandler = mode === "verify" ? verifyCode : mode === "signup" ? handleSignUp : handleSignIn;
  const destination = verifyKind === "email" ? (normalizeEmail(email) || "your inbox") : (normalizePhone(phone) || "your phone");

  return <Dialog title={title} onClose={onClose} centered>
    <p className="dialog-copy">Use email, phone, or a social account to keep your Pawline identity private and portable across listing tools.</p>
    {mode !== "verify" ? <>
      <div className="auth-social">
        {SOCIAL_PROVIDERS.map(({ strategy, label, icon: Icon }) => (
          <button key={strategy} type="button" className="auth-social-button" disabled={isBusy} onClick={() => startSso(strategy)}>
            <Icon /> Continue with {label}
          </button>
        ))}
      </div>
      <p className="auth-divider"><span>or</span></p>
      <div className="auth-method" role="radiogroup" aria-label="Sign-in method">
        <button type="button" role="radio" aria-checked={!isPhone} onClick={() => setIdentifierKind("email")}>Email</button>
        <button type="button" role="radio" aria-checked={isPhone} onClick={() => setIdentifierKind("phone")}>Phone</button>
      </div>
    </> : null}
    <form onSubmit={submitHandler}>
      {mode !== "verify" && !isPhone ? <label>Email
        <input type="email" name="email" required value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </label> : null}
      {mode !== "verify" && isPhone ? <label>Phone
        <input type="tel" name="phone" required value={phone} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 555 0100" />
      </label> : null}
      {mode === "verify" ? <p className="auth-modal-note">Code sent to {destination}.</p> : null}
      {mode !== "verify" && !isPhone ? <label>Password
        <input type="password" name="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={8} />
      </label> : null}
      {mode === "verify" ? <label>Verification code
        <input type="text" name="code" required value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" maxLength={8} inputMode="numeric" />
      </label> : null}
      {isSignUpMode ? <div id="clerk-captcha" className="auth-captcha" /> : null}
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
      {isVerifying ? <button type="button" onClick={() => resetMode(returnMode)}>{verifyKind === "email" ? "Use a different email" : "Use a different number"}</button> : null}
    </div>
      {message.text ? <p className={message.type === "error" ? "form-error" : message.type === "success" ? "form-success" : "form-status"} role={message.type === "error" ? "alert" : "status"}>{message.text}</p> : null}
  </Dialog>;
}
