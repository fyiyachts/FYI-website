// Client half of the public-form spam defenses (server half: api/_lib/leadGuard.ts).
//
// Two signals, both invisible to a real visitor:
//   - `company`      a honeypot input, positioned off-screen and aria-hidden.
//                    Humans never see it; scripted form-fillers fill everything.
//   - `formOpenedAt` when the form first rendered. A submission that arrives
//                    less than two seconds later was not typed by a person.
//
// Both are advisory: a bot that POSTs straight at the API — which is how the
// September 2026 junk arrived — simply omits them, and the server's own field
// validation and rate limits are what stop that. These catch the browser-driven
// form fillers that would otherwise sail through those checks.
//
// Usage:
//   const guard = useFormGuard();
//   ... body: JSON.stringify({ name, email, ...guardFields(guard) })
//   ... <HoneypotField guard={guard} /> inside the <form>

import { useId, useRef, useState } from 'react';

export interface FormGuard {
  company: string;
  setCompany: (v: string) => void;
  /** Epoch ms of first render. */
  formOpenedAt: number;
  /** Unique DOM id, so several guarded forms can share one page. */
  fieldId: string;
}

export function useFormGuard(): FormGuard {
  const [company, setCompany] = useState('');
  // useRef, not useState: the timestamp is captured once on mount and must not
  // move when the component re-renders as the visitor types.
  const openedAt = useRef(Date.now());
  return { company, setCompany, formOpenedAt: openedAt.current, fieldId: `${useId()}hp` };
}

/** Spread into a lead request body alongside name/email/message. */
export function guardFields(g: FormGuard): { company: string; formOpenedAt: number } {
  return { company: g.company, formOpenedAt: g.formOpenedAt };
}

/**
 * The honeypot input. Taken out of the visual and accessibility trees without
 * `display:none` — some bots skip hidden inputs, but few compute layout — and
 * out of the tab order, so a keyboard user never lands on it either.
 *
 * Nothing about it may look like a real field to browser autofill or a
 * password manager. It used to be name="company" / label "Company": Chrome
 * filled it with the visitor's organization along with their name, email and
 * phone, and the lead was dropped as a bot (a real test lead, 2026-10-28).
 * autocomplete="off" doesn't stop that, so the name and label carry no
 * meaning and the password-manager opt-outs are set. The request field stays
 * `company` (guardFields) — only the markup changed.
 */
export function HoneypotField({ guard }: { guard: FormGuard }) {
  return (
    <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
      <label htmlFor={guard.fieldId}>Leave this field empty</label>
      <input
        id={guard.fieldId}
        name="hp_check_7f"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        data-1p-ignore=""
        data-lpignore="true"
        data-form-type="other"
        value={guard.company}
        onChange={(e) => guard.setCompany(e.target.value)}
      />
    </div>
  );
}
