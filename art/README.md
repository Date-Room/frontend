# Source art

Full-resolution originals for the images under `public/`. Nothing here is
served. Re-export after editing:

- `dock-tiles/*.png` (1024²) → `public/dock-tiles/<name>.webp` at 512 px
  (lobby grid, invites, tray), and `<name>-hero.webp` at 1024 px for the nine
  games whose landing uses the tile as a stage backdrop (`gameVisuals.ts`).
- `lobby-cards/*.png` (1152×864) → `public/lobby-cards/<name>.webp` at 768 px.

Why WebP at display size: a 1024² PNG decodes to 4 MB of RAM whatever size
it's drawn at, and the lobby mounts sixteen of them. On a 3-4 GB phone that
was enough to get the tab evicted on an app switch.
