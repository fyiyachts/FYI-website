import { embedQuery, queryIndex, isPineconeConfigured } from '../_lib/pineconeCore.js';
import { parseJsonBody, fail, ok, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!isPineconeConfigured()) return fail(res, 'Pinecone not configured');

  try {
    const { boatDescription, classCode, excludeId, topK = 20 } = parseJsonBody(req);
    if (!boatDescription) return fail(res, 'boatDescription is required', 400);

    const vector = await embedQuery(boatDescription);
    const filters: Record<string, any> = {};
    if (classCode) filters.BoatClassCode = { $eq: classCode };

    const matches = await queryIndex(vector, topK + 5, Object.keys(filters).length > 0 ? filters : undefined);
    const filtered = excludeId
      ? matches.filter(m => m.id !== excludeId)
      : matches;

    return ok(res, { matches: filtered.slice(0, topK) });
  } catch (err) {
    return fail(res, err);
  }
}
