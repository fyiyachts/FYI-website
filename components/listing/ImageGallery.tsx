import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  images: string[];
  title: string;
}

export default function ImageGallery({ images, title }: Props) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return (
      <div className="aspect-[16/9] bg-white/5 rounded-xl flex items-center justify-center">
        <span className="text-white/20">No Images Available</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      <img src={images[idx]} alt={`${title} - Image ${idx + 1}`} className="w-full aspect-[16/9] object-cover" />
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx((idx - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setIdx((idx + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {idx + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}
