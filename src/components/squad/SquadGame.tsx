/**
 * One squad game on the stage (any of the five; see lib/squadGames). Set up
 * a round (deck + who's playing, default: everyone on the call), play the
 * stage you're on, then the reveal and "Next round". The server holds the
 * secrets; this only ever draws the public round plus my own card.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useSquadStage, type FaceCue } from "@/context/SquadStageContext";
import { ApiError } from "@/lib/api";
import { getSquadMembers, squadErrorText } from "@/lib/squad";
import {
  SQUAD_GAMES,
  canSkip,
  closeStage,
  getRound,
  listNames,
  makeMove,
  myTurn,
  readEnergy,
  saveEnergy,
  secondsLeft,
  skipCard,
  startBlocker,
  stageCueFor,
  startRound,
  tallyRows,
  waitingOn,
  type Deck,
  type MyView,
  type Round,
  type RoundState,
  type SquadGameId,
} from "@/lib/squadGames";
import { cn } from "@/lib/utils";

type Names = (pid: string) => string;

export function SquadGame({ game }: { game: SquadGameId }) {
  const room = useRoomSession();
  const qc = useQueryClient();
  const key = useMemo(() => ["squad-game", room.roomId, game], [room.roomId, game]);
  const state = useQuery({ queryKey: key, queryFn: () => getRound(room.roomId, game) });
  const members = useQuery({
    queryKey: ["squad-members", room.roomId],
    queryFn: () => getSquadMembers(room.roomId),
  });
  // "Next round" (or the first open): deal without a setup form.
  const [setup, setSetup] = useState(false);
  // Tonight's energy, asked once and remembered; the header switch changes it.
  const [energy, setEnergyState] = useState<Deck | null>(() => readEnergy(room.roomId));
  const setEnergy = (d: Deck) => {
    saveEnergy(room.roomId, d);
    setEnergyState(d);
  };
  // Anyone sitting the next round out (kept while this game is open).
  const [sitOut, setSitOut] = useState<Set<string>>(() => new Set());

  // Someone moved: refetch my own view (the push carries no secrets).
  useEffect(() => {
    const refetch = () => void qc.invalidateQueries({ queryKey: key });
    const offDurable = room.channel.onDurable((u) => {
      if (u.activityId === `game_${game}`) refetch();
    });
    const offReconnect = room.channel.onReconnect(refetch);
    return () => {
      offDurable();
      offReconnect();
    };
  }, [room.channel, game, key, qc]);

  const list = members.data?.members ?? [];
  const byPid = new Map(list.map((m) => [m.participant_id, m]));
  const nameOf: Names = (pid) => byPid.get(pid)?.display_name || "Someone";
  const me = list.find((m) => m.user_id === room.senderId)?.participant_id ?? null;
  // Everyone on the call right now, as squad participant ids.
  const onCall = useMemo(() => {
    const users = new Set(room.presence.map((p) => String(p.user_id ?? p.sender_id ?? "")));
    return list.filter((m) => m.user_id && users.has(m.user_id)).map((m) => m.participant_id);
  }, [room.presence, list]);

  const put = (s: RoundState) => qc.setQueryData(key, s);
  const fail = (fallback: string) => (e: unknown) => {
    toast.error(squadErrorText(e, fallback));
    void qc.invalidateQueries({ queryKey: key });
  };
  const move = useMutation({
    mutationFn: (value: unknown) => makeMove(room.roomId, game, value),
    onSuccess: put,
    onError: fail("That didn't go through. Try again."),
  });
  const skipThis = useMutation({
    mutationFn: () => skipCard(room.roomId, game),
    onSuccess: (s) => {
      put(s);
      toast.message("New card dealt.");
    },
    onError: fail("That card's already in play."),
  });
  const skip = useMutation({
    mutationFn: () => closeStage(room.roomId, game),
    onSuccess: put,
    onError: fail("Couldn't move on just now."),
  });

  const info = SQUAD_GAMES[game];
  const round = state.data?.round ?? null;
  const mine = state.data?.me ?? null;

  // Tell the call what this moment is (SquadStageContext): who can be
  // tapped, who's in, whose face steps forward. Faces are keyed by call
  // identity (user id); the round speaks in participant ids.
  const setCue = useSquadStage()?.setCue;
  const faceVote = Boolean(setCue);
  const plan = useMemo(() => stageCueFor(round, mine, me, setup || !round), [round, mine, me, setup]);
  const vote = useRef(move.mutate);
  vote.current = move.mutate;
  useEffect(() => {
    if (!setCue) return;
    const uid = (pid: string | null) => (pid ? (byPid.get(pid)?.user_id ?? null) : null);
    const pidOf = (id: string) => list.find((m) => m.user_id === id)?.participant_id ?? null;
    const faces: Record<string, FaceCue> = {};
    for (const [pid, cue] of Object.entries(plan.faces)) {
      const id = uid(pid);
      if (id) faces[id] = cue;
    }
    setCue({
      mode: plan.mode,
      focus: uid(plan.focus),
      faces,
      hint: plan.hint,
      onTap: plan.vote
        ? (id) => {
            const pid = pidOf(id);
            if (pid) vote.current(pid);
          }
        : undefined,
    });
    // byPid and list follow members.data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCue, plan, members.data]);
  useEffect(() => () => setCue?.(null), [setCue]);

  if (state.isLoading || members.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-4 pt-2 sm:px-8 sm:pb-6 sm:pt-6">
      <div className="mx-auto w-full max-w-xl space-y-3 sm:space-y-5">
        <header className="space-y-0.5 text-center sm:space-y-1">
          <p className="dr-eyebrow text-primary/85">
            {round && !setup ? `Round ${round.number} · ${info.mood}` : info.mood}
          </p>
          <h2 className="font-serif text-2xl text-cream sm:text-3xl">{info.label}</h2>
          {energy && round && !setup && (
            <button
              type="button"
              onClick={() => setEnergy(energy === "spicy" ? "mild" : "spicy")}
              title="Changes the next card"
              className="focus-ring mx-auto mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-cream"
            >
              Next card: <span className="font-semibold text-cream">{energy === "spicy" ? "🌶️ Spicy" : "Mild"}</span>
              <span aria-hidden>⇄</span>
            </button>
          )}
        </header>

        {!round || setup ? (
          <Dealer
            game={game}
            onCall={onCall}
            nameOf={nameOf}
            energy={energy}
            onEnergy={setEnergy}
            sitOut={sitOut}
            onSitOut={setSitOut}
            quick={Boolean(round)}
            onDealt={(s) => {
              put(s);
              setSetup(false);
            }}
            onBusy={() => {
              setSetup(false);
              void qc.invalidateQueries({ queryKey: key });
            }}
          />
        ) : round.stage === "revealed" ? (
          <>
            <Reveal round={round} nameOf={nameOf} me={me} />
            <button
              type="button"
              onClick={() => setSetup(true)}
              className="btn-primary focus-ring w-full rounded-full py-3.5 font-semibold"
            >
              Next round
            </button>
          </>
        ) : (
          <>
            <Play
              round={round}
              mine={mine}
              me={me}
              nameOf={nameOf}
              busy={move.isPending}
              onMove={(v) => move.mutate(v)}
              faceVote={faceVote}
            />
            <Waiting round={round} me={me} nameOf={nameOf} busy={skip.isPending} onSkip={() => skip.mutate()} />
            {canSkip(round, me) && (
              <div className="text-center">
                <button
                  type="button"
                  disabled={skipThis.isPending}
                  onClick={() => skipThis.mutate()}
                  className="focus-ring rounded-full px-3 py-1 text-sm text-muted-foreground underline-offset-2 hover:text-cream hover:underline disabled:opacity-40"
                >
                  Skip this card
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────── Dealing a round ───────────────── */

