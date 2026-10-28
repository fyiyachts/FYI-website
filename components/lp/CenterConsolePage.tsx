// /lp/center-consoles — landing page for the ChatGPT (OpenAI) Ads center
// console campaign. Visitors arrive mid-research from a chat ad; the page has
// one job: get them through the "Get matched" step form.
//
// noindex and kept out of the nav and the sitemap (scripts/seoData.ts marks
// the route noindex; vercel.json adds X-Robots-Tag). The ad's UTMs are stored
// at startup by utils/attribution and ride along with the lead.
//
// This route component is the header + hero (with the quick contact form),
// which the app hydrates from the prerendered HTML (index.tsx), so the first
// paint is never replaced. Everything below the hero is its own chunk
// (CenterConsoleLanding), fetched on mount.

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { track } from '../../utils/analytics';
import { usePageMeta } from '../../utils/usePageMeta';
import { CC_HERO, LP_CONTEXT, LP_DESCRIPTION, LP_PATH, LP_TITLE, QUICK_FORM } from './ccContent';
import { LpFooter, LpShell, readLpCount, scrollToId } from './LpChrome';
import QuickForm from './QuickForm';
import { submitCcLead, trackPhoneClick } from './submitLead';
import type { BodyProps } from './CenterConsoleLanding';

const loadBody = () => import('./CenterConsoleLanding');

export default function CenterConsolePage() {
  usePageMeta(LP_TITLE, LP_DESCRIPTION, LP_PATH);
  // The build's count until the body reports the live one.
  const [count, setCount] = useState(readLpCount);
  const [Body, setBody] = useState<ComponentType<BodyProps> | null>(null);
  const pending = useRef<{ id: string; focusId?: string } | null>(null);

  // noindex for the client-rendered page too. The built HTML already carries
  // the tag (and vercel.json the header); add one only if it is missing.
  useEffect(() => {
    if (document.head.querySelector('meta[name="robots"]')) return;
    const el = document.createElement('meta');
    el.name = 'robots';
    el.content = 'noindex';
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  useEffect(() => {
    let alive = true;
    // One retry: a chunk request can drop on a flaky phone connection. If both
    // fail, the hero's phone number is still there.
    loadBody()
      .catch(() => new Promise((r) => setTimeout(r, 1500)).then(loadBody))
      .then((m) => { if (alive) setBody(() => m.default); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // A hero link tapped before the rest of the page arrived lands once it has.
  useEffect(() => {
    const p = pending.current;
    if (!Body || !p) return;
    pending.current = null;
    requestAnimationFrame(() => scrollToId(p.id, p.focusId));
  }, [Body]);

  const go = (id: string, focusId?: string) => {
    if (!scrollToId(id, focusId)) pending.current = { id, ...(focusId ? { focusId } : {}) };
  };

  return (
    <LpShell
      hero={{
        ...CC_HERO,
        count,
        form: (
          <QuickForm
            {...QUICK_FORM}
            placement="hero"
            onSubmit={(c, guard) => submitCcLead({ kind: 'quick', ...c }, guard)}
            onPhoneClick={trackPhoneClick}
            onMore={() => {
              track('lp_more_click', { context: LP_CONTEXT });
              go('get-matched', 'lp-form-title');
            }}
          />
        ),
        onBrowse: (e) => { e.preventDefault(); go('inventory'); },
      }}
      onPhoneClick={trackPhoneClick}
      footer={Body ? <LpFooter onPhoneClick={trackPhoneClick} /> : null}
    >
      {Body ? <Body onCount={setCount} /> : null}
    </LpShell>
  );
}
