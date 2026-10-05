import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/i18n/config";
import { initCatalogDefaultsFromBundle } from "@/lib/catalogRuntime";
import { applyTheme, loadThemeMode } from "@/lib/themeMode";

// Activity content (questions, this-or-that pairs, reactions, limits) ships in
// the embedded bundle. The backend deck content is wired per-activity where
// needed (e.g. Questions via /v1/decks).
initCatalogDefaultsFromBundle();
// Applied before the first paint so a light-mode visitor never sees a dark
// flash. Nothing else needs to run first: it only sets an attribute.
applyTheme(loadThemeMode());

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
