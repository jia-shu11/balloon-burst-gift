import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { RepositoryProvider } from "./data/repositoryProvider";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RepositoryProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </RepositoryProvider>
  </React.StrictMode>
);
