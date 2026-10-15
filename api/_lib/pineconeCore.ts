const PINECONE_API_KEY = String(process.env.PINECONE_API_KEY || '').trim();
const PINECONE_HOST = String(process.env.PINECONE_HOST || '').trim();
const PINECONE_INFERENCE_URL = 'https://api.pinecone.io/embed';
const EMBED_MODEL = 'multilingual-e5-large';

export interface PineconeMatch {
  id: string;
  score: number;
  metadata: Record<string, any>;
}

export async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(PINECONE_INFERENCE_URL, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json',
      'X-Pinecone-API-Version': '2024-10',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      inputs: [{ text }],
      parameters: { input_type: 'query', truncate: 'END' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pinecone embed failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data[0].values as number[];
}

export async function queryIndex(vector: number[], topK: number, filter?: Record<string, any>): Promise<PineconeMatch[]> {
  const body: Record<string, any> = {
    vector,
    topK,
    includeMetadata: true,
    includeValues: false,
  };
  if (filter && Object.keys(filter).length > 0) body.filter = filter;

  const res = await fetch(`${PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pinecone query failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.matches || []) as PineconeMatch[];
}

export function isPineconeConfigured(): boolean {
  return Boolean(PINECONE_API_KEY);
}
