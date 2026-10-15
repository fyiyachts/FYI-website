import { useState } from 'react';
import { Anchor, ChevronRight, ChevronLeft, Check, ExternalLink, Waves, Fuel, Droplets, BedDouble, Bath, Ruler } from 'lucide-react';

interface OkeanModel {
  name: string;
  length: string;
  tagline: string;
  description: string;
  heroImage: string;
  galleryImages: string[];
  overallLength: string;
  beam: string;
  beamMaxOpen: string;
  draft: string;
  fuel: string;
  water: string;
  staterooms: string;
  sleeps: string;
  bathrooms: string;
  highlights: string[];
  engines: { label: string; hp: string }[];
  url: string;
}

const OKEAN_MODELS: OkeanModel[] = [
  {
    name: 'OKEAN 52',
    length: "52'",
    tagline: 'Agility and performance with an unmistakable design',
    description: 'The OKEAN 52 combines navigability with speed and fuel economy. With 1,080 sq ft of usable area that expands with open decks, the Beach Club at the stern brings you the sea in comfort and safety.',
    heroImage: 'https://okeanyachts.com/wp-content/uploads/2022/11/DJI_0419-1920-768x512.jpg',
    galleryImages: [
      'https://okeanyachts.com/wp-content/uploads/2022/11/HighRes-069-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/7H7A8492-EDIT-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/HighRes-142-768x431.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/HighRes-075-768x431.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/HighRes-040-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/HighRes-045-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/HighRes-014-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-52-INT-04-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-52-1920-X-1280-CABINE-MASTER-768x512.jpg',
    ],
    overallLength: '15.86 m (52 ft)',
    beam: '4.40 m (14.5 ft)',
    beamMaxOpen: '6.20 m (20.3 ft)',
    draft: '1.27 m (4.2 ft)',
    fuel: '1,600 L (422 gal)',
    water: '670 L (176 gal)',
    staterooms: '3',
    sleeps: '6 + 1',
    bathrooms: '2',
    highlights: ['Beach Club stern platform', 'Open-concept living', '1,080 sq ft usable area', 'IPS joystick docking'],
    engines: [
      { label: 'Twin Volvo Penta D8 IPS800', hp: '600 HP' },
      { label: 'Twin Cummins QSC 8.3 V-Drive', hp: '600 HP' },
    ],
    url: 'https://okeanyachts.com/models/okean-52/',
  },
  {
    name: 'OKEAN 57',
    length: "57'",
    tagline: 'A singular design for a unique experience',
    description: 'The OKEAN 57 delivers a singular cruising experience with expansive open decks and a refined interior layout. Every detail is designed to maximize your connection to the sea.',
    heroImage: 'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-External-17-768x432.jpg',
    galleryImages: [
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-External-00-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-External-07-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-External-02-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-57-Right-Side-navigate-sport-line-yacht-open-decks-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-External-05-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-Internal-01-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-Internal-00-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-Internal-Master-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-Internal-Badrom-768x432.jpg',
    ],
    overallLength: '17.44 m (57.3 ft)',
    beam: '4.77 m (15.8 ft)',
    beamMaxOpen: '6.60 m (21.8 ft)',
    draft: '1.23 m (4 ft)',
    fuel: '1,900 L (501 gal)',
    water: '530 L (140 gal)',
    staterooms: '1 + 1',
    sleeps: '2 + 2',
    bathrooms: '1 + 1',
    highlights: ['Expansive open decks', 'Social cockpit layout', 'Folding balconies', 'Premium interior finishes'],
    engines: [
      { label: 'Twin Volvo Penta D8 IPS800', hp: '600 HP' },
      { label: 'Twin Volvo Penta D11 IPS950', hp: '725 HP' },
    ],
    url: 'https://okeanyachts.com/models/okean-57/',
  },
  {
    name: 'OKEAN 80',
    length: "80'",
    tagline: 'Open decks at their best',
    description: 'The flagship OKEAN 80 redefines open yacht living. With four spacious staterooms, a flybridge, and massive entertaining areas, she delivers superyacht features in a manageable package.',
    heroImage: 'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-Angra-dos-Reis-7-768x432.png',
    galleryImages: [
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-Angra-dos-Reis-5-768x432.png',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-Angra-dos-Reis-2-768x432.png',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN80-FRONT-scaled-1-768x432.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-FLYBRIDG-02-FULLHD-768x576.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-BEACH-CLUB-768x576.png',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN80-SALAO-FULL-HD-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-CABINE-MASTER-03-768x520.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-CABINE-MASTER-02-768x512.jpg',
      'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN80-POPA-768x512.jpg',
    ],
    overallLength: '24.38 m (80 ft)',
    beam: '6.10 m (20 ft)',
    beamMaxOpen: '8.00 m (26.2 ft)',
    draft: '1.65 m (5.4 ft)',
    fuel: '4,000 L (1,057 gal)',
    water: '1,000 L (264 gal)',
    staterooms: '4',
    sleeps: '8 + 2',
    bathrooms: '4',
    highlights: ['Flybridge with wet bar', 'Full-beam master suite', 'Superyacht-level finishes', 'Hydraulic swim platform'],
    engines: [
      { label: 'Twin MAN V12 1550', hp: '1,550 HP' },
      { label: 'Twin MAN V12 1800', hp: '1,800 HP' },
    ],
    url: 'https://okeanyachts.com/models/okean-80/',
  },
];

