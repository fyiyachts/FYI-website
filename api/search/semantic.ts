import { embedQuery, queryIndex, isPineconeConfigured } from '../_lib/pineconeCore.js';
import { parseJsonBody, fail, ok, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!isPineconeConfigured()) return fail(res, 'Pinecone not configured');

  try {
    const { query, topK = 100, filters } = parseJsonBody(req);
    if (!query || typeof query !== 'string') return fail(res, 'query is required', 400);

    const vector = await embedQuery(query);
    const matches = await queryIndex(vector, topK, filters);

    return ok(res, { matches });
  } catch (err) {
    return fail(res, err);
  }
}
