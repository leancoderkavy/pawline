"use client";

import { useState } from "react";

const PLACEHOLDER = "/pet-photo-placeholder.svg";

function Photo({ src, alt, className, fallbackText }) {
  const [failed, setFailed] = useState(false);
  const unavailable = !src || failed;
  const label = alt ? `${alt} — photo unavailable` : fallbackText;

  return (
    <img
      className={className}
      src={unavailable ? PLACEHOLDER : src}
      alt={unavailable ? label : alt}
      title={unavailable ? label : undefined}
      data-photo-state={unavailable ? "unavailable" : "source"}
      style={{ backgroundImage: `url("${PLACEHOLDER}")`, backgroundSize: "cover", backgroundPosition: "center" }}
      onError={unavailable ? undefined : () => setFailed(true)}
    />
  );
}

export default function PetImage({ src, alt = "", className = "", fallbackText = "Photo unavailable" }) {
  const source = typeof src === "string" ? src.trim() : "";
  // Reset failed-image state immediately when a different pet is selected.
  return <Photo key={source} src={source} alt={alt} className={className} fallbackText={fallbackText} />;
}
