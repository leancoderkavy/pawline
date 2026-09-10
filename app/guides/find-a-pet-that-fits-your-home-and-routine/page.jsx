import { searchMetadata } from "../../../src/resources/searchMetadata";
import Content from "../../../src/resources/MatchingGuide";
import SearchPage from "../../../src/resources/SearchPage";

export const metadata = searchMetadata("Find a pet that fits your home and routine", "Compare adoptable pet listing facts with your home, daily routine, household, and experience. Learn which questions to confirm with a shelter or rescue.", "/guides/find-a-pet-that-fits-your-home-and-routine");

export default function Page() {
  return <SearchPage title="Find a pet that fits your home and routine" path="/guides/find-a-pet-that-fits-your-home-and-routine"><Content standalone /></SearchPage>;
}
