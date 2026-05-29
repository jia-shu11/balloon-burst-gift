import { createInMemoryRepositories, type InMemoryRepositorySnapshot } from "./inMemoryRepositories";

const STORAGE_KEY = "balloon-burst-gift:demo-repositories";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isSnapshot(value: unknown): value is InMemoryRepositorySnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InMemoryRepositorySnapshot>;
  return Array.isArray(candidate.rooms) && Array.isArray(candidate.gifts);
}

function readSnapshot(storage: StorageLike) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isSnapshot(parsed) ? parsed : undefined;
  } catch {
    storage.removeItem(STORAGE_KEY);
    return undefined;
  }
}

export function createLocalStorageRepositories(storage: StorageLike | null = getDefaultStorage()) {
  if (!storage) return createInMemoryRepositories();

  return createInMemoryRepositories({
    snapshot: readSnapshot(storage),
    onChange(snapshot) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        // The demo should keep working even when the browser refuses storage.
      }
    }
  });
}
