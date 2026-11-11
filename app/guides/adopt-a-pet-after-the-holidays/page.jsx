import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/AdoptAfterHolidays";

const title = "Why adopt a pet after the holidays";
const description = "Learn why January pet adoption can be calmer than a holiday rush, how to prepare while you wait, and how to search current shelter listings on Pawline Adopt.";
const path = "/guides/adopt-a-pet-after-the-holidays";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
