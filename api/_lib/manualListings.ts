// Hand-entered sale listings that are NOT in FYI's BoatsGroup feed (client,
// 2026-10-01 — central-agency boats FYI is marketing from the brokers' own
// brochures; ANIM added 2026-10-28). Each record is shaped like a raw boats.com feed item so
// every consumer that already parses the feed (the /api/yachts/proxy grids,
// search, the listing page, /api/listing's server render) handles it with no
// extra code. DocumentIDs sit in the 99,000,000 range, far above anything
// BoatsGroup issues today (~10.3M), so they can never collide with a real one.
//
// To retire one: delete its record. To add one: copy a record, give it the
// next 990000xx id, and drop its photos into public/listings/<slug>/.
//
// Prices: the site formats every price as USD. A non-USD asking price is
// therefore published as "Price on Request" (PriceHideInd) and quoted in its
// own currency at the top of the description, rather than mislabelled with $.

const OFFICE = {
  PostalAddress: '2424 Coral Way', City: 'Miami', State: 'FL', PostCode: '33145',
  Country: 'US', Email: 'sales@fyiyachts.com', Phone: '305-854-6020',
};

const imgs = (slug: string, count: number, caption: string) =>
  Array.from({ length: count }, (_, i) => ({
    Priority: String(i),
    Caption: caption,
    Uri: `/listings/${slug}/${slug}-${String(i + 1).padStart(2, '0')}.webp`,
  }));

