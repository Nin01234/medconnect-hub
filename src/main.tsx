import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "./index.css";
import { installDevConsoleNoiseFilter } from "./dev/consoleNoiseFilter";

installDevConsoleNoiseFilter();

createRoot(document.getElementById("root")!).render(<App />);
