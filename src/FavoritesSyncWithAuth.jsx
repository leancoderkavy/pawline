"use client";

import { ClerkProvider } from "@clerk/nextjs";
import FavoritesSync from "./FavoritesSync";

export default function FavoritesSyncWithAuth({ publishableKey, localFavorites, onLoad, onSessionChange }) {
  return <ClerkProvider publishableKey={publishableKey}>
    <FavoritesSync localFavorites={localFavorites} onLoad={onLoad} onSessionChange={onSessionChange} />
  </ClerkProvider>;
}
