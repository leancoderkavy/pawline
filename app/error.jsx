"use client";
import { useEffect, useRef } from "react";
import { capture } from "../src/analytics.js";

export default function GlobalError({ error, reset }) {
  const reported = useRef(null);
  useEffect(() => {
    if (reported.current !== error) { capture("app_error"); reported.current = error; }
  }, [error]);
  return <main className="next-error">
    <span aria-hidden="true">🐾</span>
    <h1>Pawline needs a moment</h1>
    <p>The map or community could not finish loading. No synthetic listings were substituted.</p>
    <button className="button" onClick={reset}>Try again</button>
  </main>;
}
