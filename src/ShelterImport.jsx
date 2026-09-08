"use client";
import React, { useState } from "react";
import "./networkTools.css";
export default function ShelterImport({ organizationId, request }) {
  const [csv, setCsv] = useState(""),
    [preview, setPreview] = useState(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function submit(action) {
    setBusy(true);
    setNotice("");
    try {
      const result = await request("/api/shelter-import", {
        method: "POST",
        body: JSON.stringify({
          organizationId,
          csv,
          action,
          authorityConfirmed: confirmed,
        }),
      });
      if (action === "preview") setPreview(result);
      else {
        setPreview(null);
        setCsv("");
        setNotice(result.message);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="network-tools">
      <summary>Import shelter pets from CSV</summary>
      <p>
        Import up to 200 pets. Keep external_id stable to update the same animal
        on later imports. Every import is held for review before publication.
      </p>
      <a href="/shelter-pets-template.csv" download>
        Download CSV template
      </a>
      <label>
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            setPreview(null);
            setConfirmed(false);
            setCsv("");
            setNotice("");
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 200000) {
              setNotice("Choose a CSV smaller than 200 KB.");
              return;
            }
            setCsv(await file.text());
          }}
        />
      </label>
      <button disabled={busy || !csv} onClick={() => submit("preview")}>
        Preview import
      </button>
      {preview ? (
        <>
          <p>
            {preview.pets.length} valid pets · {preview.errors.length} errors
          </p>
          {preview.errors.map((error) => (
            <p key={error.row}>
              Row {error.row}: {error.error}
            </p>
          ))}
          <ul>
            {preview.pets.slice(0, 10).map((pet) => (
              <li key={pet.externalId}>
                {pet.externalId}: {pet.name} · {pet.species}
              </li>
            ))}
          </ul>
          <label className="network-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I am authorized to share these records and images for this
            organization.
          </label>
          <button
            disabled={busy || !confirmed || Boolean(preview.errors.length)}
            onClick={() => submit("import")}
          >
            Import for review
          </button>
        </>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </details>
  );
}
