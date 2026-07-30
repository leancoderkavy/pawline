import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const ClerkProvider = clerkKey
  ? lazy(() => import("@clerk/react").then(module => ({ default: module.ClerkProvider })))
  : null;
const application = clerkKey
  ? <Suspense fallback={<div className="app-loading" role="status">Opening Pawline…</div>}><ClerkProvider publishableKey={clerkKey}><App clerkConfigured /></ClerkProvider></Suspense>
  : <App clerkConfigured={false} />;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>{application}</React.StrictMode>
);
