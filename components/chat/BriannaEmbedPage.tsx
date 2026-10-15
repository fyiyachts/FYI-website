import BriannaChatPanel from './BriannaChatPanel';

// Public, unauthenticated route (/brianna) served inside the iframe that
// public/brianna-embed.js injects into fyiyachts.com. The close button tells
// the parent page to hide the iframe via postMessage — the embed script owns
// show/hide so the chat state survives close/reopen within a page view.
export default function BriannaEmbedPage() {
  const embedded = window.self !== window.top;
  const close = embedded
    ? () => window.parent.postMessage({ type: 'brianna:close' }, '*')
    : undefined;

  if (embedded) {
    return (
      <div className="h-dvh w-full overflow-hidden">
        <BriannaChatPanel onClose={close} />
      </div>
    );
  }

  // Visited directly (not framed): present the chat as a centered card.
  return (
    <div className="flex min-h-dvh items-center justify-center bg-yacht-900 p-4">
      <div className="flex h-[640px] max-h-[calc(100dvh-2rem)] w-[420px] max-w-full flex-col overflow-hidden rounded-none shadow-2xl">
        <BriannaChatPanel />
      </div>
    </div>
  );
}
