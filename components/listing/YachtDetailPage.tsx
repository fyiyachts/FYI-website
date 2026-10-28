import { useParams, useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { searchPinecone, findSimilarYachts } from '../../services/pineconeService';
import { fetchYachtById } from '../../services/databaseService';
import { yachtListingToPineconeBoat } from '../../utils/yachtAdapter';
import { addRecentlyViewed, addPriceSnapshot } from '../../services/storageService';
import { formatBoatPrice } from '../../utils/formatters';
import type { YachtListing } from '../../types/yacht';
import type { PineconeBoat } from '../../types/search';
import ImageGallery from './ImageGallery';
import SpecsTable from './SpecsTable';
import SimilarBoats from './SimilarBoats';
import ContactBrokerForm from './ContactBrokerForm';
import NoteEditor from './NoteEditor';
import ShareButton from './ShareButton';
import PriceHistoryChart from './PriceHistoryChart';
import SaveButton from '../saved/SaveButton';
import CompareButton from '../compare/CompareButton';
import { generateBrochure } from '../../utils/generateBrochure';
import { ArrowLeft, Loader2, MapPin, FileText } from 'lucide-react';
import { DescriptionPreview, FinanceCalculator, InsuranceQuoteCta, YachtMatchBanner } from './BuyerTools';

function toYachtListing(boat: PineconeBoat): YachtListing {
  const title = boat.boatName || [boat.year, boat.make, boat.model].filter(Boolean).join(' ') || 'Unknown Vessel';
  const location = [boat.location?.city, boat.location?.state].filter(Boolean).join(', ') || undefined;
  return {
    id: Number(boat.documentId) || 0,
    title,
    permalink: boat.listingUrl || '',
    price: formatBoatPrice(boat),
    image: boat.images?.[0] || '',
    location,
    companyName: boat.companyName || '',
    specs: {
      length: boat.length ? String(Math.round(boat.length)) : '',
      year: boat.year ? String(boat.year) : '',
      make: boat.make || '',
      model: boat.model || '',
    },
  };
}

export default function YachtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const passedBoat = (location.state as any)?.boat as PineconeBoat | undefined;
  const [boat, setBoat] = useState<PineconeBoat | null>(passedBoat || null);
  const [yacht, setYacht] = useState<YachtListing | null>(passedBoat ? toYachtListing(passedBoat) : null);
  const [similar, setSimilar] = useState<PineconeBoat[]>([]);
  const [loading, setLoading] = useState(!passedBoat);

  useEffect(() => {
    if (!id) return;

    const handleFound = (found: PineconeBoat) => {
      setBoat(found);
      setYacht(toYachtListing(found));
      setLoading(false);

      const listing = toYachtListing(found);
      addRecentlyViewed({
        id: listing.id,
        documentId: found.documentId,
        title: listing.title,
        price: listing.price,
        image: listing.image,
        viewedAt: Date.now(),
      });
      addPriceSnapshot(found.documentId, listing.price);
      findSimilarYachts(found, 8).then(setSimilar).catch(() => {});
    };

    const handleNotFound = () => { setBoat(null); setYacht(null); setLoading(false); };

    // If we already have boat data from Link state, just record view + load similar
    if (passedBoat) {
      const listing = toYachtListing(passedBoat);
      addRecentlyViewed({
        id: listing.id,
        documentId: passedBoat.documentId,
        title: listing.title,
        price: listing.price,
        image: listing.image,
        viewedAt: Date.now(),
      });
      addPriceSnapshot(passedBoat.documentId, listing.price);
      findSimilarYachts(passedBoat, 8).then(setSimilar).catch(() => {});
      return;
    }

    // Direct URL visit — fetch from upstream API first (fast), Pinecone as fallback
    setLoading(true);
    fetchYachtById(Number(id))
      .then(listing => {
        if (listing) {
          handleFound(yachtListingToPineconeBoat(listing));
        } else {
          searchPinecone(id, 20, { DocumentID: { $eq: id } })
            .then(results => {
              const found = results.find(r => r.documentId === id) || results[0] || null;
              found ? handleFound(found) : handleNotFound();
            })
            .catch(() => handleNotFound());
        }
      })
      .catch(() => {
        searchPinecone(id, 20, { DocumentID: { $eq: id } })
          .then(results => {
            const found = results.find(r => r.documentId === id) || results[0] || null;
            found ? handleFound(found) : handleNotFound();
          })
          .catch(() => handleNotFound());
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-yacht-brand animate-spin" />
      </div>
    );
  }

  if (!yacht || !boat) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <p className="text-white/50 text-sm mb-4">Yacht not found.</p>
        <Link to="/app/search" className="text-yacht-brand text-sm hover:underline">Back to Search</Link>
      </div>
    );
  }

  const images = boat.images && boat.images.length > 0 ? boat.images : yacht.image ? [yacht.image] : [];
  const description = typeof boat.rawMetadata?.GeneralBoatDescription === 'string'
    ? boat.rawMetadata.GeneralBoatDescription.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
    : '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link to="/app/search" className="inline-flex items-center gap-1 text-white/50 hover:text-white text-sm mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to Search
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Images + Specs */}
        <div className="lg:col-span-2 space-y-6">
          <ImageGallery images={images} title={yacht.title} />

          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl text-white font-bold">{yacht.title}</h1>
                {yacht.location && (
                  <p className="text-white/50 text-sm mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />{yacht.location}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SaveButton boat={boat} size="md" />
                <CompareButton boatId={yacht.id} size="md" />
                <ShareButton yachtId={String(yacht.id)} title={yacht.title} />
                <button
                  onClick={() => generateBrochure(boat, yacht)}
                  title="Download Brochure"
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-yacht-brand font-bold text-3xl">{yacht.price}</span>
            </div>
          </div>

          <SpecsTable yacht={yacht} />
          {description && (
            <div>
              <h2 className="font-serif text-lg font-bold text-white mb-2">About this yacht</h2>
              <DescriptionPreview text={description} tone="dark" />
            </div>
          )}
          <PriceHistoryChart boatId={boat.documentId} currentPrice={yacht.price} />
          <NoteEditor boatId={String(yacht.id)} />
        </div>

        {/* Right: Contact + buyer tools (FYI meeting 2026-07-17) */}
        <div className="space-y-6">
          <ContactBrokerForm yacht={yacht} />
          <FinanceCalculator price={boat.price} tone="dark" />
          <InsuranceQuoteCta
            tone="dark"
            yacht={{
              title: yacht.title,
              price: yacht.price,
              year: yacht.specs.year,
              make: yacht.specs.make,
              model: yacht.specs.model,
              length: yacht.specs.length,
              location: yacht.location,
            }}
          />
          <YachtMatchBanner />
        </div>
      </div>

      {/* Similar Yachts Carousel -- full width */}
      {similar.length > 0 && (
        <div className="mt-10">
          <SimilarBoats boats={similar} />
        </div>
      )}
    </div>
  );
}
