# Date-Room frontend

## Typechecking

Use `npm run typecheck` (`tsc -b --noEmit`).

Do NOT run bare `npx tsc --noEmit`: the root `tsconfig.json` is a solution
file (`"files": []` + project references), so it typechecks nothing and
always passes. That blind spot let a missing-import crash reach production
(fixed in PR #75).

## Commands

- `npm run dev` — Vite dev server
- `npm run typecheck` — the real typecheck (see above)
- `npm test` — vitest, single run
- `npm run build` — production build
- `npm run lint` — eslint
