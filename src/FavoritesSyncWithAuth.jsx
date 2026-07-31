"use client";

import FavoritesSync from "./FavoritesSync";

export default function FavoritesSyncWithAuth({ localFavorites, onLoad, onSessionChange }) {
  return <FavoritesSync localFavorites={localFavorites} onLoad={onLoad} onSessionChange={onSessionChange} />;
}
