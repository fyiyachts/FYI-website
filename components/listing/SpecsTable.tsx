import type { YachtListing } from '../../types/yacht';

interface Props {
  yacht: YachtListing;
}

export default function SpecsTable({ yacht }: Props) {
  const specs = [
    { label: 'Make', value: yacht.specs.make },
    { label: 'Model', value: yacht.specs.model },
    { label: 'Year', value: yacht.specs.year },
    { label: 'Length', value: yacht.specs.length ? `${yacht.specs.length}'` : undefined },
    { label: 'Location', value: yacht.location },
    { label: 'Brokerage', value: yacht.companyName },
  ].filter(s => s.value);

  if (specs.length === 0) return null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-white font-medium text-sm mb-3">Specifications</h3>
      <div className="grid grid-cols-2 gap-3">
        {specs.map(({ label, value }) => (
          <div key={label}>
            <p className="text-white/40 text-xs">{label}</p>
            <p className="text-white text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
