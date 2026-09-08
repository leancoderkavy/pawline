"use client";
import React, { useCallback, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import AuthModal from "./AuthModal.jsx";
import NetworkTools, { publicRequest } from "./NetworkTools.jsx";
export default function NetworkToolsWithAuth(props) {
  const { isSignedIn, userId, getToken } = useAuth();
  const [auth, setAuth] = useState(false);
  const request = useCallback(
    async (url, options = {}) => {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      return publicRequest(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    [getToken],
  );
  return (
    <>
      <NetworkTools
        key={userId || "guest"}
        {...props}
        request={isSignedIn ? request : null}
        onSignIn={() => setAuth(true)}
      />
      {auth ? (
        <AuthModal
          onClose={() => setAuth(false)}
          onSuccess={() => setAuth(false)}
        />
      ) : null}
    </>
  );
}