export const MANUAL_LISTINGS: Record<string, any>[] = [
  {
    // Source: "2023-Sanlorenzo-SL106-Asymmetric-PANAME-BF-9.pdf" (client Drive).
    Source: 'FYI-MANUAL',
    DocumentID: '99000001',
    SalesStatus: 'Active',
    CompanyName: 'FYI Yachts',
    Office: OFFICE,
    LastModificationDate: '2026-10-01',
    ItemReceivedDate: '2026-10-01',
    Price: '8985000 EUR',
    PriceHideInd: true,
    BoatLocation: { BoatCityName: 'Cannes', BoatCountryID: 'FR', BoatStateCode: '' },
    MakeString: 'Sanlorenzo',
    ModelYear: 2023,
    SaleClassCode: 'Used',
    Model: 'SL106 Asymmetric',
    BoatCategoryCode: 'Power',
    BoatName: 'PANAME',
    DesignerName: 'Zuccon International Project',
    CruisingSpeedMeasure: '24 kn',
    MaximumSpeedMeasure: '28 kn',
    RangeMeasure: '1280 nmi',
    BeamMeasure: '23.17 ft',
    MaxDraft: '6.56 ft',
    FuelTankCapacityMeasure: '3196|gallon',
    WaterTankCapacityMeasure: '502|gallon',
    HoldingTankCapacityMeasure: '238|gallon',
    TotalEnginePowerQuantity: '4,868 hp',
    DriveTypeCode: 'Shaft Drive',
    HeadsCountNumeric: 6,
    CabinsCountNumeric: 5,
    BoatHullMaterialCode: 'Fiberglass',
    NominalLength: '106 ft',
    LengthOverall: '105.92 ft',
    Engines: [
      { Make: 'MTU', Model: '16V 2000 M96', Fuel: 'diesel', EnginePower: '2434|horsepower', Type: 'Inboard', Hours: 595 },
      { Make: 'MTU', Model: '16V 2000 M96', Fuel: 'diesel', EnginePower: '2434|horsepower', Type: 'Inboard', Hours: 595 },
    ],
    TotalEngineHoursNumeric: 1190,
    BoatClassCode: ['Flybridge', 'Motor Yachts'],
    // Plain text: the listing page renders this field stripped of HTML.
    GeneralBoatDescription:
      'Asking €8,985,000. Immediate delivery, Cannes (French Riviera). Delivered right before the 2023 summer season, PANAME is a 32.3m (105′11″) Sanlorenzo SL106 Asymmetric designed by Zuccon International Project, with naval architecture by Sanlorenzo. Always used privately, she is prepared for commercial registration in Malta and coded for charter in 2026. The Asymmetric layout pushes the interior out to the full beam on the port side, where there is no traditional side deck — adding some 10 m² to the main deck and giving a dining area with sole-to-ceiling glass that merges with the hull. A vast lounge to starboard opens onto a folding terrace. The 20 m² bow area has integrated sun loungers and a convertible dinette, reached directly from the almost 30 m² main-deck Owner’s cabin, and the fully customised flybridge of roughly 60 m² connects to the foredeck. She accommodates 11 guests in 5 en-suite staterooms — the main-deck Master forward, three double VIPs, and a twin with an additional Pullman on the lower deck — plus three crew cabins for five. Twin 2,434 hp MTU engines with low hours give 28 knots maximum, 24 knots cruise, and a range of 1,280 nm at an economical 10 knots. Key features: Only SL106A available for immediate delivery · Low hours and transferable warranties · Zero-speed fin stabilizers, underway and at anchor · Frequency/voltage converter and combined EU/US shore power · Opening balconies · Vast flybridge with opening hardtop · Tender garage with new Williams 445 DieselJet · Coded for charter in 2026. Main characteristics — Builder: Sanlorenzo S.p.A. (Italy) · Hull number 820 · Exterior design: Zuccon International Project · Hull: planing GRP, 16° deadrise · Teak decks · Refit 2026 (commercial coding) · LOA 32.28 m (105′11″) · Beam 7.06 m (23′2″) · Draft 2.00 m full load · Displacement 126,000 kg full load · 190 GT · RINA Pleasure Yacht class · Malta Commercial Yacht coding · Flag: Malta Propulsion — 2 × MTU 16V 2000 M96, 2,434 hp each @ 2,450 rpm · 595 hours (September 2025) · ZF 3060A gearboxes · Direct shafts, 5-blade NiBrAl props · Max 28 kn · Cruise 24 kn · Economical 10 kn · Range 1,280 nm Tankage — Fuel 12,100 L (3,196 US gal) · Fresh water 1,900 L (502 US gal) · Black water 900 L · Grey water 850 L Main equipment — CMC bow and stern thrusters · 2 × CMC zero-speed electric fin stabilizers · 2 × 45 kW Kohler generators (1,750 h) · Condaria 180,000 BTU/h tropicalized A/C · 2 × Idromar 230 L/h watermakers · ASEA 36 kVA frequency converter · Combined EU/US plugs throughout Accommodation — Main-deck Master forward with study/vanity, walk-in dressing room, en-suite with double sinks, and opening window to starboard · 3 VIP doubles and 1 twin (with Pullman) on the lower deck, all en-suite · 3 en-suite crew cabins for 5 · Crew mess with kitchenette and laundry · Main saloon, formal dining for 10, day head, galley, fold-down window on the asymmetric side · Raised pilothouse Options included — Raymarine Gold package · KVH TV8 satellite TV · 5G Wi-Fi with Starlink · Fusion Gold audio-video · Samsung TVs behind Stopsol mirrors in all cabins · Gaggenau/Miele galley · Hardtop with powered louvre roof · Teak flybridge and bow · Electric hi/lo tables · Underwater LED lights · Dark Emperador marble bathrooms · Fantini fittings Tender — Williams 445 DieselJet, Yanmar 4JH4 110 hp Inspections by prior appointment; short notice possible. Berth management available on the French and Italian Rivieras, Spain and the Balearics, Greece, and Turkey. Particulars given in good faith but not guaranteed.',
    Images: imgs('paname', 30, '2023 Sanlorenzo SL106 Asymmetric PANAME'),
  },
  {
    // Source: "Sunreef 80 Power Manta - BF Brochure.pdf" (client Drive). The
    // brochure gives no year, price, or location, so none is published.
    Source: 'FYI-MANUAL',
    DocumentID: '99000002',
    SalesStatus: 'Active',
    CompanyName: 'FYI Yachts',
    Office: OFFICE,
    LastModificationDate: '2026-10-01',
    ItemReceivedDate: '2026-10-01',
    Price: '',
    PriceHideInd: true,
    BoatLocation: {},
    MakeString: 'Sunreef',
    SaleClassCode: 'Used',
    Model: '80 Power',
    BoatCategoryCode: 'Power',
    BoatName: 'MANTA',
    DesignerName: 'Sunreef Yachts',
    BeamMeasure: '39.37 ft',
    MaxDraft: '7.22 ft',
    FuelTankCapacityMeasure: '4227|gallon',
    WaterTankCapacityMeasure: '423|gallon',
    TotalEnginePowerQuantity: '2,400 hp',
    CabinsCountNumeric: 4,
    BoatHullMaterialCode: 'Composite',
    NominalLength: '80 ft',
    LengthOverall: '78.31 ft',
    Engines: [
      { Make: 'MAN', Model: '', Fuel: 'diesel', EnginePower: '1200|horsepower', Type: 'Inboard' },
      { Make: 'MAN', Model: '', Fuel: 'diesel', EnginePower: '1200|horsepower', Type: 'Inboard' },
    ],
    BoatClassCode: ['Power Catamarans'],
    // Plain text: the listing page renders this field stripped of HTML.
    GeneralBoatDescription:
      'MANTA is a Sunreef 80 Power catamaran — 23.87 m (78′4″) overall with a 12 m (39′4″) beam — built in infused E-glass sandwich composite to CE Category A, and adapted to the Malta Commercial Code (Sea Area 2) for charter. Her galley-up layout leaves the lower hulls to a VIP cabin and three further guest cabins, with two crew cabins forward. Twin 1,200 hp MAN engines and 16,000 L of fuel give her real range, and the extras list is long: a 1,200 kg hydraulic platform, a garage for water toys with a jet-ski launching system, a Williams 520 Carbon tender, a 2021 Sea-Doo GTX 230, and attachments for Seabobs and a Radinn e-surf board. Key features: Galley up, VIP cabin, 3 guest cabins, 2 crew cabins · Composite flybridge hardtop with skylights · Hydraulic swim platform (1,200 kg) and toy garage · 84 kWh lithium night-mode battery bank with inverter · Additional 280 L/h watermaker · KVH TV6 satellite TV, Cobham Fleet Xpress, Pepwave 4G · Lumishore underwater lights · Malta Commercial Code 2015, Sea Area 2. Main data — Construction: composite (E-glass sandwich, infusion; vinylester osmosis barrier) · Naval architecture: Sunreef Yachts · Category A · LOA 23.87 m · Beam 12 m · Draft 2.2 m · Water 1,600 L · Fuel 2 × 8,000 L · Engines 2 × 1,200 hp MAN · Malta Commercial Code, Sea Area 2 Machinery — Twin MAN 1,200 hp with stainless shafts and rope cutters · Controls on flybridge and in saloon · Bow thruster · Engine-room sound insulation · Anti-vibration thrust bearings Deck equipment — Hydraulic gangway · Four-sided flybridge windscreen · Jet-ski launching system · Cockpit shower · Two aft capstans · Additional 2 × electric bow winches · Pantograph electric doors to the front deck Comfort on board — 120,000 BTU/h air conditioning · Miele galley, washer and dryer · Saloon wine cooler · 55″ lifting TV and Yamaha 7.2 home cinema · 6 × 32″ cabin TVs · Cockpit bar and flybridge bar with ice makers and electric BBQ · Diving compressor · Electric saloon blinds · Extra freezers in the bilge Electrical — 84 kWh 25.6 V lithium night-mode bank with 230 V inverter · 2 × 28 kVA paralleling generators · 2 × 63 A shore inlets Safety — Full rescue equipment with life rafts for 12 · 3,000 W windlass · Mooring set Extras — Williams 520 Carbon tender · Sea-Doo GTX 230 (2021) · KVH TV6 · Cobham Sailor GX60 / Fleet Broadband 250 / Fleet Xpress · Kerio NG310 · Cisco Wi-Fi · Pepwave MAX BR1 4G · Poliform and Dedon furniture · Yacht Controller · Lumishore underwater lights · Seabob and e-surf attachments in the garage · Delivered with full fuel tanks Specifications are provided for general information; buyers are encouraged to inspect the boat or request verification before purchase.',
    Images: imgs('manta', 31, 'Sunreef 80 Power catamaran MANTA'),
  },
  {
    // Source: "RIVA 100 CORSARO ANIM FY.pdf" (central agent brochure, Favia
    // Yachting). The brochure gives no city, engine hours, cruise speed or
    // range, so none is published.
    Source: 'FYI-MANUAL',
    DocumentID: '99000003',
    SalesStatus: 'Active',
    CompanyName: 'FYI Yachts',
    Office: OFFICE,
    LastModificationDate: '2026-10-28',
    ItemReceivedDate: '2026-10-28',
    Price: '7900000 USD',
    PriceHideInd: false,
    BoatLocation: { BoatCountryID: 'TR' },
    MakeString: 'Riva',
    ModelYear: 2019,
    SaleClassCode: 'Used',
    Model: '100 Corsaro',
    BoatCategoryCode: 'Power',
    BoatName: 'ANIM',
    MaximumSpeedMeasure: '27.5 kn',
    BeamMeasure: '22 ft',
    MaxDraft: '7.42 ft',
    DisplacementMeasure: '242509 lb',
    FuelTankCapacityMeasure: '2378|gallon',
    WaterTankCapacityMeasure: '349|gallon',
    HoldingTankCapacityMeasure: '111|gallon',
    TotalEnginePowerQuantity: '5,276 hp',
    DriveTypeCode: 'Shaft Drive',
    HeadsCountNumeric: 6,
    CabinsCountNumeric: 5,
    MaximumNumberOfPassengersNumeric: 10,
    NominalLength: '100 ft',
    LengthOverall: '100 ft',
    Engines: [
      { Make: 'MTU', Model: '16V 2000 M96L', Fuel: 'diesel', EnginePower: '2638|horsepower', Type: 'Inboard' },
      { Make: 'MTU', Model: '16V 2000 M96L', Fuel: 'diesel', EnginePower: '2638|horsepower', Type: 'Inboard' },
    ],
    BoatClassCode: ['Flybridge', 'Motor Yachts'],
    // Plain text: the listing page renders this field stripped of HTML.
    GeneralBoatDescription:
      'The 100′ Riva Corsaro is a modern classic of Italian design, engineering and craftsmanship, blending performance, luxury and seaworthiness with the heritage of the Riva name. Key data — LOA 100 ft · Beam 22 ft · Draft 7′5″ · Weight 242,509 lb · Max 27.5 kn · 2 × MTU 16V 2000 M96L, 2,638 hp each, shaft drive Tankage — Fuel 9,000 L · Water 1,320 L · Black water 420 L · Grey water 330 L Accommodation — 5 cabins for 10 guests · 6 heads · 3 crew cabins for 5 crew Equipment — Dual 15″ Furuno NavNet 3D displays · Furuno radar and AIS · Simrad autopilot and VHF · CCTV · Chilled-water Condaria A/C throughout with individual cabin control · Samsung Smart TVs in salon and all cabins · Fusion audio with Yamaha amplifiers · Mastervolt inverter/chargers · 230V shore power with Glendinning Cablemaster · Integrated monitoring and control system · Bow and stern thrusters with remotes · Wind station, depth sounder, digital compass · Cockpit docking station · Flybridge helm with full navigation and engine instrumentation. Particulars given in good faith but not guaranteed.',
    Images: imgs('anim', 20, '2019 Riva 100 Corsaro ANIM'),
  },
];

const byId = new Map(MANUAL_LISTINGS.map((it) => [String(it.DocumentID), it]));

export function findManualListing(id: string): Record<string, any> | undefined {
  return byId.get(String(id));
}

const lc = (v: unknown) => String(v ?? '').toLowerCase();

/** Manual listings matching an active-inventory proxy query. Only the filters
 *  callers actually send server-side are honoured (make/keyword/class); the
 *  rest of the filtering on the site runs client-side over the whole set. */
export function manualListingsFor(query: URLSearchParams): Record<string, any>[] {
  const status = lc(query.get('salesstatus') || 'active');
  if (status !== 'active') return [];
  const start = Number(query.get('start') || 0);
  if (start > 0) return []; // first page only, so paging never repeats them
  const make = lc(query.get('make'));
  const cls = lc(query.get('class'));
  const kw = lc(query.get('keyword'));
  return MANUAL_LISTINGS.filter((it) => {
    if (make && lc(it.MakeString) !== make) return false;
    if (cls && !lc((it.BoatClassCode || []).join(' ')).includes(cls)) return false;
    if (kw) {
      const hay = lc([it.BoatName, it.MakeString, it.Model, ...(it.BoatClassCode || [])].join(' '));
      if (!kw.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}
