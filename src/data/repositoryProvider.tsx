import { createContext, useContext, useMemo } from "react";
import type { GiftRepository, RoomRepository } from "./contracts";
import { createSupabaseGiftRepository } from "./giftRepository";
import { createLocalStorageRepositories } from "./localStorageRepositories";
import { createSupabaseRoomRepository } from "./roomRepository";
import { createSupabaseBrowserClient } from "./supabaseClient";

export interface Repositories {
  rooms: RoomRepository;
  gifts: GiftRepository;
}

interface RepositoryModeEnv {
  PROD?: boolean;
  VITE_REPOSITORY_MODE?: string;
}

const RepositoryContext = createContext<Repositories | null>(null);

export function resolveRepositoryMode(env: RepositoryModeEnv): "local" | "supabase" {
  const mode = env.VITE_REPOSITORY_MODE?.trim().toLowerCase();
  if (mode === "supabase") return "supabase";
  if (mode === "local" || mode === "localstorage" || mode === "memory" || mode === "demo") return "local";
  return env.PROD ? "supabase" : "local";
}

function createDefaultRepositories(): Repositories {
  if (resolveRepositoryMode(import.meta.env) === "supabase") {
    const client = createSupabaseBrowserClient();
    return {
      rooms: createSupabaseRoomRepository(client),
      gifts: createSupabaseGiftRepository(client)
    };
  }

  return createLocalStorageRepositories();
}

export function RepositoryProvider({
  children,
  repositories
}: {
  children: React.ReactNode;
  repositories?: Repositories;
}) {
  const value = useMemo(() => repositories ?? createDefaultRepositories(), [repositories]);
  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepositories() {
  const repositories = useContext(RepositoryContext);
  if (!repositories) throw new Error("RepositoryProvider is missing");
  return repositories;
}
