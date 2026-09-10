import { searchMetadata } from "../../src/resources/searchMetadata";
import Content from "../../src/resources/Guides";
import SearchPage from "../../src/resources/SearchPage";

export const metadata = searchMetadata("Pet adoption guides", "Practical guides to finding adoptable dogs and cats, comparing listing facts with your household, and confirming details with the original shelter.", "/guides");

export default function Page() {
  return <SearchPage title="Pet adoption guides" path="/guides"><Content standalone /></SearchPage>;
}
