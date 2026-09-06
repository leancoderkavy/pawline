import Content from "../../../src/resources/NearbyGuide";
import SearchPage from "../../../src/resources/SearchPage";

export const metadata = {
  title: "How to find adoptable dogs and cats near you",
  description: "Search for adoptable dogs and cats near you, understand listing sources, and confirm availability with a shelter or rescue before visiting or applying.",
  alternates: { canonical: "/guides/find-adoptable-pets-near-you" },
  openGraph: { title: "How to find adoptable dogs and cats near you | Pawline", description: "Search for adoptable dogs and cats near you, understand listing sources, and confirm availability with a shelter or rescue before visiting or applying.", url: "/guides/find-adoptable-pets-near-you", type: "website", images: ["/social-card.png"] },
  twitter: { card: "summary_large_image", title: "How to find adoptable dogs and cats near you | Pawline", description: "Search for adoptable dogs and cats near you, understand listing sources, and confirm availability with a shelter or rescue before visiting or applying.", images: ["/social-card.png"] },
};

export default function Page() {
  return <SearchPage title="How to find adoptable dogs and cats near you" path="/guides/find-adoptable-pets-near-you"><Content standalone /></SearchPage>;
}
