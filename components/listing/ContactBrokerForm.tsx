import { useState } from 'react';
import type { YachtListing } from '../../types/yacht';
import { useAuth } from '../auth/AuthProvider';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { getAttribution } from '../../utils/attribution';
import { useFormGuard, guardFields, HoneypotField } from '../../utils/formGuard';
import { identifyVisitor } from '../../utils/hubspotTracking';
import { track, trackAdsConversion } from '../../utils/analytics';

interface Props {
  yacht: YachtListing;
}

export default function ContactBrokerForm({ yacht }: Props) {
  const { email: userEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(userEmail || '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(`I'm interested in the ${yacht.title}. Please provide more information.`);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const guard = useFormGuard();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) { setError('Please fill in all required fields.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/contact/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name, email, phone, message,
          attribution: getAttribution(),
          ...guardFields(guard),
          yacht: {
            title: yacht.title,
            price: yacht.price,
            year: yacht.specs.year,
            make: yacht.specs.make,
            model: yacht.specs.model,
            length: yacht.specs.length,
            location: yacht.location,
          },
        }),
      });
      if (!res.ok) {
        // The lead guard answers with a reason a person can act on ("please
        // enter a valid email address"), so show it instead of a generic
        // failure — a real visitor tripping a rule needs to know what to fix.
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error || 'Failed to send');
      }
      identifyVisitor(email);
      // This form confirms inline (navigating away would lose the listing),
      // so the lead + Ads conversion fire here instead of on /thank-you.
      track('generate_lead', { context: 'Listing inquiry', page_path: window.location.pathname });
      trackAdsConversion('Listing inquiry');
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send inquiry.');
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h3 className="text-white font-medium text-sm mb-1">Inquiry Sent!</h3>
        <p className="text-white/50 text-xs">A broker will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
        <Send className="w-4 h-4 text-yacht-brand" />Contact Broker
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your Name *"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yacht-brand/30" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email *"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yacht-brand/30" />
        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yacht-brand/30" />
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Message *"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-yacht-brand/30 resize-none" />
        <HoneypotField guard={guard} />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-yacht-brand hover:bg-yacht-brand/90 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />Send Inquiry</>}
        </button>
      </form>
    </div>
  );
}
