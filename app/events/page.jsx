import { searchMetadata } from "../../src/resources/searchMetadata";
import SearchPage from "../../src/resources/SearchPage";

export const metadata = searchMetadata(
  "Pet adoption and community events",
  "Find adoption, training, clinic, and community pet events from identified organizers. Check the original event page for current dates, location, eligibility, and registration.",
  "/events",
);

export default function Page() {
  return <SearchPage title="Pet adoption and community events" path="/events">
    <section className="methodology-page">
      <article className="methodology-content">
        <p className="methodology-kicker">Pet events</p>
        <h1>Find adoption and community pet events near you</h1>
        <p className="methodology-lede">Explore upcoming adoption, training, clinic, and community pet events on the Pawline map. Event schedules and requirements can change. Open the organizer's original listing before making plans.</p>
        <p><a className="methodology-discover" href="/#events">Explore upcoming pet events on the map</a></p>

        <section aria-labelledby="event-types">
          <h2 id="event-types">What you may find</h2>
          <ul>
            <li><strong>Adoption events:</strong> opportunities to meet adoptable animals or learn about adoption.</li>
            <li><strong>Training and classes:</strong> pet behavior, handling, and owner education.</li>
            <li><strong>Clinics:</strong> services or information for pets and their people, when an organizer publishes them.</li>
            <li><strong>Community gatherings:</strong> fundraisers, food banks, and other pet-centered activities.</li>
          </ul>
          <p>Coverage depends on available public calendars and reviewed records. An event on the map does not mean every shelter or local organizer is represented.</p>
        </section>

        <section aria-labelledby="event-sources">
          <h2 id="event-sources">Current organizer calendars</h2>
          <p>Pawline currently reads public event information from these organizer calendars, then links back to their event details:</p>
          <ul>
            <li><a href="https://pasadenahumane.org/events/">Pasadena Humane</a> — adoption, training, and community events around Pasadena, California.</li>
            <li><a href="https://kingcounty.gov/en/dept/executive-services/animals-pets-pests/regional-animal-services/calendar">Regional Animal Services of King County</a> — published events around King County, Washington.</li>
          </ul>
          <p>Use the source link on each map event to confirm the date, address, registration, fees, and whether pets are welcome. Online events and announcements without a visitable location may not appear on the map.</p>
        </section>
      </article>
    </section>
  </SearchPage>;
}
