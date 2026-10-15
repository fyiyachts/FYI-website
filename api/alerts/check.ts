import { embedQuery, queryIndex, isPineconeConfigured } from '../_lib/pineconeCore.js';
import { getTransporter, isEmailConfigured, getSmtpUser } from '../_lib/email.js';
import { recordAlertSent } from '../_lib/supabaseUsers.js';

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
// FYI's BoatsGroup (boats.com) inventory feed — same source as /api/yachts/proxy.
const UPSTREAM = 'https://api.boats.com/inventory/search';
const BOATS_KEY = process.env.BOATS_API_KEY || '';

async function kvScan(pattern: string): Promise<string[]> {
  const res = await fetch(`${KV_URL}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.result || [];
}

// Upstash's REST API returns the stored value as a raw (JSON-encoded) string in
// `result`. Parse it back into the object we wrote; tolerate double-encoding,
// missing keys, and malformed data instead of handing a string to the caller.
function parseKvValue(result: any): any {
  if (result == null) return null;
  let value: any = result;
  for (let i = 0; i < 2 && typeof value === 'string'; i++) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  return value;
}

async function kvGet(key: string): Promise<any> {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return parseKvValue(data.result);
}

async function kvSet(key: string, value: any): Promise<void> {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

async function fetchBoatPrice(documentId: number): Promise<string | null> {
  try {
    if (!BOATS_KEY) return null;
    const url = `${UPSTREAM}?key=${encodeURIComponent(BOATS_KEY)}&documentid=${documentId}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.results || data;
    if (!Array.isArray(items) || items.length === 0) return null;
    const item = items[0];
    return item.Price || item.NormPrice || item.CurrentPrice || null;
  } catch { return null; }
}

function parsePriceNum(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
}

export default async function handler(req: any, res: any) {
  // Verify cron secret
  const authHeader = req.headers?.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!KV_URL || !KV_TOKEN) return res.status(500).json({ error: 'KV not configured' });
  if (!isEmailConfigured()) return res.status(500).json({ error: 'Email not configured' });

  try {
    const keys = await kvScan('alert:user:*');
    let emailsSent = 0;
    const recipientsSent: string[] = [];
    let failures = 0;

    for (const key of keys) {
     try {
      const sub = await kvGet(key);
      if (!sub || typeof sub !== 'object') {
        console.warn(`[alerts/check] skipping ${key}: no valid subscription record`);
        continue;
      }

      const priceDrops: Array<{ title: string; oldPrice: string; newPrice: string }> = [];
      const newMatches: Array<{ searchQuery: string; count: number }> = [];

      // Check price drops on saved boats
      for (const boat of sub.savedBoats || []) {
        const currentPrice = await fetchBoatPrice(boat.id);
        if (!currentPrice) continue;
        const oldNum = parsePriceNum(boat.priceAtSubscribe);
        const newNum = parsePriceNum(currentPrice);
        if (newNum > 0 && oldNum > 0 && newNum < oldNum) {
          priceDrops.push({ title: boat.title, oldPrice: boat.priceAtSubscribe, newPrice: `$${newNum.toLocaleString()}` });
          boat.priceAtSubscribe = `$${newNum.toLocaleString()}`;
        }
      }

      // Check new matches for saved searches (respect frequency)
      const today = new Date().getDay(); // 0=Sun, 1=Mon
      const isWeeklyDay = today === 1;
      if (isPineconeConfigured()) {
        for (const search of sub.savedSearches || []) {
          const freq = search.frequency || 'weekly';
          if (freq === 'off') continue;
          if (freq === 'weekly' && !isWeeklyDay) continue;
          try {
            const vector = await embedQuery(search.query);
            const matches = await queryIndex(vector, 50, search.filters);
            const currentIds = matches.map(m => m.id);
            const previousIds = new Set(search.lastResultIds || []);
            const newIds = currentIds.filter(id => !previousIds.has(id));
            if (newIds.length > 0) {
              newMatches.push({ searchQuery: search.query, count: newIds.length });
            }
            search.lastResultIds = currentIds;
          } catch { /* skip failed searches */ }
        }
      }

      // Send digest email if there are changes
      if (priceDrops.length > 0 || newMatches.length > 0) {
        const priceDropHtml = priceDrops.map(d =>
          `<li><strong>${d.title}</strong>: <span style="text-decoration:line-through;color:#999;">${d.oldPrice}</span> → <span style="color:#22c55e;font-weight:bold;">${d.newPrice}</span></li>`
        ).join('');

        const newMatchHtml = newMatches.map(m =>
          `<li>"${m.searchQuery}" — <strong>${m.count} new listing${m.count > 1 ? 's' : ''}</strong></li>`
        ).join('');

        const html = `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
            <h1 style="color: #0A192F; font-size: 22px; border-bottom: 2px solid #D4AF37; padding-bottom: 12px;">FYI Yachts Alert Digest</h1>
            ${priceDrops.length > 0 ? `<h2 style="color: #0A192F; font-size: 16px;">Price Drops</h2><ul>${priceDropHtml}</ul>` : ''}
            ${newMatches.length > 0 ? `<h2 style="color: #0A192F; font-size: 16px;">New Matches</h2><ul>${newMatchHtml}</ul>` : ''}
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #aaa; font-size: 11px; text-align: center;">&copy; ${new Date().getFullYear()} FYI Yachts</p>
          </div>
        `;

        const transporter = getTransporter();
        await transporter.sendMail({
          from: `"FYI Yachts Alerts" <${getSmtpUser()}>`,
          to: sub.email,
          subject: `FYI Yachts: ${priceDrops.length} price drop${priceDrops.length !== 1 ? 's' : ''}, ${newMatches.length} new match${newMatches.length !== 1 ? 'es' : ''}`,
          html,
        });
        emailsSent++;
        recipientsSent.push(sub.email);
        console.log(`[alerts/check] sent digest to ${sub.email} (${priceDrops.length} price drop(s), ${newMatches.length} new match(es))`);
        // Stamp the delivery in Supabase so sends are auditable (never fail the run on this).
        try { await recordAlertSent(sub.email); }
        catch (err) { console.error(`[alerts/check] recordAlertSent failed for ${sub.email}:`, err); }
      }

      // Update KV with new baselines
      sub.updatedAt = Date.now();
      await kvSet(key, sub);
     } catch (err) {
      failures++;
      console.error(`[alerts/check] failed processing ${key}:`, err);
     }
    }

    console.log(`[alerts/check] run complete: checked=${keys.length} emailsSent=${emailsSent} failures=${failures} recipients=${JSON.stringify(recipientsSent)}`);
    return res.status(200).json({ checked: keys.length, emailsSent, failures, recipients: recipientsSent });
  } catch (err: any) {
    console.error('[alerts/check] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
