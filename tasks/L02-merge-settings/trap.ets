export interface Settings {
  theme: string;
  fontSize: number;
  notifications: boolean;
  language: string;
}

export type UserSettings = Partial<Settings>;

const DEFAULTS = {
  theme: 'light',
  fontSize: 14,
  notifications: true,
  language: 'en',
};

export function defaultSettings(): Settings {
  return { ...DEFAULTS };
}

export function mergeSettings(defaults: Settings, user: UserSettings): Settings {
  return { ...defaults, ...user };
}
