// The visitor's country (ISO 3166-1 alpha-2) from Vercel's IP geolocation.
// Used only by utils/metaPixel.ts to fill the `country` field of the Meta
// pixel's advanced matching on a successful lead (the forms don't ask for a
// country). Nothing is logged or stored.
export default function handler(req: any, res: any) {
  const raw = String(req.headers?.['x-vercel-ip-country'] || '').trim().toUpperCase();
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ country: /^[A-Z]{2}$/.test(raw) ? raw : null });
}
