import { createContext, useContext, useMemo } from "react";
import type { GiftRepository, RoomRepository } from "./contracts";
import { createSupabaseGiftRepository } from "./giftRepository";
import { createInMemoryRepositories } from "./inMemoryRepositories";
import { createSupabaseRoomRepository } from "./roomRepository";
import { createSupabaseBrowserClient } from "./supabaseClient";

export interface Repositories {
  rooms: RoomRepository;
  gifts: GiftRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

function createDefaultRepositories(): Repositories {
  if (import.meta.env.VITE_REPOSITORY_MODE === "supabase") {
    const client = createSupabaseBrowserClient();
    return {
      rooms: createSupabaseRoomRepository(client),
      gifts: createSupabaseGiftRepository(client)
    };
  }

  return createInMemoryRepositories();
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
