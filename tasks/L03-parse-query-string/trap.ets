function decodePart(text: string): string {
  const spaced = text.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

export function parseQuery(query: string): Map<string, string> {
  const params: any = {};
  const pairs = query.replace(/^\?/, '').split('&').filter(Boolean);
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split('=');
    const key = decodePart(rawKey);
    if (key) {
      params[key] = decodePart(rest.join('='));
    }
  }

  const result = new Map<string, string>();
  for (const key in params) {
    result.set(key, params[key]);
  }
  return result;
}
