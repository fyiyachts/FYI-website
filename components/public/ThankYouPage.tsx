import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Phone } from 'lucide-react';
import { PublicShell, PageHero } from './PublicPages';
import { usePageMeta } from '../../utils/usePageMeta';
import { track, trackAdsConversion } from '../../utils/analytics';
import { RESPONSE_PROMISE } from './responsePromise';

/**
 * Post-submission thank-you page.
 *
 * Why a routed page and not just the inline "message sent" state: an inline
 * state has no URL, so there is nothing for GA4, Google Ads, or Meta to fire a
 * conversion on — every lead the site generated was invisible to the ad
 * platforms. `/thank-you` gives the conversion a destination.
 *
 * `?ctx=` carries the form context (e.g. "Sell my yacht") so the event is
 * attributable and the copy can name what they asked about; `?from=` carries
 * the page they submitted from so we can offer a way back. Both are display-
 * only and untrusted — never rendered as HTML, and `from` is validated as a
 * same-site path before being used as a link.
 */

/** Only allow a same-site absolute path back — no protocol-relative or external URLs. */
function safeReturnPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function ThankYouPage() {
  const [params] = useSearchParams();
  const context = params.get('ctx') || '';
  const back = safeReturnPath(params.get('from'));

  usePageMeta(
    'Thank You | FYI Yachts',
    'Thanks for reaching out to Florida Yachts International. A broker responds within one business day.',
  );

  // The conversion event. Fired once on mount, which is exactly what a
  // thank-you page is for — a GA4 key event / Ads conversion can be
  // configured against `generate_lead` with no further tagging.
  useEffect(() => {
    track('generate_lead', { context: context || 'website form', page_path: '/thank-you' });
    // The Google Ads conversion the WP thank-you page fired — same send_to,
    // so the Ads account keeps counting leads through the cutover unchanged.
    trackAdsConversion(context || 'website form');
  }, [context]);

  // Thank-you pages should never rank or appear in search — they are a step in
  // a funnel, not content, and an indexed one leaks into results.
  useEffect(() => {
    const el = document.createElement('meta');
    el.name = 'robots';
    el.content = 'noindex, follow';
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  return (
    <PublicShell>
      <PageHero
        eyebrow="Inquiry received"
        h1="Thank you — your inquiry is in"
        intro={`${context ? `We've got your ${context.toLowerCase()} inquiry. ` : ''}${RESPONSE_PROMISE} If it's urgent, call us and we'll pick up.`}
      />

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yacht-brand">What happens next</h2>
            <ol className="mt-8 space-y-7">
              {([
                ['A consultant reads your inquiry', 'It goes straight to the broker who knows the vessel or the market segment — not a shared inbox nobody owns.'],
                ['You hear back within one business day', 'By phone or email, whichever you gave us. If we need to reach you sooner, we call.'],
                ['We get to the real question', 'What you want the boat to do, where you plan to run her, and what the number needs to look like — before anyone talks about paperwork.'],
              ] as [string, string][]).map(([title, body], i) => (
                <li key={title} className="flex gap-5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center border border-yacht-brand/40 text-[13px] font-medium text-yacht-brand">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium tracking-wide text-yacht-900">{title}</span>
                    <span className="mt-1.5 block text-[14px] font-light leading-7 text-yacht-900/65">{body}</span>
                  </span>
                </li>
              ))}
            </ol>

            <a
              href="tel:+13058546020"
              onClick={() => track('phone_click', { context: 'Thank you page', placement: 'body' })}
              className="mt-10 inline-flex items-center gap-3 bg-yacht-900 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-white transition-colors hover:bg-yacht-900/90"
            >
              <Phone className="h-4 w-4 text-yacht-teal" aria-hidden="true" />
              305-854-6020
            </a>
          </div>

          <div className="border border-yacht-900/10 bg-white p-8 lg:p-10">
            <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-yacht-900/45">
              <Check className="h-4 w-4 text-yacht-brand" aria-hidden="true" />
              While you wait
            </p>
            <ul className="mt-6 space-y-4">
              {([
                ['Browse the live inventory', '/yachts-for-sale'],
                ['See a selection of our sold boats', '/sold-yachts'],
                ['Read our client results', '/case-studies'],
                ['Meet the consultants', '/our-team'],
                ['Charter before you buy', '/charter'],
                ['Understand yacht financing', '/yacht-financing'],
              ] as [string, string][]).map(([label, href]) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="group flex items-center justify-between gap-4 border-b border-yacht-900/10 pb-4 text-[15px] font-light text-yacht-900/80 transition-colors hover:text-yacht-brand"
                  >
                    {label}
                    <ArrowRight className="h-4 w-4 flex-none text-yacht-900/25 transition-transform group-hover:translate-x-1 group-hover:text-yacht-brand" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>

            {back && (
              <Link to={back} className="mt-8 inline-block text-[13px] font-light text-yacht-900/55 underline transition-colors hover:text-yacht-brand">
                &larr; Back to where you left off
              </Link>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
