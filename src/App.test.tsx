import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createInMemoryRepositories } from "./data/inMemoryRepositories";
import { RepositoryProvider } from "./data/repositoryProvider";

function renderAt(path: string) {
  const repositories = createInMemoryRepositories();
  render(
    <RepositoryProvider repositories={repositories}>
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        initialEntries={[path]}
      >
        <App />
      </MemoryRouter>
    </RepositoryProvider>
  );
}

describe("App routes", () => {
  it("renders the organizer home route", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "Balloon Burst Gift" })).toBeInTheDocument();
  });

  it("renders giver, management, and recipient routes", () => {
    renderAt("/gift/invite_abc");
    expect(screen.getByRole("heading", { name: "制作气球礼物" })).toBeInTheDocument();

    renderAt("/manage/manage_abc");
    expect(screen.getByRole("heading", { name: "管理礼物房间" })).toBeInTheDocument();

    renderAt("/r/recipient_abc");
    expect(screen.getByRole("heading", { name: "收礼现场" })).toBeInTheDocument();
  });
});
