import { Store } from "@tauri-apps/plugin-store";

const STORE_NAME = "settings.json";

let store: Store | null = null;

export async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(STORE_NAME);
  }
  return store;
}

export async function getValue<T>(key: string): Promise<T | null> {
  const s = await getStore();
  const value = await s.get<T>(key);
  return value ?? null;
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  const s = await getStore();
  await s.set(key, value);
  await s.save();
}
