import { useState } from 'react';
import { Anchor, ChevronRight, ChevronLeft, Check, ExternalLink } from 'lucide-react';

interface OkeanModel {
  name: string;
  length: string;
  tagline: string;
  overallLength: string;
  beam: string;
  beamMaxOpen: string;
  draft: string;
  fuel: string;
  water: string;
  staterooms: string;
  sleeps: string;
  bathrooms: string;
  engines: { label: string; hp: string }[];
}

const OKEAN_IMAGES: Record<string, string> = {
  'OKEAN 52': 'https://okeanyachts.com/wp-content/uploads/2022/11/DJI_0419-1920-768x512.jpg',
  'OKEAN 57': 'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-Shipyard-Estaleiro-Yacht-OKEAN57-External-17-768x432.jpg',
  'OKEAN 80': 'https://okeanyachts.com/wp-content/uploads/2022/11/OKEAN-80-Angra-dos-Reis-7-768x432.png',
};

const OKEAN_MODELS: OkeanModel[] = [
  {
    name: 'OKEAN 52',
    length: "52'",
    tagline: 'Agility and performance with an unmistakable design',
    overallLength: '15.86 m (52 ft)',
    beam: '4.40 m (14.5 ft)',
    beamMaxOpen: '6.20 m (20.3 ft)',
    draft: '1.27 m (4.2 ft)',
    fuel: '1,600 L (422 gal)',
    water: '670 L (176 gal)',
    staterooms: '3',
    sleeps: '6 + 1',
    bathrooms: '2',
    engines: [
      { label: 'Twin Volvo Penta D8 IPS800', hp: '600 HP' },
      { label: 'Twin Cummins QSC 8.3 V-Drive', hp: '600 HP' },
    ],
  },
  {
    name: 'OKEAN 57',
    length: "57'",
    tagline: 'A singular design for a unique experience',
    overallLength: '17.44 m (57.3 ft)',
    beam: '4.77 m (15.8 ft)',
    beamMaxOpen: '6.60 m (21.8 ft)',
    draft: '1.23 m (4 ft)',
    fuel: '1,900 L (501 gal)',
    water: '530 L (140 gal)',
    staterooms: '1 + 1',
    sleeps: '2 + 2',
    bathrooms: '1 + 1',
    engines: [
      { label: 'Twin Volvo Penta D8 IPS800', hp: '600 HP' },
      { label: 'Twin Volvo Penta D11 IPS950', hp: '725 HP' },
    ],
  },
  {
    name: 'OKEAN 80',
    length: "80'",
    tagline: 'Open decks at their best',
    overallLength: '24.38 m (80 ft)',
    beam: '6.10 m (20 ft)',
    beamMaxOpen: '8.00 m (26.2 ft)',
    draft: '1.65 m (5.4 ft)',
    fuel: '4,000 L (1,057 gal)',
    water: '1,000 L (264 gal)',
    staterooms: '4',
    sleeps: '8 + 2',
    bathrooms: '4',
    engines: [
      { label: 'Twin MAN V12 1550', hp: '1,550 HP' },
      { label: 'Twin MAN V12 1800', hp: '1,800 HP' },
    ],
  },
];

type BuildStep = 'model' | 'engine' | 'summary';
const STEPS: BuildStep[] = ['model', 'engine', 'summary'];

