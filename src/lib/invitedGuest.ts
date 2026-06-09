/** Host-entered guest first name from the create-room wizard. Stored
 *  per room until the partner joins (then presence / participants win). */

const PREFIX = "dr_invited_guest:";

export function saveInvitedGuestName(roomId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(`${PREFIX}${roomId}`, trimmed);
  } catch {
    /* private mode / quota */
  }
}

export function getInvitedGuestName(roomId: string): string | null {
  try {
    const v = localStorage.getItem(`${PREFIX}${roomId}`);
    return v?.trim() || null;
  } catch {
    return null;
  }
}
