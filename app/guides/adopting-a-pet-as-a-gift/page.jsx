import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/AdoptingPetAsGift";

const title = "Adopting a pet as a gift—responsibly";
const description = "Learn how to approach pets as gifts with caregiver consent, shelter applications done by the right person, and better holiday alternatives to surprise adoptions.";
const path = "/guides/adopting-a-pet-as-a-gift";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
