// Client for the Brianna chat endpoint (api/chat/brianna.ts). Sends the
// visible history and parses the SSE reply into typed callbacks.

import { getAttribution } from '../../utils/attribution';
import { getPageContext } from '../../utils/pageContext';
import { identifyVisitor } from '../../utils/hubspotTracking';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface YachtCard {
  id: string;
  title: string;
  price: string;
  year: number | null;
  lengthFt: number | null;
  location: string | null;
  image: string | null;
  // Detail fields — power the in-place expand (no re-search on click).
  images?: string[];
  make?: string | null;
  model?: string | null;
  condition?: string | null;
  cabins?: number | null;
  engines?: string | null;
  cruiseSpeed?: string | null;
  description?: string | null;
}

// The filters Brianna actually applied on a search — surfaced so the UI can
// show editable "here's what I understood" chips. All fields optional.
export interface UnderstoodFilters {
  query?: string;
  make?: string;
  category?: 'Power' | 'Sail' | string;
  condition?: 'New' | 'Used' | string;
  min_price?: number;
  max_price?: number;
  min_length_ft?: number;
  max_length_ft?: number;
  min_year?: number;
  max_year?: number;
  sort?: string;
}

export interface Understood {
  filters: UnderstoodFilters;
  count: number;
  total: number;
}

// Brianna asked the widget to render the in-chat mini contact form.
export interface LeadFormRequest {
  reason?: string;    // short "why we're asking" line shown on the form
  interest?: string;  // Brianna's summary of what the visitor wants — sent with the lead
}

export interface StreamHandlers {
  onText: (delta: string) => void;
  onYachts: (yachts: YachtCard[]) => void;
  onUnderstood?: (u: Understood) => void;
  onForm?: (f: LeadFormRequest) => void;
  onLead?: () => void;
  onError: (message: string) => void;
  onDone: () => void;
}

// Submit the in-chat mini contact form (rendered on a LeadFormRequest).
// Resolves with ok:false + a human-readable error instead of throwing.
export async function submitBriannaLead(payload: {
  name: string;
  email: string;
  phone?: string;
  interest?: string;
  brands?: string[];  // builders the visitor liked — tags boat_brands_interested
  budget?: string;    // budget range — tags the budget property
  company?: string;   // honeypot — humans never fill this
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/chat/brianna-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, attribution: getAttribution() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.error || 'Something went wrong — please try again.' };
    identifyVisitor(payload.email);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connection lost — please check your network and try again.' };
  }
}

export async function streamBriannaReply(
  messages: ChatTurn[],
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/chat/brianna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // attribution rides along so the conversational capture_lead path tags
      // paid-ad visitors the same way the mini form does.
      // page_context lets Brianna answer "tell me about this one" — she
      // otherwise has no idea which page (or boat) the visitor is looking at.
      body: JSON.stringify({ messages, attribution: getAttribution(), page_context: getPageContext() }),
      signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    handlers.onError('Connection lost — please check your network and try again.');
    handlers.onDone();
    return;
  }

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => null);
    handlers.onError(
      response.status === 429
        ? 'A moment please — you’re sending messages faster than I can read them.'
        : data?.error || 'Something went wrong — please try again.'
    );
    handlers.onDone();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (block: string) => {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let payload: any;
    try { payload = JSON.parse(data); } catch { return; }
    switch (event) {
      case 'text': handlers.onText(payload.t ?? ''); break;
      case 'yachts': handlers.onYachts(Array.isArray(payload.yachts) ? payload.yachts : []); break;
      case 'understood': handlers.onUnderstood?.(payload as Understood); break;
      case 'form': handlers.onForm?.(payload as LeadFormRequest); break;
      case 'lead': handlers.onLead?.(); break;
      case 'error': handlers.onError(payload.message || 'Something went wrong.'); break;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        dispatch(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (err: any) {
    if (err?.name !== 'AbortError') handlers.onError('The connection dropped mid-reply — please try again.');
  } finally {
    handlers.onDone();
  }
}
