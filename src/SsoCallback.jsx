"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { capture } from "./analytics";

export default function SsoCallback() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const hasRun = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const navigate = async ({ session, decorateUrl }) => {
      if (session?.currentTask) {
        throw new Error("Your account needs another sign-in step. Return to Pawline and try again.");
      }
      if (!cancelled) window.location.replace(decorateUrl("/"));
    };
    const finalize = async (resource, eventName) => {
      const { error } = await resource.finalize({ navigate });
      if (error) throw error;
      capture(eventName, { method: "sso" });
    };
    (async () => {
      if (!clerk.loaded || hasRun.current || !signIn || !signUp) return;
      hasRun.current = true;
      try {
        if (signIn.status === "complete") {
          await finalize(signIn, "user_signed_in");
          return;
        }

        if (signUp.isTransferable) {
          const { error } = await signIn.create({ transfer: true });
          if (error) throw error;
          if (signIn.status === "complete") {
            await finalize(signIn, "user_signed_in");
            return;
          }
        }

        if (signIn.isTransferable) {
          const { error } = await signUp.create({ transfer: true });
          if (error) throw error;
          if (signUp.status === "complete") {
            await finalize(signUp, "user_signed_up");
            return;
          }
        }

        if (signUp.status === "complete") {
          await finalize(signUp, "user_signed_up");
          return;
        }

        const sessionId = signIn.existingSession?.sessionId || signUp.existingSession?.sessionId;
        if (sessionId) {
          await clerk.setActive({ session: sessionId, navigate });
          return;
        }
        throw new Error("Google sign-in needs another step. Return to Pawline and try again.");
      } catch (error) {
        if (!cancelled) setErrorMessage(error?.errors?.[0]?.message || error?.message || "Google sign-in could not finish. Please try again.");
      }
    })();
    return () => { cancelled = true; };
  }, [clerk, signIn, signUp]);

  return <main className="next-loading" role="status">
    <p>{errorMessage || "Finishing sign-in…"}</p>
    {errorMessage ? <a href="/">Back to Pawline</a> : null}
    <div id="clerk-captcha" />
  </main>;
}
