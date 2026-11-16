export interface User {
  id: number;
  name: string;
  email: string;
}

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as any;
  return (
    Number.isInteger(candidate.id) &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    typeof candidate.email === 'string' &&
    candidate.email.includes('@')
  );
}

export function parseUsers(json: string): User[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isUser).map(({ id, name, email }) => ({ id, name, email }));
}
