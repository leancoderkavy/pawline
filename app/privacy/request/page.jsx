import PrivacyRequestForm from "./privacy-request-form";

export const metadata = { title: "Privacy Request", description: "Send a private access, correction, or deletion request to Pawline." };

export default function PrivacyRequestPage() {
  return <main className="methodology-page">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="methodology-header"><a className="methodology-brand" href="/">Pawline</a><a className="methodology-discover" href="/privacy">Privacy policy</a></header>
    <article id="main-content" className="methodology-content legal-content" tabIndex={-1}>
      <h1>Privacy request</h1>
      <p>Ask to access, correct, or delete personal information held by Pawline. Do not include passwords, medical information, or identity documents. Pawline will verify your identity before disclosing or changing account data.</p>
      <PrivacyRequestForm />
    </article>
  </main>;
}
