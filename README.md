# Date Room — Web

Couples' virtual date room (web client): video (LiveKit), shared activities, and
realtime state. This is a **Vite + React SPA** that talks directly to the
deployed **FastAPI backend** (`/v1/…`) and to **Supabase** (auth + realtime) —
the same backend the iOS app uses, so web and mobile interoperate in a room.

There is **no bundled Node server** anymore; the SPA is fully client-side.

## Local development

```bash
cp .env.example .env   # fill in the values below
npm install
npm run dev            # Vite on http://localhost:8080
```

### Environment (`.env`)

| Var | Purpose |
|-----|---------|
| `VITE_API_BASE_URL` | Backend origin, no trailing slash (e.g. the Railway URL). Callers add `/v1`. |
| `VITE_SUPABASE_URL` | Supabase project URL — the **same** project the backend validates JWTs against. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key. Never use the service key here. |
| `VITE_LIVEKIT_URL` | *(optional)* ws URL fallback; normally the backend returns it with the token. |

**Auth:** web uses **email one-time code → magic link** via Supabase. Add
`http://localhost:8080/auth/callback` to the Supabase project's
**Auth → URL Configuration → Redirect URLs**.

## Architecture

- **Auth & profile:** Supabase Auth; profile via `GET/PATCH /v1/users/me`.
- **Rooms:** `/v1/rooms` (create, list-mine, by-code, join, start/end/leave, livekit-token).
- **Realtime:** Supabase channel `room:<roomId>` (broadcast + presence) and
  Postgres-changes on `room_activity_states`; LiveKit for video.
- **Activities:** Chat, Watch, This-or-That, DJ, 21 Questions — each on the
  shared `RoomActivitySession` (`src/lib/activitySession.ts`) matching the
  mobile wire format.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
