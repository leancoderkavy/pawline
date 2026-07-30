import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./styles.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const application = clerkKey
  ? <ClerkProvider publishableKey={clerkKey}><App clerkConfigured /></ClerkProvider>
  : <App clerkConfigured={false} />;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>{application}</React.StrictMode>
);
