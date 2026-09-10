import { searchMetadata } from "../../../src/resources/searchMetadata";
import Content from "../../../src/resources/AdoptionChecklist";
import SearchPage from "../../../src/resources/SearchPage";

const title = "Questions to ask a shelter before adopting a pet";
const description = "Use a practical shelter visit checklist to confirm pet availability, meeting arrangements, household needs, care records, and the next adoption step.";
const path = "/guides/questions-to-ask-before-adopting";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <SearchPage title={title} path={path}><Content standalone /></SearchPage>;
}
