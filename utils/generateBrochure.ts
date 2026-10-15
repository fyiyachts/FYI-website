import type { PineconeBoat } from '../types/search';
import type { YachtListing } from '../types/yacht';

export function generateBrochure(boat: PineconeBoat, yacht: YachtListing) {
  const title = yacht.title;
  const price = yacht.price;
  const location = yacht.location || '—';
  const make = yacht.specs.make || '—';
  const model = yacht.specs.model || '—';
  const year = yacht.specs.year || '—';
  const length = yacht.specs.length ? `${yacht.specs.length}'` : '—';
  const brokerage = yacht.companyName || '—';
  const hullMaterial = boat.hullMaterial || '—';
  const condition = boat.condition || '—';
  const engines = boat.engines || '—';
  const heroImage = boat.images?.[0] || '';
  const gallery = (boat.images || []).slice(1, 5);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title} — Yacht Brochure</title>
<style>
  @page { size: letter; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a2e; background: #fff; width: 8.5in; min-height: 11in; }
  .page { width: 8.5in; min-height: 11in; padding: 0.5in 0.6in; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.3in; border-bottom: 2px solid #D4AF37; padding-bottom: 0.15in; }
  .header h1 { font-size: 22pt; font-weight: bold; color: #0f2136; max-width: 5in; line-height: 1.2; }
  .header .price { font-size: 20pt; font-weight: bold; color: #D4AF37; white-space: nowrap; }
  .hero { width: 100%; height: 3.2in; object-fit: cover; border-radius: 6px; margin-bottom: 0.25in; }
  .specs-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.15in 0.3in; margin-bottom: 0.25in; background: #f8f7f4; border-radius: 6px; padding: 0.2in 0.25in; }
  .spec-item { }
  .spec-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-family: Arial, sans-serif; margin-bottom: 2px; }
  .spec-value { font-size: 11pt; font-weight: bold; color: #0f2136; }
  .gallery { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.12in; margin-bottom: 0.25in; }
  .gallery img { width: 100%; height: 1.3in; object-fit: cover; border-radius: 4px; }
  .footer { position: absolute; bottom: 0.4in; left: 0.6in; right: 0.6in; border-top: 1px solid #e0ddd5; padding-top: 0.12in; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 8pt; color: #999; font-family: Arial, sans-serif; }
  .footer-right { font-size: 8pt; color: #999; font-family: Arial, sans-serif; }
  .divider { height: 1px; background: #e0ddd5; margin: 0.2in 0; }
  .brokerage-section { font-size: 9.5pt; color: #555; font-family: Arial, sans-serif; }
  .brokerage-section strong { color: #0f2136; }
  .disclaimer { font-size: 7pt; color: #aaa; font-family: Arial, sans-serif; line-height: 1.4; margin-top: 0.15in; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="price">${escapeHtml(price)}</div>
  </div>

  ${heroImage ? `<img class="hero" src="${escapeHtml(heroImage)}" crossorigin="anonymous" />` : ''}

  <div class="specs-grid">
    <div class="spec-item"><div class="spec-label">Make</div><div class="spec-value">${escapeHtml(make)}</div></div>
    <div class="spec-item"><div class="spec-label">Model</div><div class="spec-value">${escapeHtml(model)}</div></div>
    <div class="spec-item"><div class="spec-label">Year</div><div class="spec-value">${escapeHtml(year)}</div></div>
    <div class="spec-item"><div class="spec-label">Length</div><div class="spec-value">${escapeHtml(length)}</div></div>
    <div class="spec-item"><div class="spec-label">Condition</div><div class="spec-value">${escapeHtml(condition)}</div></div>
    <div class="spec-item"><div class="spec-label">Hull Material</div><div class="spec-value">${escapeHtml(hullMaterial)}</div></div>
    <div class="spec-item"><div class="spec-label">Engines</div><div class="spec-value">${escapeHtml(engines)}</div></div>
    <div class="spec-item"><div class="spec-label">Location</div><div class="spec-value">${escapeHtml(location)}</div></div>
    <div class="spec-item"><div class="spec-label">Brokerage</div><div class="spec-value">${escapeHtml(brokerage)}</div></div>
  </div>

  ${gallery.length > 0 ? `
  <div class="gallery">
    ${gallery.map(img => `<img src="${escapeHtml(img)}" crossorigin="anonymous" />`).join('\n    ')}
  </div>` : ''}

  <div class="divider"></div>

  <div class="brokerage-section">
    Listed by <strong>${escapeHtml(brokerage)}</strong>${location !== '—' ? ` · ${escapeHtml(location)}` : ''}
  </div>

  <div class="disclaimer">
    Information is believed to be accurate but not guaranteed. Buyer should verify all specifications.
    Pricing subject to change without notice. Generated on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
  </div>

  <div class="footer">
    <div class="footer-left">FYI Yacht Search · fyi-yacht-search.vercel.app</div>
    <div class="footer-right">${escapeHtml(title)}</div>
  </div>
</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  // Give images time to load before triggering print
  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 500);
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
