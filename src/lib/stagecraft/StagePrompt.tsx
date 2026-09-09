/**
 * StagePrompt — the unmissable instruction band. Play-testers locked a pick
 * and then just sat there: the small status line under a title doesn't get
 * read mid-game. This is a full-width banner that slides in when a new
 * instruction begins and STAYS until the phase moves on (it never times out,
 * because the instruction is still true). Key it by `id` so a new phase
 * re-plays the entrance.
 */
export function StagePrompt({ id, lead, text }: { id: string; lead?: string; text: string }) {
  return (
    <div key={id} className="dr-stage-prompt" role="status" aria-live="assertive">
      {lead && <span className="dr-stage-prompt-lead">{lead}</span>}
      <span className="dr-stage-prompt-text">{text}</span>
    </div>
  );
}
