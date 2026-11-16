export interface User {
  id: number;
  name: string;
  email: string;
}

function toUser(entry: Object | null): User | undefined {
  if (entry === null || typeof entry !== 'object') {
    return undefined;
  }
  const record = entry as Record<string, Object | null | undefined>;
  const id = record['id'];
  const name = record['name'];
  const email = record['email'];
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    return undefined;
  }
  if (typeof name !== 'string' || name.length === 0) {
    return undefined;
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return undefined;
  }
  const user: User = { id: id, name: name, email: email };
  return user;
}

export function parseUsers(json: string): User[] {
  const users: User[] = [];
  let parsed: Object | null = null;
  try {
    parsed = JSON.parse(json) as Object | null;
  } catch (error) {
    return users;
  }
  if (!Array.isArray(parsed)) {
    return users;
  }
  const entries = parsed as (Object | null)[];
  for (const entry of entries) {
    const user = toUser(entry);
    if (user !== undefined) {
      users.push(user);
    }
  }
  return users;
}
