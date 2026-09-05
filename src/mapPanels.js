export const JOURNEY_PANELS = ["home", "profile", "applications", "application-messages"];
export const MAP_PANELS = ["onboarding", "explore", "favorites", "match", "messages", "events", "community", "resources", "shelter", "claim", "moderation", ...JOURNEY_PANELS];

export function panelFromHash(hash = "") {
  const value = hash.replace(/^#/, "").split(/[/?]/)[0];
  if (value === "guides" || value === "how-pawline-works") return "resources";
  return MAP_PANELS.includes(value) ? value : "explore";
}

export function landingPanel(hash = "", search = "", isSignedIn = false) {
  const panel = panelFromHash(hash);
  return !isSignedIn && panel === "explore" && !new URLSearchParams(search).has("pet")
    ? "onboarding" : panel;
}

export function claimTokenFromHash(hash = "") {
  return new URLSearchParams(hash.startsWith("#claim?") ? hash.slice(7) : hash.replace(/^#/, "")).get("token") || "";
}

export function claimMapLocation(hash = "") {
  const token = claimTokenFromHash(hash);
  return token ? `/#claim?${new URLSearchParams({ token })}` : "/#claim";
}

export function panelHash(panel) {
  return panel === "explore" ? "#map" : panel === "resources" ? "#guides" : `#${MAP_PANELS.includes(panel) ? panel : "map"}`;
}
