import { searchBreadcrumbs, searchPageSchema, searchResources } from "./searchCatalog";

export default function SearchPage({ title, path, children }) {
  const crumbs = searchBreadcrumbs(title, path);
  const schema = searchPageSchema(title, path);
  const resource = searchResources.find(item => item.path === path);
  return <>
    <nav className="search-page-nav" aria-label="Pawline navigation">
      <a href="/#map">Pawline adoption map</a>
      <a href="/guides">Adoption guides</a>
    </nav>
    <main>
      <nav className="search-breadcrumbs" aria-label="Breadcrumb">
        <ol>{crumbs.map((crumb, index) => <li key={crumb.path}>
          {index === crumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <a href={crumb.path}>{crumb.name}</a>}
        </li>)}</ol>
      </nav>
      {resource && <p className="search-breadcrumbs">{resource.description}</p>}
      {children}
      {path !== "/guides" && <aside className="search-related" aria-label="Related adoption guides">
        <h2>Keep planning your adoption</h2>
        <ul>{searchResources.filter(resource => resource.path !== path && resource.path !== "/guides").map(resource =>
          <li key={resource.path}><a href={resource.path}>{resource.title}</a><p>{resource.description}</p></li>)}</ul>
      </aside>}
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
  </>;
}
