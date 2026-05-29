import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../data/inMemoryRepositories";
import { RepositoryProvider } from "../data/repositoryProvider";
import { HomePage } from "./HomePage";

function renderHomePage(repositories = createInMemoryRepositories()) {
  render(
    <RepositoryProvider repositories={repositories}>
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <HomePage />
      </MemoryRouter>
    </RepositoryProvider>
  );
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("HomePage", () => {
  it("creates a room and shows the giver and management links", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    renderHomePage(repositories);

    await user.type(screen.getByLabelText("房间标题"), "小林生日气球场");
    await user.type(screen.getByLabelText("收礼者称呼"), "小林");
    await user.type(screen.getByLabelText("提示语"), "录一句你想对小林说的话");
    await user.click(screen.getByRole("button", { name: "创建礼物房间" }));

    expect(await screen.findByText("送礼者制作链接")).toBeInTheDocument();
    expect(screen.getByText("组织者管理链接")).toBeInTheDocument();
    expect(screen.getByText(/\/gift\/invite_/)).toBeInTheDocument();
    expect(screen.getByText(/\/manage\/manage_/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/gift\/invite_/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/manage\/manage_/ })).toBeInTheDocument();
  });

  it("restores the created links when returning to the home page", async () => {
    const user = userEvent.setup();
    const repositories = createInMemoryRepositories();

    renderHomePage(repositories);

    await user.type(screen.getByLabelText("房间标题"), "小林生日气球场");
    await user.type(screen.getByLabelText("收礼者称呼"), "小林");
    await user.click(screen.getByRole("button", { name: "创建礼物房间" }));
    expect(await screen.findByText("房间已创建")).toBeInTheDocument();

    cleanup();
    renderHomePage(repositories);

    expect(screen.getByText("送礼者制作链接")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/gift\/invite_/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/manage\/manage_/ })).toBeInTheDocument();
  });
});
