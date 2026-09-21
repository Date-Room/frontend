import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/i18n/config";
import { initCatalogDefaultsFromBundle } from "@/lib/catalogRuntime";

// Activity content (questions, this-or-that pairs, reactions, limits) ships in
// the embedded bundle. The backend deck content is wired per-activity where
// needed (e.g. Questions via /v1/decks).
initCatalogDefaultsFromBundle();

// Routes load as separate chunks. Someone who kept a tab open across a deploy
// asks for a chunk hash that no longer exists; rather than a blank page, take
// the fresh build. Once per page life, so a genuinely broken host doesn't
// reload in a loop.
let reloadedForStaleChunk = false;
window.addEventListener("vite:preloadError", (event) => {
  if (reloadedForStaleChunk) return;
  reloadedForStaleChunk = true;
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
