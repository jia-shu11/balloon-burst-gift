import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { App } from "./App";

function renderRoute(route: string) {
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={[route]}
    >
      <App />
    </MemoryRouter>
  );
}

it("renders the home placeholder", () => {
  renderRoute("/");

  expect(screen.getByRole("heading", { name: "Balloon Burst Gift" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "返回首页" })).toBeInTheDocument();
});

it("renders the gift route labels", () => {
  renderRoute("/gift/invite-token");

  expect(screen.getByRole("heading", { name: "制作气球礼物" })).toBeInTheDocument();
});

it("renders the management route labels", () => {
  renderRoute("/manage/manage-token");

  expect(screen.getByRole("heading", { name: "管理礼物房间" })).toBeInTheDocument();
});

it("renders the recipient route labels", () => {
  renderRoute("/r/recipient-token");

  expect(screen.getByRole("heading", { name: "收礼现场" })).toBeInTheDocument();
});
