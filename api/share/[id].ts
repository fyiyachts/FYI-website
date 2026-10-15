// FYI's BoatsGroup (boats.com) inventory feed — same source as /api/yachts/proxy.
const UPSTREAM = 'https://api.boats.com/inventory/search';
const BOATS_KEY = process.env.BOATS_API_KEY || '';

export default async function handler(req: any, res: any) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'ID required' });

  try {
    if (!BOATS_KEY) return res.status(503).json({ error: 'Inventory feed not configured' });
    const url = `${UPSTREAM}?key=${encodeURIComponent(BOATS_KEY)}&documentid=${encodeURIComponent(String(id))}`;
    const upstream = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!upstream.ok) return res.status(upstream.status).json({ error: 'Yacht not found' });

    const data = await upstream.json();
    const items = data.results || data;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(404).json({ error: 'Yacht not found' });
    }

    const item = items[0];
    let imageUrl = '';
    if (item.Images && Array.isArray(item.Images) && item.Images.length > 0) {
      const firstImg = item.Images[0];
      imageUrl = typeof firstImg === 'string' ? firstImg : firstImg?.Uri || firstImg?.url || '';
    }

    let location = 'Global';
    if (item.BoatLocation) {
      const parts = [];
      if (item.BoatLocation.BoatCityName) parts.push(item.BoatLocation.BoatCityName);
      if (item.BoatLocation.BoatStateCode) parts.push(item.BoatLocation.BoatStateCode);
      if (parts.length > 0) location = parts.join(', ');
    }

    return res.status(200).json({
      id: Number(item.DocumentID),
      title: item.BoatName || 'Unknown Vessel',
      price: item.Price || item.NormPrice || 'Price on Request',
      image: imageUrl,
      location,
      specs: {
        length: item.DisplayLengthFeet || item.Length || '',
        year: item.ModelYear || '',
        make: item.MakeString || '',
        model: item.Model || '',
      },
    });
  } catch (err: any) {
    console.error('[share] error:', err);
    return res.status(500).json({ error: 'Failed to fetch yacht' });
  }
}
