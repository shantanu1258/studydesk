import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ModalHistoryProvider } from "./components/ui/Modal";
import { ThemeProvider } from "./context/ThemeContext";
import { registerPwa } from "./infrastructure/pwa/registerPwa";
import "./styles/index.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <BrowserRouter>
      <ModalHistoryProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ModalHistoryProvider>
    </BrowserRouter>
  </StrictMode>,
);
registerPwa();
