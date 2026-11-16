export interface Settings {
  theme: string;
  fontSize: number;
  notifications: boolean;
  language: string;
}

export interface UserSettings {
  theme?: string;
  fontSize?: number;
  notifications?: boolean;
  language?: string;
}

export function defaultSettings(): Settings {
  const settings: Settings = {
    theme: 'light',
    fontSize: 14,
    notifications: true,
    language: 'en'
  };
  return settings;
}

export function mergeSettings(defaults: Settings, user: UserSettings): Settings {
  const merged: Settings = {
    theme: user.theme ?? defaults.theme,
    fontSize: user.fontSize ?? defaults.fontSize,
    notifications: user.notifications ?? defaults.notifications,
    language: user.language ?? defaults.language
  };
  return merged;
}
