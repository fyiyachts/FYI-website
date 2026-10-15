export const parseJsonBody = (req: any) => {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body;
};

export const methodNotAllowed = (res: any) => {
  res.status(405).json({ error: 'Method Not Allowed' });
};

export const ok = (res: any, data: unknown) => {
  res.status(200).json(data);
};

export const fail = (res: any, error: unknown, fallbackStatus = 500) => {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  const status = /missing|invalid|api key|unauthorized|forbidden/i.test(message) ? 400 : fallbackStatus;
  res.status(status).json({ error: message });
};
