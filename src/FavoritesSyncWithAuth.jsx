"use client";

import FavoritesSync from "./FavoritesSync";

export default function FavoritesSyncWithAuth({ localFavorites, onLoad, onSessionChange, onError }) {
  return <FavoritesSync localFavorites={localFavorites} onLoad={onLoad} onSessionChange={onSessionChange} onError={onError} />;
}
