"use client";

import Guides from "./resources/Guides";
import Methodology from "./resources/Methodology";
import NearbyGuide from "./resources/NearbyGuide";
import MatchingGuide from "./resources/MatchingGuide";

export default function MapResources({ hash }) {
  const Content = hash === "#how-pawline-works" ? Methodology : hash === "#guides/nearby" ? NearbyGuide : hash === "#guides/matching" ? MatchingGuide : Guides;
  return <div className="map-resources">{Content !== Guides ? <a className="back-action" href="#guides">← All adoption guides</a> : null}<Content /></div>;
}
