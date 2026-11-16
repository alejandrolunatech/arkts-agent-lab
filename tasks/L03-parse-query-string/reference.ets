function decodePart(text: string): string {
  const spaced = text.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(spaced);
  } catch (error) {
    return spaced;
  }
}

export function parseQuery(query: string): Map<string, string> {
  const result = new Map<string, string>();
  const body = query.startsWith('?') ? query.substring(1) : query;
  for (const part of body.split('&')) {
    if (part.length === 0) {
      continue;
    }
    const cut = part.indexOf('=');
    const key = decodePart(cut < 0 ? part : part.substring(0, cut));
    const value = cut < 0 ? '' : decodePart(part.substring(cut + 1));
    if (key.length === 0) {
      continue;
    }
    result.set(key, value);
  }
  return result;
}
