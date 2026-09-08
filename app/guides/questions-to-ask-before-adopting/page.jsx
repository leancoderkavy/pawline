import Content from "../../../src/resources/AdoptionChecklist";
import SearchPage from "../../../src/resources/SearchPage";

const title = "Questions to ask a shelter before adopting a pet";
const description = "Use a practical shelter visit checklist to confirm pet availability, meeting arrangements, household needs, care records, and the next adoption step.";
const path = "/guides/questions-to-ask-before-adopting";
export const metadata = {
  title, description, alternates: { canonical: path },
  openGraph: { title, description, url: path, type: "website", images: ["/social-card.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/social-card.png"] },
};

export default function Page() {
  return <SearchPage title={title} path={path}><Content standalone /></SearchPage>;
}