/**
 * No setup form: tonight's energy is asked once, then every deal is
 * automatic. The first card of a game gets a 3-2-1 so the squad can settle;
 * "Next round" deals straight away. Everyone on the call plays unless
 * someone taps Players and sits out.
 */
function Dealer({
  game,
  onCall,
  nameOf,
  energy,
  onEnergy,
  sitOut,
  onSitOut,
  quick,
  onDealt,
  onBusy,
}: {
  game: SquadGameId;
  onCall: string[];
  nameOf: Names;
  energy: Deck | null;
  onEnergy: (d: Deck) => void;
  sitOut: Set<string>;
  onSitOut: (s: Set<string>) => void;
  quick: boolean;
  onDealt: (s: RoundState) => void;
  onBusy: () => void;
}) {
  const room = useRoomSession();
  const [count, setCount] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const players = onCall.filter((p) => !sitOut.has(p));
  const blocker = startBlocker(game, players.length);
  const info = SQUAD_GAMES[game];
  const start = useMutation({
    mutationFn: () => startRound(room.roomId, game, energy ?? "mild", players),
    onSuccess: onDealt,
    onError: (e) => {
      const code = e instanceof ApiError ? (e.body as { detail?: { error?: string } })?.detail?.error : null;
      if (code === "round_in_progress") onBusy(); // someone else dealt first: join theirs
      else toast.error(squadErrorText(e, "The round didn't start. Try again."));
    },
  });

  const ready = Boolean(energy) && !blocker && !choosing && !start.isPending && !start.isSuccess;
  const deal = useRef(start.mutate);
  deal.current = start.mutate;
  useEffect(() => {
    if (!ready) return;
    if (quick) {
      deal.current();
      return;
    }
    let n = 3;
    setCount(n);
    const t = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(t);
        setCount(null);
        deal.current();
      } else setCount(n);
    }, 700);
    return () => {
      window.clearInterval(t);
      setCount(null);
    };
  }, [ready, quick]);

  if (!energy) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-2xl text-cream">Tonight's energy?</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEnergy("mild")}
            className="focus-ring rounded-2xl border border-white/[0.1] bg-card/30 px-3 py-5 text-cream hover:border-primary/40"
          >
            <span className="block text-2xl" aria-hidden>😇</span>
            <span className="mt-1 block font-semibold">Mild</span>
            <span className="block text-xs text-muted-foreground">Everyone's comfortable</span>
          </button>
          <button
            type="button"
            onClick={() => onEnergy("spicy")}
            className="focus-ring rounded-2xl border border-white/[0.1] bg-card/30 px-3 py-5 text-cream hover:border-primary/40"
          >
            <span className="block text-2xl" aria-hidden>🌶️</span>
            <span className="mt-1 block font-semibold">Spicy</span>
            <span className="block text-xs text-muted-foreground">No mercy tonight</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">We'll remember it for tonight. Switch any time on the card.</p>
      </div>
    );
  }

  const playersLink = (
    <button
      type="button"
      onClick={() => setChoosing(true)}
      className="focus-ring rounded text-sm text-muted-foreground underline-offset-2 hover:text-cream hover:underline"
    >
      Players · {players.length}
    </button>
  );

  if (choosing) {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">Who's playing this round?</p>
        <div className="flex flex-wrap justify-center gap-2">
          {onCall.map((pid) => {
            const on = !sitOut.has(pid);
            return (
              <button
                key={pid}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(sitOut);
                  if (on) next.add(pid);
                  else next.delete(pid);
                  onSitOut(next);
                }}
                className={cn(
                  "focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  on ? "border-primary/60 bg-primary/15 text-cream" : "border-white/[0.1] text-muted-foreground",
                )}
              >
                {on && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                {nameOf(pid)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setChoosing(false)}
          className="btn-primary focus-ring w-full rounded-full py-3 font-semibold"
        >
          Deal
        </button>
      </div>
    );
  }

  if (blocker) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm text-cream">
          {info.label} needs {info.min} players. {players.length === 1 ? "1 is" : `${players.length} are`} here.
        </p>
        <p className="text-xs text-muted-foreground">Invite someone from the squad sheet, or pick another game.</p>
        {sitOut.size > 0 && playersLink}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-center" aria-live="polite">
      {count !== null ? (
        <p className="font-serif text-7xl text-primary" aria-label={`Dealing in ${count}`}>
          {count}
        </p>
      ) : (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" aria-label="Dealing" />
      )}
      <p className="text-sm text-muted-foreground">{info.how}</p>
      {playersLink}
    </div>
  );
}