export default function OkeanBuilder() {
  const [step, setStep] = useState<BuildStep>('model');
  const [selectedModel, setSelectedModel] = useState<number | null>(null);
  const [selectedEngine, setSelectedEngine] = useState(0);

  const currentStepIdx = STEPS.indexOf(step);
  const model = selectedModel !== null ? OKEAN_MODELS[selectedModel] : null;

  const next = () => { if (currentStepIdx < STEPS.length - 1) setStep(STEPS[currentStepIdx + 1]); };
  const prev = () => { if (currentStepIdx > 0) setStep(STEPS[currentStepIdx - 1]); };

  return (
    <div className="bg-white/5 border border-white/10 rounded-none overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-white font-serif font-bold text-lg flex items-center gap-2">
          <Anchor className="w-5 h-5 text-yacht-brand" />
          Build Your Okean
        </h2>
        <a
          href="https://okeanyachts.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors"
        >
          OkeanYachts.com <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Progress */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className="contents">
              <div className={`flex items-center gap-1.5 ${i <= currentStepIdx ? 'text-white' : 'text-white/30'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i < currentStepIdx ? 'bg-yacht-brand text-white' : i === currentStepIdx ? 'bg-white text-yacht-900' : 'bg-white/10 text-white/40'
                }`}>
                  {i < currentStepIdx ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                  {s === 'model' ? 'Model' : s === 'engine' ? 'Engine' : 'Summary'}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < currentStepIdx ? 'bg-yacht-brand' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* Step 1: Model */}
        {step === 'model' && (
          <div className="space-y-3">
            <p className="text-white/50 text-sm mb-4">Select your Okean model to get started.</p>
            {OKEAN_MODELS.map((m, i) => (
              <button
                key={m.name}
                onClick={() => { setSelectedModel(i); setSelectedEngine(0); }}
                className={`w-full flex items-center gap-4 p-4 rounded-none border transition-all text-left ${
                  selectedModel === i
                    ? 'border-yacht-brand bg-yacht-brand/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div className="w-20 h-14 rounded-lg overflow-hidden border border-yacht-brand/20 shrink-0 relative">
                  <img src={OKEAN_IMAGES[m.name]} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white font-serif font-bold text-lg">
                    {m.length}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-bold">{m.name}</h4>
                  <p className="text-white/40 text-xs mt-0.5">{m.tagline}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                    <span>{m.staterooms} staterooms</span>
                    <span>Sleeps {m.sleeps}</span>
                    <span>{m.beam} beam</span>
                  </div>
                </div>
                {selectedModel === i && (
                  <div className="w-6 h-6 rounded-full bg-yacht-brand flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-yacht-900" />
                  </div>
                )}
              </button>
            ))}
            <div className="flex justify-end pt-2">
              <button
                onClick={next}
                disabled={selectedModel === null}
                className="flex items-center gap-1.5 px-4 py-2 bg-yacht-brand text-white text-xs font-bold rounded-lg hover:bg-yacht-brand-light disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Choose Engine <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Engine */}
        {step === 'engine' && model && (
          <div className="space-y-3">
            <p className="text-white/50 text-sm mb-4">Select propulsion for your {model.name}.</p>
            {model.engines.map((e, i) => (
              <button
                key={e.label}
                onClick={() => setSelectedEngine(i)}
                className={`w-full flex items-center justify-between p-4 rounded-none border transition-all text-left ${
                  selectedEngine === i
                    ? 'border-yacht-brand bg-yacht-brand/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <div>
                  <h4 className="text-white text-sm font-bold">{e.label}</h4>
                  <p className="text-white/40 text-xs mt-0.5">{e.hp} per engine</p>
                </div>
                {selectedEngine === i && (
                  <div className="w-6 h-6 rounded-full bg-yacht-brand flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-yacht-900" />
                  </div>
                )}
              </button>
            ))}
            <div className="flex justify-between pt-2">
              <button onClick={prev} className="flex items-center gap-1.5 px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-all">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button onClick={next} className="flex items-center gap-1.5 px-4 py-2 bg-yacht-brand text-white text-xs font-bold rounded-lg hover:bg-yacht-brand-light transition-all">
                View Summary <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === 'summary' && model && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-yacht-brand/20 to-yacht-brand/5 border border-yacht-brand/20 rounded-none p-5">
              <h3 className="text-white text-xl font-serif font-bold">{model.name}</h3>
              <p className="text-white/40 text-xs mt-1">{model.tagline}</p>
              <p className="text-yacht-brand text-sm font-bold mt-2">{model.engines[selectedEngine].label} — {model.engines[selectedEngine].hp}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Overall Length', model.overallLength],
                ['Beam', model.beam],
                ['Draft', model.draft],
                ['Beam (Open)', model.beamMaxOpen],
                ['Fuel', model.fuel],
                ['Water', model.water],
                ['Staterooms', model.staterooms],
                ['Bathrooms', model.bathrooms],
              ].map(([label, value]) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-white font-bold text-sm">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={prev} className="flex items-center gap-1.5 px-4 py-2 bg-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-all">
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <a
                href="https://okeanyachts.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-yacht-brand text-white text-xs font-bold rounded-lg hover:bg-yacht-brand-light transition-all"
              >
                Inquire at Okean <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <button
              onClick={() => { setStep('model'); setSelectedModel(null); setSelectedEngine(0); }}
              className="w-full text-center text-xs font-bold text-white/30 hover:text-white py-2 transition-colors"
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
