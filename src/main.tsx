import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDevConsoleNoiseFilter } from "./dev/consoleNoiseFilter";

installDevConsoleNoiseFilter();

createRoot(document.getElementById("root")!).render(<App />);
