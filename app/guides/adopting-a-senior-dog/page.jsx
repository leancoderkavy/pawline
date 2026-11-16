import GuideArticlePage, { searchMetadata } from "../../../src/resources/GuideArticlePage";
import Content, { faqItems, howToSteps } from "../../../src/resources/AdoptingASeniorDog";

const title = "Adopting a Senior Dog: What to Know Before You Bring One Home";
const description = "Thinking about adopting a senior dog? Learn what counts as senior, questions to ask the shelter, how often older dogs see the vet, and how to set up your home.";
const path = "/guides/adopting-a-senior-dog";
export const metadata = searchMetadata(title, description, path);

export default function Page() {
  return <GuideArticlePage title={title} description={description} path={path} faqItems={faqItems} howToSteps={howToSteps} datePublished="2026-11-16">
    <Content />
  </GuideArticlePage>;
}
