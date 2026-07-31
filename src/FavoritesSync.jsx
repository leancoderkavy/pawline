"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

async function readJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Favorites are temporarily unavailable.");
  }
  return response.json();
}

export default function FavoritesSync({ localFavorites, onLoad, onSessionChange }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const localRef = useRef(localFavorites);
  localRef.current = localFavorites;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      onSessionChange(null);
      return;
    }
    let active = true;
    const authorizedFetch = async (options = {}) => {
      const token = await getToken();
      return fetch("/api/favorites", {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
    };
    const save = async (listingId, favorite) => {
      const response = await authorizedFetch({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, favorite }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.error || "Favorite could not be saved.");
    };
    onSessionChange(save);
    authorizedFetch()
      .then(async response => {
        const body = await readJson(response);
        if (!response.ok) throw new Error(body.error || "Favorites could not be loaded.");
        const remote = Array.isArray(body.favorites) ? body.favorites : [];
        const merged = [...new Set([...remote, ...localRef.current])];
        await Promise.all(localRef.current.filter(id => !remote.includes(id)).map(id => save(id, true)));
        if (active) onLoad(merged);
      })
      .catch(() => {});
    return () => {
      active = false;
      onSessionChange(null);
    };
  }, [isLoaded, isSignedIn, userId, getToken, onLoad, onSessionChange]);

  return null;
}

