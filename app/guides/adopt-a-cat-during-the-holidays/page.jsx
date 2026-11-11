import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/AdoptCatHolidays";

const title = "How to adopt a cat during the holidays";
const description = "Adopt a cat during the holiday season with a quiet landing room, lily- and tinsel-safe décor, and current shelter listings confirmed with the rescue before pickup.";
const path = "/guides/adopt-a-cat-during-the-holidays";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
