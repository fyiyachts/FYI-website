import { fail, ok, methodNotAllowed } from '../_lib/http.js';
import { requireAdmin } from '../_lib/adminAuth.js';
import { listLeads } from '../_lib/fyiHubspotLeads.js';

// GET /api/admin/leads   (admins only)
//
// All FYI leads, newest first, with who each was distributed to (the HubSpot
// contact owner) and their last-activity date — the FYI port of
// valhalla-yacht-sales' /api/portal/integration-leads, backing the admin
// "FYI Leads" page (staleness colouring, source filter, CSV export, nudge).
//
//   ?source = a Lead Source value (Website, YachtWorld, …)  (optional)
//   ?limit  = max rows (default 250, max 500)

const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_FYI_TOKEN || '';
export const maxDuration = 60;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return methodNotAllowed(res);
  if (!requireAdmin(req, res)) return;
  if (!HS_TOKEN) return fail(res, 'HubSpot token not configured (HUBSPOT_ACCESS_TOKEN)', 500);

  const source = (req.query?.source ?? '').toString().trim() || undefined;
  const limit = req.query?.limit ? parseInt(req.query.limit as string, 10) : undefined;

  try {
    const result = await listLeads(HS_TOKEN, { source, limit });
    return ok(res, result);
  } catch (err) {
    console.error('[admin/leads] error:', err);
    return fail(res, err);
  }
}
