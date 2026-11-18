// The listing's "Video" section: the exclusive's YouTube videos
// (api/_lib/listingVideos.ts), shown under the description.
//
// Each video starts as its YouTube still with a play button — no YouTube code
// loads until a visitor presses play — then swaps in place for the
// privacy-enhanced player (youtube-nocookie.com), already playing.
import { useState } from 'react';
import { Play } from 'lucide-react';
import { youtubeThumb } from './GalleryPieces';

export interface ListingVideo { id: string; title?: string }

function VideoCard({ video, boatTitle }: { video: ListingVideo; boatTitle: string }) {
  const [playing, setPlaying] = useState(false);
  const label = video.title || `${boatTitle} — video tour`;
  return (
    <figure>
      <div className="relative aspect-video overflow-hidden bg-yacht-900">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
            title={label}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${label}`}
            className="group absolute inset-0 block h-full w-full">
            {/* hqdefault is 4:3 with bars on a 16:9 video; object-cover crops them away. */}
            <img src={youtubeThumb(video.id)} alt="" loading="lazy" width={480} height={360}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 bg-gradient-to-t from-yacht-900/70 via-yacht-900/10 to-yacht-900/10 transition-colors group-hover:from-yacht-900/60" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-yacht-900 shadow-lg transition-colors duration-300 group-hover:bg-yacht-brand group-hover:text-white">
                <Play className="ml-1 h-7 w-7 fill-current" />
              </span>
            </span>
            <span className="absolute bottom-4 left-4 bg-white/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-yacht-900 shadow-sm transition-colors group-hover:bg-yacht-brand group-hover:text-white">
              Watch Video
            </span>
          </button>
        )}
      </div>
      {video.title && (
        <figcaption className="mt-3 text-[14px] font-light leading-6 text-yacht-900/70">{video.title}</figcaption>
      )}
    </figure>
  );
}

export function ListingVideos({ videos, boatTitle }: { videos: ListingVideo[]; boatTitle: string }) {
  if (!videos.length) return null;
  return (
    <section id="video" className="mt-12 scroll-mt-28">
      <h2 className="font-serif text-2xl italic tracking-wide text-yacht-900">{videos.length > 1 ? 'Videos' : 'Video'}</h2>
      <div className={`mt-5 grid gap-6 ${videos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {videos.map((v) => <VideoCard key={v.id} video={v} boatTitle={boatTitle} />)}
      </div>
    </section>
  );
}
