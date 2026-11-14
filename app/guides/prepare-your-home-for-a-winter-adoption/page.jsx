import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/PrepareHomeWinterAdoption";

const title = "Prepare your home for a winter pet adoption";
const description = "Prepare your home for a winter pet adoption with a quiet arrival zone, core supplies, antifreeze and holiday hazard controls, and a first-week routine before shelter pickup.";
const path = "/guides/prepare-your-home-for-a-winter-adoption";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content standalone />
  </GuideArticlePage>;
}
