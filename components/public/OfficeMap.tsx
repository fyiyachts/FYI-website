import { Car, MapPin, Navigation } from 'lucide-react';
import { track } from '../../utils/analytics';

/**
 * Office location: an embedded map plus real "get directions" deep links.
 *
 * The contact page previously printed the street address as plain text. The
 * LocalBusiness JSON-LD carries `geo` and `hasMap`, but that is for crawlers —
 * a person trying to drive to Coral Way needs something to tap. Apple Maps is
 * listed alongside Google because a large share of the audience is on iOS and
 * a maps.google.com link there is a detour through the browser.
 *
 * OpenStreetMap's embed is used rather than the Google Maps iframe for the
 * same reason the vessel LocationMap does: no API key to provision or rotate,
 * and no third-party cookie dropped on a page that also runs ad pixels.
 */

export const OFFICE = {
  name: 'Florida Yachts International',
  street: '2424 Coral Way',
  city: 'Miami',
  region: 'FL',
  postal: '33145',
  // Geocoded from the street address (Nominatim, 2026-08-21). The previous pair
  // — 25.7492, -80.2635 — was about 2.9 km too far west and dropped the marker
  // on Miracle Mile in Coral Gables, which is a different city from the office
  // (client, 2026-08-21: "this PIN is way wrong"). If the address ever changes,
  // re-geocode rather than nudging these by hand.
  lat: 25.750181,
  lon: -80.235102,
} as const;

export const OFFICE_ADDRESS = `${OFFICE.street}, ${OFFICE.city}, ${OFFICE.region} ${OFFICE.postal}`;

const QUERY = encodeURIComponent(`${OFFICE.name}, ${OFFICE_ADDRESS}`);

/** Universal link — resolves to the Google Maps app on mobile, web elsewhere. */
export const GOOGLE_DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${QUERY}`;
/** Apple Maps opens natively on iOS/macOS and falls back to a web map. */
export const APPLE_DIRECTIONS = `https://maps.apple.com/?daddr=${QUERY}`;

export function OfficeMap({ heading = 'Find us' }: { heading?: string }) {
  const bbox = `${OFFICE.lon - 0.008},${OFFICE.lat - 0.005},${OFFICE.lon + 0.008},${OFFICE.lat + 0.005}`;

  return (
    <section className="border-t border-yacht-900/10">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">{heading}</p>
        <h2 className="mt-4 text-2xl font-light tracking-wide text-yacht-900 lg:text-3xl">
          {OFFICE.street}, {OFFICE.city}
        </h2>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div className="overflow-hidden border border-yacht-900/10 bg-white">
            <iframe
              title={`Map of ${OFFICE.name}, ${OFFICE_ADDRESS}`}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${OFFICE.lat},${OFFICE.lon}`}
              className="h-80 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div>
            <p className="flex items-start gap-3 text-[15px] font-light leading-7 text-yacht-900/75">
              <MapPin className="mt-1 h-4 w-4 flex-none text-yacht-brand" aria-hidden="true" />
              <span>
                {OFFICE.name}
                <br />
                {OFFICE.street}
                <br />
                {OFFICE.city}, {OFFICE.region} {OFFICE.postal}
              </span>
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <a
                href={GOOGLE_DIRECTIONS}
                target="_blank"
                rel="noreferrer"
                onClick={() => track('directions_click', { provider: 'google' })}
                className="inline-flex items-center justify-center gap-3 bg-yacht-brand px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-brand-light"
              >
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Get directions
              </a>
              <a
                href={APPLE_DIRECTIONS}
                target="_blank"
                rel="noreferrer"
                onClick={() => track('directions_click', { provider: 'apple' })}
                className="inline-flex items-center justify-center gap-3 border border-yacht-900/20 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900 transition-colors hover:border-yacht-brand hover:text-yacht-brand"
              >
                <Car className="h-4 w-4" aria-hidden="true" />
                Open in Apple Maps
              </a>
            </div>

            <p className="mt-6 text-[13px] font-light leading-7 text-yacht-900/55">
              {/* "SW 24th Street" was wrong twice over: Coral Way IS SW 22nd Street,
                  so it cannot meet SW 24th Street, and the 2424 block sits at the
                  SW 24th AVENUE crossing. */}
              Coral Way at SW 24th Avenue, minutes from Coral Gables, Coconut Grove, and Brickell.
              Charters depart separately from Bayshore Landing, 2550 S Bayshore Drive, Coconut Grove.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
