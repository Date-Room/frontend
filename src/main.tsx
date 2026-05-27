import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCatalogDefaultsFromBundle } from "@/lib/catalogRuntime";

// Activity content (questions, this-or-that pairs, reactions, limits) ships in
// the embedded bundle. The backend deck content is wired per-activity where
// needed (e.g. Questions via /v1/decks).
initCatalogDefaultsFromBundle();
createRoot(document.getElementById("root")!).render(<App />);
