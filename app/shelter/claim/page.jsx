"use client";

import { useEffect } from "react";
import { claimMapLocation } from "../../../src/mapPanels";

export default function LegacyClaimPage() {
  useEffect(() => {
    // Invitation credentials stay in the fragment and never reach the server.
    window.location.replace(claimMapLocation(window.location.hash));
  }, []);
  return <p role="status">Opening the organization claim on your map…</p>;
}