/* ───────────────── Playing a stage ───────────────── */

function Prompt({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="rounded-3xl border border-primary/25 bg-primary/[0.08] px-5 py-6 text-center font-serif text-2xl leading-snug text-cream">
      {text}
    </p>
  );
}

function PlayerGrid({
  players,
  nameOf,
  picked,
  disabled,
  onPick,
}: {
  players: string[];
  nameOf: Names;
  picked: unknown;
  disabled?: boolean;
  onPick: (pid: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {players.map((pid) => (
        <button
          key={pid}
          type="button"
          aria-pressed={picked === pid}
          disabled={disabled}
          onClick={() => onPick(pid)}
          className={cn(
            "focus-ring rounded-2xl border px-3 py-3.5 text-[15px] font-semibold transition-colors disabled:opacity-60",
            picked === pid
              ? "border-primary/60 bg-primary/20 text-cream"
              : "border-white/[0.08] bg-card/30 text-cream/90 hover:border-primary/30",
          )}
        >
          {nameOf(pid)}
        </button>
      ))}
    </div>
  );
}

function AnswerBox({
  initial,
  busy,
  onSend,
  placeholder,
}: {
  initial: string;
  busy: boolean;
  onSend: (text: string) => void;
  placeholder: string;
}) {
  const [text, setText] = useState(initial);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSend(text.trim());
      }}
    >
      <textarea
        value={text}
        maxLength={200}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="auth-input focus-ring w-full resize-none"
        aria-label="Your answer"
      />
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="btn-primary focus-ring w-full rounded-full py-3 font-semibold disabled:opacity-40"
      >
        {initial ? "Change my answer" : "Send in secret"}
      </button>
      {initial && <p className="text-center text-xs text-muted-foreground">Sent. You can change it until everyone's in.</p>}
    </form>
  );
}

