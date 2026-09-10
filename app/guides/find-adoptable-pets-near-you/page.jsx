import { searchMetadata } from "../../../src/resources/searchMetadata";
import Content from "../../../src/resources/NearbyGuide";
import SearchPage from "../../../src/resources/SearchPage";

export const metadata = searchMetadata("How to find adoptable dogs and cats near you", "Search for adoptable dogs and cats near you, understand listing sources, and confirm availability with a shelter or rescue before visiting or applying.", "/guides/find-adoptable-pets-near-you");

export default function Page() {
  return <SearchPage title="How to find adoptable dogs and cats near you" path="/guides/find-adoptable-pets-near-you"><Content standalone /></SearchPage>;
}
