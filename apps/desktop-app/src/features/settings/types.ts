export type Theme = "light" | "dark" | "system";

export interface Settings {
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
};