type BuildStep = 'model' | 'engine' | 'summary';
const STEPS: BuildStep[] = ['model', 'engine', 'summary'];

export default function NewBuildPage() {
  const [step, setStep] = useState<BuildStep>('model');
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [selectedEngine, setSelectedEngine] = useState(0);
  const [activeGalleryImage, setActiveGalleryImage] = useState(0);

  const currentStepIdx = STEPS.indexOf(step);
  const model = selectedModel !== null ? OKEAN_MODELS[selectedModel] : null;

  const next = () => { if (currentStepIdx < STEPS.length - 1) setStep(STEPS[currentStepIdx + 1]); };
  const prev = () => { if (currentStepIdx > 0) setStep(STEPS[currentStepIdx - 1]); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Anchor className="w-6 h-6 text-yacht-brand" />
            <h1 className="font-serif text-2xl text-white font-bold">New Build</h1>
          </div>
          <p className="text-white/50 text-sm ml-9">Configure your dream Okean yacht</p>
        </div>
        <a
          href="https://okeanyachts.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-white/40 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 hover:text-white transition-all"
        >
          OkeanYachts.com <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Progress bar */}
      <div className="bg-white/5 border border-white/10 rounded-none p-4 mb-6">
        <div className="flex items-center gap-3">
          {STEPS.map((s, i) => (
            <div key={s} className="contents">
              <button
                onClick={() => {
                  if (i < currentStepIdx) setStep(STEPS[i]);
                }}
                className={`flex items-center gap-2 ${i <= currentStepIdx ? 'text-white' : 'text-white/30'} ${i < currentStepIdx ? 'cursor-pointer' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < currentStepIdx ? 'bg-yacht-brand text-white' : i === currentStepIdx ? 'bg-yacht-teal text-white' : 'bg-white/10 text-white/40'
                }`}>
                  {i < currentStepIdx ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
                  {s === 'model' ? 'Choose Model' : s === 'engine' ? 'Select Engine' : 'Your Build'}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full ${i < currentStepIdx ? 'bg-yacht-brand' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Model Selection */}
      {step === 'model' && (
        <div className="space-y-6">
          <h2 className="text-white font-serif text-lg">Select your Okean model</h2>

          {OKEAN_MODELS.map((m, i) => (
            <button
              key={m.name}
              onClick={() => { setSelectedModel(i); setSelectedEngine(0); setActiveGalleryImage(0); }}
              className={`w-full rounded-none border overflow-hidden transition-all text-left ${
                selectedModel === i
                  ? 'border-yacht-brand ring-1 ring-yacht-brand/30'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col lg:flex-row">
                {/* Image */}
                <div className="lg:w-2/5 relative">
                  <img
                    src={m.heroImage}
                    alt={m.name}
                    className="w-full h-48 lg:h-64 object-cover"
                    loading="lazy"
                  />
                  {selectedModel === i && (
                    <div className="absolute top-3 left-3 bg-yacht-brand text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Selected
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white font-serif font-bold text-xl px-3 py-1 rounded-lg">
                    {m.length}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 p-5 bg-white/5">
                  <h3 className="text-white text-lg font-serif font-bold">{m.name}</h3>
                  <p className="text-yacht-teal text-xs font-medium mt-0.5">{m.tagline}</p>
                  <p className="text-white/40 text-sm mt-2 line-clamp-2">{m.description}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="flex items-center gap-2">
                      <Ruler className="w-3.5 h-3.5 text-yacht-teal shrink-0" />
                      <div>
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Length</p>
                        <p className="text-white text-xs font-bold">{m.overallLength.split('(')[0].trim()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BedDouble className="w-3.5 h-3.5 text-yacht-teal shrink-0" />
                      <div>
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Staterooms</p>
                        <p className="text-white text-xs font-bold">{m.staterooms}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bath className="w-3.5 h-3.5 text-yacht-teal shrink-0" />
                      <div>
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Bathrooms</p>
                        <p className="text-white text-xs font-bold">{m.bathrooms}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Fuel className="w-3.5 h-3.5 text-yacht-teal shrink-0" />
                      <div>
                        <p className="text-white/30 text-[9px] uppercase tracking-wider">Fuel</p>
                        <p className="text-white text-xs font-bold">{m.fuel.split('(')[0].trim()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {m.highlights.map(h => (
                      <span key={h} className="text-[10px] bg-yacht-brand/10 text-yacht-brand border border-yacht-brand/20 px-2 py-0.5 rounded-full">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}

          <div className="flex justify-end">
            <button
              onClick={next}
              disabled={selectedModel === null}
              className="flex items-center gap-2 px-5 py-2.5 bg-yacht-brand text-white text-sm font-bold rounded-lg hover:bg-yacht-brand-light disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Choose Engine <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Engine Selection */}
      {step === 'engine' && model && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Model preview */}
          <div className="rounded-none overflow-hidden border border-white/10">
            <img
              src={model.galleryImages[activeGalleryImage] || model.heroImage}
              alt={model.name}
              className="w-full aspect-[16/10] object-cover"
            />
            <div className="flex gap-1 p-2 bg-white/5">
              {[model.heroImage, ...model.galleryImages.slice(0, 5)].map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveGalleryImage(idx === 0 ? -1 : idx - 1)}
                  className={`flex-1 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    (idx === 0 && activeGalleryImage === -1) || (idx > 0 && activeGalleryImage === idx - 1)
                      ? 'border-yacht-teal'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Engine options */}
          <div>
            <h2 className="text-white font-serif text-lg mb-1">Select propulsion</h2>
            <p className="text-white/40 text-sm mb-4">Choose the engine package for your {model.name}</p>

            <div className="space-y-3 mb-6">
              {model.engines.map((e, i) => (
                <button
                  key={e.label}
                  onClick={() => setSelectedEngine(i)}
                  className={`w-full flex items-center justify-between p-5 rounded-none border transition-all text-left ${
                    selectedEngine === i
                      ? 'border-yacht-brand bg-yacht-brand/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <div>
                    <h4 className="text-white text-sm font-bold">{e.label}</h4>
                    <p className="text-white/40 text-xs mt-1">{e.hp} per engine</p>
                  </div>
                  {selectedEngine === i && (
                    <div className="w-7 h-7 rounded-full bg-yacht-brand flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-yacht-900" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between">
              <button onClick={prev} className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white text-sm font-bold rounded-lg hover:bg-white/20 transition-all">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={next} className="flex items-center gap-2 px-5 py-2.5 bg-yacht-brand text-white text-sm font-bold rounded-lg hover:bg-yacht-brand-light transition-all">
                View Summary <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 'summary' && model && (
        <div className="space-y-6">
          {/* Hero card */}
          <div className="rounded-none overflow-hidden border border-yacht-brand/30">
            <div className="relative">
              <img src={model.heroImage} alt={model.name} className="w-full h-64 sm:h-80 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-yacht-900 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-white text-3xl font-serif font-bold">{model.name}</h2>
                <p className="text-white/60 text-sm mt-1">{model.tagline}</p>
                <p className="text-yacht-brand text-sm font-bold mt-2">{model.engines[selectedEngine].label} — {model.engines[selectedEngine].hp}</p>
              </div>
            </div>
          </div>

          {/* Spec grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Ruler, label: 'Overall Length', value: model.overallLength },
              { icon: Waves, label: 'Beam', value: model.beam },
              { icon: Waves, label: 'Beam (Open)', value: model.beamMaxOpen },
              { icon: Ruler, label: 'Draft', value: model.draft },
              { icon: Fuel, label: 'Fuel Capacity', value: model.fuel },
              { icon: Droplets, label: 'Water Capacity', value: model.water },
              { icon: BedDouble, label: 'Staterooms / Sleeps', value: `${model.staterooms} / ${model.sleeps}` },
              { icon: Bath, label: 'Bathrooms', value: model.bathrooms },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-none p-4">
                <Icon className="w-4 h-4 text-yacht-teal mb-2" />
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
                <p className="text-white font-bold text-sm">{value}</p>
              </div>
            ))}
          </div>

          {/* Gallery */}
          <div>
            <h3 className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Gallery</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {model.galleryImages.map((img, i) => (
                <img key={i} src={img} alt={`${model.name} gallery ${i + 1}`} className="w-full aspect-[16/10] object-cover rounded-lg hover:opacity-80 transition-opacity" loading="lazy" />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <button onClick={prev} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 text-white text-sm font-bold rounded-lg hover:bg-white/20 transition-all">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('model'); setSelectedModel(null); setSelectedEngine(0); }}
                className="px-4 py-2.5 text-white/40 hover:text-white text-sm font-bold transition-colors"
              >
                Start Over
              </button>
              <a
                href={model.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-2.5 bg-yacht-brand text-white text-sm font-bold rounded-lg hover:bg-yacht-brand-light transition-all"
              >
                Inquire at Okean <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
