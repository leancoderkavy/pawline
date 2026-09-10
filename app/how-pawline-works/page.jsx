import { searchMetadata } from "../../src/resources/searchMetadata";
import Content from "../../src/resources/Methodology";
import SearchPage from "../../src/resources/SearchPage";

export const metadata = searchMetadata("How Pawline checks adoption listing sources", "Understand Pawline listing sources, approximate web leads, availability checks, and transparent pet matching before contacting a shelter or rescue.", "/how-pawline-works");

export default function Page() {
  return <SearchPage title="How Pawline checks adoption listing sources" path="/how-pawline-works"><Content standalone /></SearchPage>;
}
