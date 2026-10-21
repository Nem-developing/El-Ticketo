import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@fontsource-variable/rubik";

import { App } from "./App";
import "./styles/main.scss";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
