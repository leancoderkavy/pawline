"use client";

import { useEffect } from "react";
import { captureException } from "../src/analytics";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return <main className="next-error">
    <span aria-hidden="true">🐾</span>
    <h1>Pawline needs a moment</h1>
    <p>The map or community could not finish loading. No synthetic listings were substituted.</p>
    <button className="button" onClick={reset}>Try again</button>
  </main>;
}
