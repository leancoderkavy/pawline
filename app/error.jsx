"use client";

export default function GlobalError({ reset }) {
  return <main className="next-error">
    <span aria-hidden="true">🐾</span>
    <h1>Pawline needs a moment</h1>
    <p>The map or community could not finish loading. No synthetic listings were substituted.</p>
    <button className="button" onClick={reset}>Try again</button>
  </main>;
}
