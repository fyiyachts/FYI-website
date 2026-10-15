import { useState, useRef, useEffect } from 'react';
import { Share2, Check, Link as LinkIcon, Mail, MessageSquare } from 'lucide-react';

interface Props {
  yachtId: string;
  title: string;
}

export default function ShareButton({ yachtId, title }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const url = `${window.location.origin}/yacht/${yachtId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Check out this yacht: ${title}`);
    const body = encodeURIComponent(`I found this yacht on FYI Yachts and thought you might be interested:\n\n${title}\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    setOpen(false);
  };

  const handleText = () => {
    const body = encodeURIComponent(`Check out this yacht: ${title} ${url}`);
    window.open(`sms:?body=${body}`, '_self');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg p-2 transition-colors"
        title="Share listing"
      >
        <Share2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-yacht-800 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <button onClick={handleCopy} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <LinkIcon className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={handleEmail} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button onClick={handleText} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <MessageSquare className="w-4 h-4" />
            Text / SMS
          </button>
        </div>
      )}
    </div>
  );
}
