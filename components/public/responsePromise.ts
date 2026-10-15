// The response-time commitment, in one place so every form, footer, contact
// block, and sticky CTA states the same thing. Changing the promise is a
// business decision — change it here and it changes everywhere, including the
// prerendered crawler-facing HTML (scripts/seoData.ts imports this).
//
// Plain data only (no JSX), so the prerender's esbuild bundle can import it.

/** Full sentence — contact blocks, hero intros, thank-you page. */
export const RESPONSE_PROMISE = 'A broker responds within one business day.';

/** Short form — under form buttons and in tight footer space. */
export const RESPONSE_PROMISE_SHORT = 'Response within one business day';

/** First-person plural, for copy written in FYI's voice. */
export const RESPONSE_PROMISE_WE = 'We respond within one business day.';
