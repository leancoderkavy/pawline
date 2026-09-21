"use client";

import { useEffect, useRef } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { capture } from "./analytics";

function goHome() {
  window.location.replace("/");
}

export default function SsoCallback() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const hasRun = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clerk.loaded || hasRun.current || !signIn || !signUp) return;
      hasRun.current = true;
      try {
        if (signIn.status === "complete") {
          const { error } = await signIn.finalize();
          if (error) throw error;
          capture("user_signed_in", { method: "sso" });
          if (!cancelled) goHome();
          return;
        }

        if (signUp.isTransferable) {
          await signIn.create({ transfer: true });
          if (signIn.status === "complete") {
            const { error } = await signIn.finalize();
            if (error) throw error;
            capture("user_signed_in", { method: "sso" });
            if (!cancelled) goHome();
            return;
          }
        }

        if (signIn.isTransferable) {
          await signUp.create({ transfer: true });
          if (signUp.status === "complete") {
            const { error } = await signUp.finalize();
            if (error) throw error;
            capture("user_signed_up", { method: "sso" });
            if (!cancelled) goHome();
            return;
          }
        }

        if (signUp.status === "complete") {
          const { error } = await signUp.finalize();
          if (error) throw error;
          capture("user_signed_up", { method: "sso" });
          if (!cancelled) goHome();
          return;
        }

        const sessionId = signIn.existingSession?.sessionId || signUp.existingSession?.sessionId;
        if (sessionId) {
          await clerk.setActive({ session: sessionId });
          if (!cancelled) goHome();
          return;
        }
      } catch {
        // Fall through to the map so the visitor can retry from the account modal.
      }
      if (!cancelled) goHome();
    })();
    return () => { cancelled = true; };
  }, [clerk, signIn, signUp]);

  return <main className="next-loading" role="status">
    <p>Finishing sign-in…</p>
    <div id="clerk-captcha" />
  </main>;
}
