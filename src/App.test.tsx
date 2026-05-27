import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { App } from "./App";

it("renders the home placeholder", () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: "Balloon Burst Gift" })).toBeInTheDocument();
});
