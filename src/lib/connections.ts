/**
 * Connections API — the `/v1/connections` surface that backs Our
 * Rooms. Mirrors the FastAPI schemas in `backend/app/schemas/connection.py`.
 *
 * The list is partner-oriented: the server hides canonical a/b ordering
 * and gives the caller "the other user from their POV" via `partner`.
 */
import { api } from "@/lib/api";

export type ConnectionStatus = "active" | "grace" | "archived";

export type ConnectionPartner = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
};

export type Connection = {
  id: string;
  partner: ConnectionPartner;
  status: ConnectionStatus;
  grace_expires_at: string | null;
  created_at: string;
  /** Latest room tagged to this connection — drives the "Last met X"
   *  subtitle on Home and the sort order. Null on freshly-promoted
   *  connections that haven't had a shared session yet. */
  last_room_at: string | null;
};

export function listMyConnections(): Promise<Connection[]> {
  return api.get<Connection[]>("/v1/connections");
}

export function getConnection(id: string): Promise<Connection> {
  return api.get<Connection>(`/v1/connections/${id}`);
}

/** "Last met 2d ago" / "New Our Room" — display helper for tiles. */
export function lastMetLabel(c: Connection, now: number = Date.now()): string {
  if (!c.last_room_at) return "New Our Room";
  const ms = now - new Date(c.last_room_at).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return "Last met just now";
  const h = Math.floor(m / 60);
  if (h < 24) return `Last met ${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Last met ${d}d ago`;
  if (d < 30) return `Last met ${Math.floor(d / 7)}w ago`;
  const t = new Date(c.last_room_at);
  return `Last met ${t.getMonth() + 1}/${t.getDate()}`;
}
