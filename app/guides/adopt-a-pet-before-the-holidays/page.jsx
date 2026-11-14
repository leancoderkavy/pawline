import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/AdoptBeforeHolidays";

const title = "How to adopt a pet before the holidays";
const description = "Decide whether to adopt a dog or cat before Christmas or Thanksgiving, prepare your home for guests and travel, and confirm current shelter listings before you apply.";
const path = "/guides/adopt-a-pet-before-the-holidays";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
