import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/HolidayTravelAdoptionTiming";

const title = "Holiday travel and pet adoption timing";
const description = "Decide whether to adopt a dog or cat before holiday travel, ask shelters about holds and delayed pickup, and shortlist current listings until you can stay home to settle in.";
const path = "/guides/holiday-travel-and-pet-adoption-timing";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
