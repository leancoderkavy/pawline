// Supported Mapbox Standard overrides: docs.mapbox.com/map-styles/reference/standard/
export const PAWLINE_BASEMAP = {
  theme: "default", lightPreset: "day",
  colorLand: "#f7f1e5", colorWater: "#b8d8d2", colorGreenspace: "#c4d7b5",
  colorCommercial: "#efdfcc", colorEducation: "#e7dbc2",
  colorMedical: "#eed6cd", colorIndustrial: "#dedbd0",
  showPointOfInterestLabels: true, showTransitLabels: true,
  showPlaceLabels: true, showRoadLabels: true,
  showPedestrianRoads: true, show3dObjects: true,
};

const markers = {
  pet: { color: "#2f7458", path: "M21 42 C21 29 30 25 36 31 C43 27 49 38 46 45 C41 53 24 53 21 42 M18 23 A5 7 0 1 0 18 9 A5 7 0 1 0 18 23 M31 18 A5 7 0 1 0 31 4 A5 7 0 1 0 31 18 M44 23 A5 7 0 1 0 44 9 A5 7 0 1 0 44 23 M53 34 A5 6 0 1 0 53 22 A5 6 0 1 0 53 34" },
  shelter: { color: "#3f6380", path: "M10 29 L32 10 L54 29 M16 26 V53 H48 V26 M27 53 V36 H37 V53" },
  event: { color: "#ad5d35", path: "M14 17 H50 V53 H14 Z M14 29 H50 M23 10 V23 M41 10 V23 M24 40 H25 M38 40 H39" },
  discovery: { color: "#7a5a9b", path: "M32 8 A24 24 0 1 0 32 56 A24 24 0 1 0 32 8 M41 23 L36 36 L23 41 L28 28 Z" },
};

export function addMapMarker(map, id, type) {
  if (map.hasImage(id)) return;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return;
  const marker = markers[type];
  context.strokeStyle = marker.color;
  context.fillStyle = marker.color;
  context.lineWidth = 5;
  context.lineCap = context.lineJoin = "round";
  const path = new Path2D(marker.path);
  if (type === "pet") context.fill(path);
  else context.stroke(path);
  map.addImage(id, context.getImageData(0, 0, 64, 64));
}