function Play({
  round,
  mine,
  me,
  nameOf,
  busy,
  onMove,
  faceVote = false,
}: {
  round: Round;
  mine: MyView | null;
  me: string | null;
  nameOf: Names;
  busy: boolean;
  onMove: (value: unknown) => void;
  /** On a squad night you vote by tapping faces in the call, not names here. */
  faceVote?: boolean;
}) {
  const turn = myTurn(round, me);
  const playing = Boolean(mine?.playing);
  const text = round.prompt?.text;

  if (round.game === "heads_up") return <HeadsUp round={round} mine={mine} me={me} nameOf={nameOf} onMove={onMove} />;

  if (round.game === "imposter") {
    const order = round.prompt?.order ?? [];
    return (
      <div className="space-y-4">
        {playing && (
          <div className="rounded-3xl border border-primary/25 bg-primary/[0.08] px-5 py-6 text-center">
            <p className="dr-eyebrow text-muted-foreground">{round.prompt?.category}</p>
            {mine?.card?.imposter ? (
              <>
                <p className="mt-2 font-serif text-3xl text-cream">You're the imposter 🤫</p>
                <p className="mt-2 text-sm text-muted-foreground">You don't know the word. Listen, then blend in.</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">The secret word</p>
                <p className="font-serif text-4xl text-cream">{mine?.card?.word}</p>
              </>
            )}
          </div>
        )}
        {order.length > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            One word each, in this order: <span className="text-cream">{order.map(nameOf).join(" → ")}</span>
          </p>
        )}
        {turn && !faceVote && (
          <>
            <p className="text-center text-sm text-cream">When you've all spoken, vote out the imposter:</p>
            <PlayerGrid
              players={round.players.filter((p) => p !== me)}
              nameOf={nameOf}
              picked={mine?.my_move}
              disabled={busy}
              onPick={onMove}
            />
          </>
        )}
      </div>
    );
  }

  if (round.game === "most_likely") {
    return (
      <div className="space-y-4">
        <Prompt text={text} />
        {turn && !faceVote && (
          <PlayerGrid players={round.players} nameOf={nameOf} picked={mine?.my_move} disabled={busy} onPick={onMove} />
        )}
      </div>
    );
  }

  const answers = round.public.answers ?? [];
  if (round.stage === "answer") {
    const judge = round.game === "spill_tea" ? round.lead_id : null;
    return (
      <div className="space-y-4">
        <Prompt text={text} />
        {judge && (
          <p className="text-center text-sm text-muted-foreground">
            {judge === me ? "You're the judge this round. Wait for the answers." : `${nameOf(judge)} is judging this round.`}
          </p>
        )}
        {turn && (
          <AnswerBox
            key={round.id}
            initial={typeof mine?.my_move === "string" ? mine.my_move : ""}
            busy={busy}
            onSend={onMove}
            placeholder={round.game === "spill_tea" ? "Fill the blank…" : "Finish the line…"}
          />
        )}
      </div>
    );
  }

  if (round.game === "spill_tea") {
    // pick: the judge picks one; everyone reads along.
    return (
      <div className="space-y-4">
        <Prompt text={text} />
        <p className="text-center text-sm text-muted-foreground">
          {turn ? "Pick your favourite. Nobody knows who wrote what." : `${nameOf(round.lead_id ?? "")} is picking…`}
        </p>
        <div className="space-y-2">
          {answers.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={!turn || busy}
              aria-pressed={mine?.my_move === a.key}
              onClick={() => onMove(a.key)}
              className={cn(
                "focus-ring w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] text-cream transition-colors disabled:cursor-default",
                mine?.my_move === a.key ? "border-primary/60 bg-primary/20" : "border-white/[0.08] bg-card/30",
                turn && "hover:border-primary/30",
              )}
            >
              {a.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // who_said_it: guess who wrote each answer.
  return (
    <Guesses
      key={round.id}
      round={round}
      mine={mine}
      me={me}
      nameOf={nameOf}
      busy={busy}
      turn={turn}
      onMove={onMove}
    />
  );
}

function Guesses({
  round,
  mine,
  me,
  nameOf,
  busy,
  turn,
  onMove,
}: {
  round: Round;
  mine: MyView | null;
  me: string | null;
  nameOf: Names;
  busy: boolean;
  turn: boolean;
  onMove: (value: unknown) => void;
}) {
  const sent = (mine?.my_move ?? {}) as Record<string, string>;
  const [guesses, setGuesses] = useState<Record<string, string>>(sent);
  const others = (round.public.answers ?? []).filter((a) => a.key !== mine?.my_answer_key);
  const suspects = round.players.filter((p) => p !== me);
  const done = others.every((a) => guesses[a.key]);
  return (
    <div className="space-y-4">
      <Prompt text={round.prompt?.text} />
      <p className="text-center text-sm text-muted-foreground">Who wrote each one?</p>
      {others.map((a) => (
        <div key={a.key} className="space-y-2 rounded-2xl border border-white/[0.08] bg-card/30 p-3.5">
          <p className="text-[15px] text-cream">“{a.text}”</p>
          {turn && (
            <div className="flex flex-wrap gap-1.5">
              {suspects.map((pid) => (
                <button
                  key={pid}
                  type="button"
                  aria-pressed={guesses[a.key] === pid}
                  onClick={() => setGuesses({ ...guesses, [a.key]: pid })}
                  className={cn(
                    "focus-ring rounded-full border px-3 py-1 text-sm transition-colors",
                    guesses[a.key] === pid
                      ? "border-primary/60 bg-primary/20 text-cream"
                      : "border-white/[0.1] text-cream/80 hover:border-primary/30",
                  )}
                >
                  {nameOf(pid)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {turn && (
        <button
          type="button"
          disabled={busy || !done}
          onClick={() => onMove(guesses)}
          className="btn-primary focus-ring w-full rounded-full py-3 font-semibold disabled:opacity-40"
        >
          {Object.keys(sent).length ? "Change my guesses" : "Lock in my guesses"}
        </button>
      )}
    </div>
  );
}

function HeadsUp({
  round,
  mine,
  me,
  nameOf,
  onMove,
}: {
  round: Round;
  mine: MyView | null;
  me: string | null;
  nameOf: Names;
  onMove: (value: unknown) => void;
}) {
  const room = useRoomSession();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const left = secondsLeft(round.deadline_at, now);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  // Time's up: fetching the round closes it on the server.
  useEffect(() => {
    if (left === 0) void qc.invalidateQueries({ queryKey: ["squad-game", room.roomId, "heads_up"] });
  }, [left, qc, room.roomId]);

  const guesser = round.lead_id;
  const progress = round.heads_up ? `${Math.min(round.heads_up.index + 1, round.heads_up.total)} of ${round.heads_up.total}` : "";
  const card = mine?.card;
  return (
    <div className="space-y-4 text-center">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 font-semibold tabular-nums text-cream">
        <Timer className="h-4 w-4 text-primary" aria-hidden /> {left}s
      </p>
      <p className="dr-eyebrow text-muted-foreground">
        {round.prompt?.category} · word {progress}
      </p>
      {guesser === me ? (
        <div className="rounded-3xl border border-primary/25 bg-primary/[0.08] px-5 py-8">
          <p className="font-serif text-3xl text-cream">You're guessing</p>
          <p className="mt-2 text-sm text-muted-foreground">Listen to the squad and shout your guesses.</p>
        </div>
      ) : card?.word && mine?.playing ? (
        <>
          <div className="rounded-3xl border border-primary/25 bg-primary/[0.08] px-5 py-8">
            <p className="text-sm text-muted-foreground">Describe it to {nameOf(guesser ?? "")}. Don't say it!</p>
            <p className="mt-2 font-serif text-4xl text-cream">{card.word}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onMove({ result: "pass", index: card.index })}
              className="focus-ring rounded-full border border-white/[0.12] py-3.5 font-semibold text-cream hover:bg-white/[0.06]"
            >
              Pass
            </button>
            <button
              type="button"
              onClick={() => onMove({ result: "got", index: card.index })}
              className="btn-primary focus-ring rounded-full py-3.5 font-semibold"
            >
              Got it
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{nameOf(guesser ?? "")} is guessing.</p>
      )}
    </div>
  );
}

function Waiting({
  round,
  me,
  nameOf,
  busy,
  onSkip,
}: {
  round: Round;
  me: string | null;
  nameOf: Names;
  busy: boolean;
  onSkip: () => void;
}) {
  const left = waitingOn(round);
  if (round.game === "heads_up" || left.length === 0) return null;
  const imIn = me !== null && round.players.includes(me);
  const others = left.filter((p) => p !== me);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-muted-foreground">
      <span>Waiting on {listNames(left.map((p) => (p === me ? "you" : nameOf(p))))}</span>
      {imIn && others.length > 0 && round.submitted.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="focus-ring rounded text-cream/80 underline-offset-2 hover:underline disabled:opacity-40"
        >
          Don't wait
        </button>
      )}
    </div>
  );
}

/* ───────────────── The reveal ───────────────── */

function Reveal({ round, nameOf, me }: { round: Round; nameOf: Names; me: string | null }) {
  const r = (round.public.results ?? {}) as Record<string, unknown>;
  const you = (pid: string) => (pid === me ? "You" : nameOf(pid));
  /** Mid-sentence: "spotted by you". */
  const youLower = (pid: string) => (pid === me ? "you" : nameOf(pid));

  if (round.game === "most_likely" || round.game === "imposter") {
    const rows = tallyRows((r.tally ?? {}) as Record<string, number>, nameOf);
    const max = Math.max(1, ...rows.map((x) => x.votes));
    return (
      <div className="space-y-4">
        {round.game === "most_likely" ? (
          <>
            <Prompt text={round.prompt?.text} />
            <p className="text-center font-serif text-2xl text-cream">
              {(r.top as string[] | undefined)?.length
                ? `${listNames((r.top as string[]).map(you))}!`
                : "Nobody voted."}
            </p>
            <p className="text-center text-sm text-muted-foreground">Everyone who voted with the room scores a point.</p>
          </>
        ) : (
          <>
            <p className="text-center font-serif text-3xl text-cream">
              {r.imposter === me ? "You were the imposter" : `It was ${nameOf(String(r.imposter ?? ""))}.`}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              The word was <span className="text-cream">{String(r.word ?? "")}</span>.{" "}
              {r.caught
                ? "Caught! Everyone else scores a point."
                : r.imposter === me
                  ? "You got away with it: 2 points to you."
                  : "They got away with it: 2 points to the imposter."}
            </p>
          </>
        )}
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.pid} className="relative overflow-hidden rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-cream">
              <span
                className="absolute inset-y-0 left-0 bg-primary/20"
                style={{ width: `${(row.votes / max) * 100}%` }}
                aria-hidden
              />
              <span className="relative flex justify-between">
                <span>{you(row.pid)}</span>
                <span className="tabular-nums">{row.votes} vote{row.votes === 1 ? "" : "s"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (round.game === "heads_up") {
    const words = (r.words ?? []) as { word: string; result: string }[];
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-3xl text-cream">
          {you(String(r.guesser ?? ""))} got {Number(r.got ?? 0)}
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {words.map((w, i) => (
            <span
              key={i}
              className={cn(
                "rounded-full px-3 py-1 text-sm",
                w.result === "got" ? "bg-primary/20 text-cream" : "bg-white/[0.05] text-muted-foreground line-through",
              )}
            >
              {w.word}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const answers = round.public.answers ?? [];
  if (round.game === "spill_tea") {
    const authors = (r.authors ?? {}) as Record<string, string>;
    const picked = r.picked as string | undefined;
    return (
      <div className="space-y-4">
        <Prompt text={round.prompt?.text} />
        <p className="text-center font-serif text-2xl text-cream">
          {r.winner ? `${you(String(r.winner))} wins the round` : "No pick this time."}
        </p>
        <ul className="space-y-2">
          {answers.map((a) => (
            <li
              key={a.key}
              className={cn(
                "rounded-2xl border px-4 py-3",
                a.key === picked ? "border-primary/60 bg-primary/15" : "border-white/[0.08] bg-card/30",
              )}
            >
              <p className="text-[15px] text-cream">{a.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {authors[a.key] ? you(authors[a.key]) : ""}
                {a.key === picked && " · the judge's pick"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // who_said_it
  const per = (r.answers ?? {}) as Record<string, { author: string; right: string[]; fooled: string[] }>;
  return (
    <div className="space-y-4">
      <Prompt text={round.prompt?.text} />
      <ul className="space-y-2">
        {answers.map((a) => {
          const row = per[a.key];
          return (
            <li key={a.key} className="rounded-2xl border border-white/[0.08] bg-card/30 px-4 py-3">
              <p className="text-[15px] text-cream">“{a.text}”</p>
              {row && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="text-primary">{you(row.author)}</span>
                  {row.right.length > 0 && ` · spotted by ${listNames(row.right.map(youLower))}`}
                  {row.fooled.length > 0 && ` · fooled ${listNames(row.fooled.map(youLower))}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
