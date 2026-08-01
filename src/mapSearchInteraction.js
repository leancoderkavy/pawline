export function createMapSearchInteraction(onSearch) {
  let hasPendingUserMove = false;

  return {
    start(event) {
      if (event?.originalEvent) hasPendingUserMove = true;
    },
    finish(center) {
      if (!hasPendingUserMove || !center) return false;
      hasPendingUserMove = false;
      onSearch({
        longitude: Number(center.lng),
        latitude: Number(center.lat),
      });
      return true;
    },
  };
}
