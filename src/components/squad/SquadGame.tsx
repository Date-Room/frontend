/**
 * One squad game on the stage (any of the five; see lib/squadGames). Set up
 * a round (deck + who's playing, default: everyone on the call), play the
 * stage you're on, then the reveal and "Next round". The server holds the
 * secrets; this only ever draws the public round plus my own card.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import { useRoomSession } from "@/context/RoomSessionContext";
import { useSquadStage, type FaceCue } from "@/context/SquadStageContext";
import { TABLE_QUERY } from "@/lib/squadCall";
import { useMediaQuery } from "@/lib/viewport";
import { ApiError } from "@/lib/api";
import { getSquadMembers, squadErrorText } from "@/lib/squad";
import { PersonLabel } from "@/components/PersonLabel";
import { FaceMark } from "@/components/FaceMark";
import { UserAvatarImg } from "@/components/UserAvatarImg";
import { SOMEONE, YOU } from "@/lib/people";
import {
  SQUAD_GAMES,
  beatCue,
  canSkip,
  closeStage,
  getRound,
  hasSeenRole,
  isRoundConflict,
  listNames,
  markRoleSeen,
  makeMove,
  myTurn,
  nextPin,
  pokeLine,
  questionFor,
  readEnergy,
  revealBeats,
  roleCard,
  roomAhead,
  roleFor,
  roleLine,
  saveEnergy,
  secondsLeft,
  skipCard,
  softClockFor,
  startBlocker,
  stageCueFor,
  startRound,
  submitFor,
  waitingLine,
  waitingOn,
  type Beat,
  type Deck,
  type MyView,
  type Pinned,
  type Round,
  type RoundState,
  type RoleCard,
  type SquadGameId,
  type Submission,
} from "@/lib/squadGames";
import { iAmOnTheCall } from "@/lib/deviceId";
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
  const me = list.find((m) => m.user_id === room.senderId)?.participant_id ?? null;
  /** Their real name, whoever they are. For anything that LEAVES this
   *  screen — a poke carries my name to someone else, and "You" would
   *  arrive as a riddle. */
  const trueNameOf: Names = (pid) => byPid.get(pid)?.display_name || SOMEONE;
  /** What to call them on this screen. I am "You" here: seeing your own
   *  name in the third person — "Jun's turn", "Jun wins" — reads like
   *  being talked about rather than played with. `revealBeats` has done
   *  this for its captions all along (and conjugates for it: "You win"
   *  against "Jun wins"); doing it in `nameOf` is that same choice
   *  reaching the seat chips, the ballot and every other name on the
   *  stage. */
  const nameOf: Names = (pid) => (pid === me ? YOU : trueNameOf(pid));
  /** Their photo, for the faces on the ballot. */
  const photoOf = (pid: string) => byPid.get(pid)?.photo_url ?? null;
  // Everyone here right now, as squad participant ids: in the room, or on
  // the video. The room link can blink on a phone or a long call while the
  // video carries on; counting only the room made three people look like
  // two, and every game but Clue Me In said it needed more players.
  const inCall = useSquadStage()?.inCall;
  const onCall = useMemo(() => {
    const users = new Set(room.presence.map((p) => String(p.user_id ?? p.sender_id ?? "")));
    for (const id of inCall ?? []) users.add(id);
    return list.filter((m) => m.user_id && users.has(m.user_id)).map((m) => m.participant_id);
  }, [room.presence, list, inCall]);

  // The round THIS device is on, which is not always the one the room is
  // on: `nextPin` holds me on a reveal I'm still reading while somebody
  // else deals the next card (see squadGames, "the round you are on is
  // yours to leave"). Everything below renders the pinned round.
  const current = state.data ?? null;
  const [pin, setPin] = useState<Pinned | null>(null);
  useEffect(() => {
    setPin((p) => nextPin(p, current));
  }, [current]);
  const view = pin?.state ?? current;
  const round = view?.round ?? null;
  const mine = view?.me ?? null;
  /** Catch up with a round that's already been dealt. */
  const join = (s: RoundState) => {
    if (s.round) setPin({ number: s.round.number, state: s });
  };
  // Somebody dealt while I was reading: "Next" is a step to take rather
  // than a card to deal.
  const ahead = roomAhead(pin, current);

  const put = (s: RoundState) => qc.setQueryData(key, s);
  // Somebody got there first.
  //
  // A squad plays together, so two people reaching for the same thing at
  // once is ordinary rather than a fault: you tap on a screen that was a
  // second out of date and the server says the round already moved. The
  // refetch was always right — the server is ahead and this screen is
  // behind — but calling it a failure sent people back to look for a
  // mistake they had not made. Say what happened instead. `start` has read
  // this as "join theirs" all along (see onBusy below); this is the same
  // reading for the actions taken once a round is open.
  const fail = (fallback: string) => (e: unknown) => {
    if (isRoundConflict(e)) toast.message("The round moved on — here it is.");
    else toast.error(squadErrorText(e, fallback));
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
      join(s);
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

  // Tell the call what this moment is (SquadStageContext): who can be
  // tapped, who's in, whose face steps forward. Faces are keyed by call
  // identity (user id); the round speaks in participant ids.
  const setCue = useSquadStage()?.setCue;
  // Voting by tapping a face only works if you are ON the call, where
  // the faces are.
  //
  // George: "It says 'Tap a seat to vote. Only you see your pick.' on
  // the web.. but I see no options." He was in the room but his
  // browser had not joined the call, so the card handed the vote to a
  // stage with nobody on it and then told him to tap one of them. The
  // round was running; the laptop simply had no way to answer it, and
  // picks made on the phones could not move a round it was not in.
  //
  // The call being OPEN (setCue) and this viewer being IN it are two
  // different facts, and only the second one puts a face on screen.
  // When it is missing the card keeps its own list of names, which is
  // what every non-squad room uses and has always worked.
  const faceVote = Boolean(setCue) && iAmOnTheCall(room.presence, room.senderId);
  // On a laptop's table there's no strip over the faces: the hint lives here.
  const table = useMediaQuery(TABLE_QUERY) && faceVote;

  // This device's part of the round: Imposter's "Ready to vote" and the Who
  // Said It guesses in progress. Both start over with each stage. Updates go
  // through setLocal(prev => ...) so quick taps never overwrite each other.
  const stageKey = round ? `${round.id}:${round.stage}` : "";
  const [localState, setLocal] = useState<Local>(() => freshLocal(stageKey));
  const local = localState.key === stageKey ? localState : freshLocal(stageKey);
  const patch = (f: (l: Local) => Partial<Local>) =>
    setLocal((prev) => {
      const base = prev.key === stageKey ? prev : freshLocal(stageKey);
      return { ...base, ...f(base) };
    });
  const toGuess = (round?.public.answers ?? []).filter((a) => a.key !== mine?.my_answer_key);
  const reviewing = local.at >= toGuess.length;
  const onScreen = reviewing ? null : toGuess[local.at];
  // The one button at the bottom of the stage (see `submitFor`): a tap
  // on the ballot picks, this sends.
  // One value for the box and for the button: without my own typing,
  // the box shows what I already sent, and "Change my answer" has to be
  // judged against the same text the box is showing.
  const sentAnswer =
    round?.stage === "answer" && typeof mine?.my_move === "string" ? mine.my_move : "";
  const answerText = local.text || sentAnswer;
  const submit: Submission | null =
    round && !setup && round.stage !== "revealed"
      ? submitFor({
          round,
          mine,
          me,
          pick: local.pick,
          draft: local.draft,
          guessable: toGuess,
          reviewing,
          text: answerText,
          imposterReady: local.ready,
        })
      : null;

  // Friends with their first-round card open: user id -> when it goes stale.
  const [readers, setReaders] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!Object.keys(readers).length) return;
    const t = window.setInterval(() => {
      const now = Date.now();
      setReaders((r) => Object.fromEntries(Object.entries(r).filter(([, until]) => until > now)));
    }, 2000);
    return () => window.clearInterval(t);
  }, [readers]);
  const readingPids = list.filter((m) => m.user_id && readers[m.user_id]).map((m) => m.participant_id);

  // The reveal plays beat by beat on devices that saw the round live
  // (revealBeats); anyone arriving afterwards lands on the result.
  const beats = useMemo(
    () => (round && round.stage === "revealed" ? revealBeats(round, me, nameOf) : []),
    // nameOf follows members.data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round, me, members.data],
  );
  const lived = useRef(new Set<string>());
  const [beatAt, setBeatAt] = useState({ id: "", i: 0 });
  useLayoutEffect(() => {
    if (!round) return;
    if (round.stage !== "revealed") {
      lived.current.add(round.id);
      return;
    }
    // Before paint, so the result never flashes ahead of the drumroll.
    if (beatAt.id !== round.id) setBeatAt({ id: round.id, i: lived.current.has(round.id) ? 0 : beats.length - 1 });
  }, [round, beats.length, beatAt.id]);
  const beatIndex = round && beatAt.id === round.id ? Math.min(beatAt.i, beats.length - 1) : beats.length - 1;
  const beat = round?.stage === "revealed" && !setup ? (beats[beatIndex] ?? null) : null;
  const revealDone = beatIndex >= beats.length - 1;
  useEffect(() => {
    if (!beat || revealDone) return;
    const t = window.setTimeout(() => setBeatAt((b) => ({ ...b, i: b.i + 1 })), beat.ms);
    return () => window.clearTimeout(t);
  }, [beat, revealDone]);
  // A reveal moves the league (the table's scores seat, the room page).
  const revealedId = round?.stage === "revealed" ? round.id : null;
  useEffect(() => {
    if (revealedId) void qc.invalidateQueries({ queryKey: ["squad-league", room.roomId] });
  }, [revealedId, qc, room.roomId]);
  const skipReveal = () => setBeatAt((b) => ({ ...b, i: beats.length - 1 }));

  const plan = useMemo(() => {
    if (beat && round) return beatCue(beat, round);
    const p = { ...stageCueFor(round, mine, me, setup || !round, {
      ready: local.ready,
      guessPick: onScreen ? (local.draft[onScreen.key] ?? null) : null,
      reviewing,
      reading: readingPids,
    }) };
    const others = readingPids.filter((pid) => pid !== me);
    if (others.length && (p.mode === "deciding" || p.mode === "waiting")) {
      p.hint = `${listNames(others.map(nameOf))} ${others.length > 1 ? "are" : "is"} reading the rules.`;
    }
    return p;
    // nameOf and readingPids follow members.data and readers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, mine, me, setup, local, onScreen, reviewing, readers, members.data, beat]);
  const vote = useRef(move.mutate);
  vote.current = move.mutate;
  // Tapping a face on Who Said It: that's my guess for the answer on screen;
  // a beat later the next unguessed answer slides in.
  const guess = useRef<(pid: string) => void>(() => {});
  guess.current = (pid) => {
    if (!onScreen) return;
    const key = onScreen.key;
    patch((l) => ({ draft: { ...l.draft, [key]: pid } }));
    window.setTimeout(() => {
      patch((l) => {
        const next = toGuess.findIndex((a) => !l.draft[a.key]);
        return { at: next === -1 ? toGuess.length : next };
      });
    }, 450);
  };
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
      caption: beat?.caption ?? null,
      live: Boolean(round && !setup && round.stage !== "revealed"),
      onTap: plan.vote
        ? (id) => {
            const pid = pidOf(id);
            if (pid) vote.current(pid);
          }
        : plan.guess
          ? (id) => {
              const pid = pidOf(id);
              if (pid) guess.current(pid);
            }
          : undefined,
    });
    // byPid and list follow members.data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCue, plan, members.data, setup, beat]);
  useEffect(() => () => setCue?.(null), [setCue]);

  // Learning the game: the first time you play a role, a card over the game
  // says what that role does; after that, one line under the header.
  const live = Boolean(round && !setup && round.stage !== "revealed");
  const role = live ? roleFor(round, mine, me) : null;
  const [, setSeen] = useState(0);
  const firstTime = role && !hasSeenRole(game, role) ? roleCard(game, role) : null;

  // While my card is open, the others see "📖 reading" on my face. Said
  // every few seconds (a friend who arrives late still hears it) and
  // forgotten after a short while if I vanish.
  const readingNow = Boolean(firstTime);
  useEffect(() => {
    if (!readingNow || !room.senderId) return;
    const say = (on: boolean) => void room.channel.broadcast("squad_reading", { from: room.senderId, game, on });
    say(true);
    const t = window.setInterval(() => say(true), 4000);
    return () => {
      window.clearInterval(t);
      say(false);
    };
  }, [readingNow, room.channel, room.senderId, game]);
  useEffect(
    () =>
      room.channel.onBroadcast((e) => {
        const from = String(e.payload.from ?? "");
        if (!from || from === room.senderId) return;
        if (e.kind === "squad_reading" && e.payload.game === game) {
          setReaders((r) => {
            const next = { ...r };
            if (e.payload.on) next[from] = Date.now() + 9000;
            else delete next[from];
            return next;
          });
        } else if (e.kind === "squad_poke" && Array.isArray(e.payload.to) && e.payload.to.includes(room.senderId)) {
          toast(`👀 ${String(e.payload.name || "Your squad")} is waiting on you`);
          navigator.vibrate?.(200);
        }
      }),
    [room.channel, room.senderId, game],
  );
  const poke = (pids: string[]) => {
    const to = pids.map((pid) => byPid.get(pid)?.user_id).filter(Boolean);
    const name = me ? trueNameOf(me) : SOMEONE;
    void room.channel.broadcast("squad_poke", { from: room.senderId, to, name, game });
  };

  if (state.isLoading || members.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0">
    {/* Three zones, top to bottom — George: "Question (top area), options
        or main piece (middle area), button (bottom area)." The middle is
        the only part that scrolls, so the question you are answering and
        the button you answer it with are both always on screen, which is
        what a long ballot on a short phone used to cost you. */}
    <div className="flex h-full min-h-0 flex-col px-4 pb-4 pt-2 sm:px-8 sm:pb-6 sm:pt-6">
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-3 sm:gap-5">
        <header className="shrink-0 space-y-0.5 text-center sm:space-y-1">
          <p className="dr-eyebrow text-primary/85">
            {round && !setup ? `Round ${round.number} · ${info.mood}` : info.mood}
          </p>
          {plan.mode !== "hero" && <h2 className="font-serif text-2xl text-cream sm:text-3xl">{info.label}</h2>}
          {energy && round && !setup && plan.mode !== "hero" && (
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
        {live && round && plan.mode !== "waiting" && roleLine(round, role, nameOf) && (
          <p className="shrink-0 text-center text-sm text-cream/80">{roleLine(round, role, nameOf)}</p>
        )}

        {!round || setup ? (
          <GameLayout>
          <Dealer
            game={game}
            onCall={onCall}
            nameOf={nameOf}
            me={me}
            energy={energy}
            onEnergy={setEnergy}
            sitOut={sitOut}
            onSitOut={setSitOut}
            quick={Boolean(round)}
            onDealt={(s) => {
              put(s);
              join(s);
              setSetup(false);
            }}
            onBusy={() => {
              setSetup(false);
              void qc.invalidateQueries({ queryKey: key });
            }}
          />
          </GameLayout>
        ) : round.stage === "revealed" ? (
          <GameLayout
            action={
              revealDone ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      // Already dealt by somebody who finished reading
                      // first: step onto it rather than deal a third card.
                      if (ahead && current) join(current);
                      else setSetup(true);
                    }}
                    className="btn-primary focus-ring w-full rounded-full py-3.5 font-semibold"
                  >
                    Next round
                  </button>
                  {ahead && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      The next card is dealt. Take your time — it waits for you.
                    </p>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={skipReveal}
                    className="focus-ring rounded-full px-3 py-1 text-sm text-muted-foreground hover:text-cream"
                  >
                    {round.game === "who_said_it" ? "Show them all ›" : "Skip ›"}
                  </button>
                </div>
              )
            }
          >
            <Reveal round={round} nameOf={nameOf} me={me} beat={beat} done={revealDone} />
          </GameLayout>
        ) : (
          /* The card keeps its own question and options all the way
             through the stage, and waiting goes UNDERNEATH them: the
             panel used to replace the card the moment you'd moved,
             which took away the one view of what you had picked and
             left the stage saying "tap a seat to vote" over a card
             with nothing to tap. */
          <GameLayout
            question={<Prompt text={questionFor(round) ?? undefined} />}
            action={
              <>
                {submit && (
                  <button
                    type="button"
                    disabled={!submit.ready || move.isPending}
                    onClick={() => move.mutate(submit.value)}
                    className="btn-primary focus-ring w-full rounded-full py-3.5 font-semibold disabled:opacity-40"
                  >
                    {submit.label}
                  </button>
                )}
                {table && (plan.vote || plan.guess) && plan.hint && (
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {plan.hint.replace("Tap a face", "Tap a seat")}
                  </p>
                )}
                {canSkip(round, me) && (
                  <div className="mt-1 text-center">
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
            }
          >
            <Play
              round={round}
              mine={mine}
              me={me}
              nameOf={nameOf}
              trueNameOf={trueNameOf}
              photoOf={photoOf}
              busy={move.isPending}
              onMove={(v) => move.mutate(v)}
              pick={local.pick}
              onPickOne={(id) => patch(() => ({ pick: id }))}
              answerText={answerText}
              onAnswerText={(t) => patch(() => ({ text: t }))}
              ready={local.ready}
              onReady={() => patch(() => ({ ready: true }))}
              guessing={{
                answers: toGuess,
                draft: local.draft,
                at: local.at,
                onPick: (pid) => guess.current(pid),
                onJump: (i) => patch(() => ({ at: i })),
              }}
            />
            {plan.mode === "waiting" && (
              <WaitPanel
                key={stageKey}
                round={round}
                me={me}
                nameOf={nameOf}
                busy={skip.isPending}
                onReveal={() => skip.mutate()}
                onPoke={poke}
              />
            )}
          </GameLayout>
        )}
      </div>
    </div>
      {firstTime && role && (
        <FirstTimeCard
          card={firstTime}
          onGotIt={() => {
            markRoleSeen(game, role);
            setSeen((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

/** What this device holds that the round does not — including a pick
 *  that has been chosen but not sent (see `submitFor`). Cleared with
 *  the stage, so a new card never starts with the last one's answer. */
type Local = {
  key: string;
  ready: boolean;
  draft: Record<string, string>;
  at: number;
  pick: string | null;
  /** The answer being typed, so the Send button can live at the bottom
   *  of the stage with every other game's. */
  text: string;
};
const freshLocal = (key: string): Local => ({
  key,
  ready: false,
  draft: {},
  at: 0,
  pick: null,
  text: "",
});

/**
 * The stage, in three bands: the question at the top, the options or
 * whatever the round's main piece is in the middle, and the one button
 * at the bottom.
 *
 * George: "for the games, try a distribution like Question (top area),
 * Options or main piece (middle area), Button (bottom area)."
 *
 * Only the middle scrolls. A single scrolling column meant that on a
 * short phone a five-person ballot pushed its own button off the bottom
 * of the screen, so answering took a scroll you had no reason to expect
 * — and the question you were answering had already gone off the top.
 */
function GameLayout({
  question,
  action,
  children,
}: {
  question?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      {question && <div className="shrink-0">{question}</div>}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto sm:gap-4">
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Your role, the first time you play it: three lines and the points. Sits
 *  over the game panel only, so the call stays in view. The full rules are
 *  the stage's own ? just above it (a second ? here would sit right under
 *  it, and a sheet opened from inside the stage gets clipped by it). */
function FirstTimeCard({ card, onGotIt }: { card: RoleCard; onGotIt: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex overflow-y-auto bg-background/80 p-2 backdrop-blur-sm animate-fade-in sm:p-6">
      <div
        role="dialog"
        aria-label={card.title}
        className="relative m-auto w-full max-w-sm rounded-3xl border border-primary/25 bg-card px-4 pb-3 pt-4 shadow-2xl sm:px-5 sm:pb-4 sm:pt-5"
      >
        <p className="dr-eyebrow text-primary/85">Your first round</p>
        <h3 className="mt-0.5 font-serif text-xl text-cream sm:mt-1 sm:text-2xl">{card.title}</h3>
        <ol className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
          {card.steps.map((st) => (
            <li key={st.text} className="flex items-start gap-3 text-sm leading-snug text-cream/85 sm:text-[15px]">
              <span className="w-6 shrink-0 text-center text-lg leading-none" aria-hidden>
                {st.glyph}
              </span>
              <span>{st.text}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2.5 rounded-xl bg-primary/[0.1] px-3 py-1.5 sm:mt-3 sm:py-2 text-center text-sm font-semibold text-cream">{card.score}</p>
        <button type="button" onClick={onGotIt} className="btn-primary focus-ring mt-2.5 w-full rounded-full py-2.5 font-semibold sm:mt-3 sm:py-3">
          Got it
        </button>
        <p className="mt-1.5 text-center text-xs text-muted-foreground sm:mt-2">All the rules are under ? at the top.</p>
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
  me,
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
  me: string | null;
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
                <PersonLabel name={nameOf(pid)} isMe={pid === me} />
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

/** The card's question. Keyed on the text so a new card re-runs the
 *  roll-in: the question arrives, then the options under it (`Ballot`),
 *  which is the order you read them in. */
function Prompt({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p
      key={text}
      className="animate-float-up rounded-3xl border border-primary/25 bg-primary/[0.08] px-5 py-6 text-center font-serif text-2xl leading-snug text-cream"
    >
      {text}
    </p>
  );
}

/** Someone's photo, or their initial, or a silhouette (see FaceMark). */
function Face({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.06]">
      <UserAvatarImg
        src={photo}
        alt=""
        className="h-full w-full object-cover"
        fallback={
          <span className="font-serif text-lg font-semibold text-cream/80">
            <FaceMark name={name} />
          </span>
        }
      />
    </span>
  );
}

/**
 * The ballot: one person per row, photo and name, down the card.
 *
 * George: "since we are selecting people, show their profile.. like
 * their name with the profile photo, so the options look more cool. And
 * animate the questions and options roll out. Keep options in a straight
 * line."
 *
 * A straight line rather than the old two-up grid, because a column of
 * faces is a list of people you can run your eye down; a 2x3 grid is a
 * keypad you have to search. It rolls out under the question
 * (`stagger-children`), and it is ALWAYS on the card — tapping a face in
 * the call does the same job, but only for whoever can see the faces, and
 * a card that says "tap a seat" to someone with no seats on screen is a
 * card with no options on it at all.
 */
function Ballot({
  players,
  nameOf,
  trueNameOf,
  photoOf,
  me,
  picked,
  sent,
  disabled,
  onPick,
}: {
  players: string[];
  /** The label; the "(You)" mark is added here. */
  nameOf: Names;
  /** For the glyph on the face: my own initial, not "Y" for "You". */
  trueNameOf: Names;
  photoOf: (pid: string) => string | null;
  me: string | null;
  /** Chosen — which may be a pick not yet sent. */
  picked: unknown;
  /** Already with the server, so the row can say so. */
  sent?: string | null;
  disabled?: boolean;
  onPick: (pid: string) => void;
}) {
  return (
    <div className="stagger-children space-y-2">
      {players.map((pid) => {
        const on = picked === pid;
        return (
          <button
            key={pid}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onPick(pid)}
            className={cn(
              "focus-ring flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
              on
                ? "border-primary/60 bg-primary/20"
                : "border-white/[0.08] bg-card/30 hover:border-primary/30",
            )}
          >
            <Face photo={photoOf(pid)} name={trueNameOf(pid)} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-cream">
              <PersonLabel name={nameOf(pid)} isMe={pid === me} />
            </span>
            {on && sent === pid && (
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-primary/80">
                In
              </span>
            )}
            {on && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** The answer, as you type it. The Send button lives at the bottom of
 *  the stage with every other game's (see GameLayout). */
function AnswerBox({
  value,
  onChange,
  sent,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  sent: string | null;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={value}
        maxLength={200}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="auth-input focus-ring w-full resize-none"
        aria-label="Your answer"
      />
      {sent && (
        <p className="text-center text-xs text-muted-foreground">
          Sent. You can change it until everyone's in.
        </p>
      )}
    </div>
  );
}

function Play({
  round,
  mine,
  me,
  nameOf,
  trueNameOf,
  photoOf,
  busy,
  onMove,
  pick,
  onPickOne,
  answerText,
  onAnswerText,
  ready,
  onReady,
  guessing,
}: {
  round: Round;
  mine: MyView | null;
  me: string | null;
  nameOf: Names;
  trueNameOf: Names;
  photoOf: (pid: string) => string | null;
  busy: boolean;
  onMove: (value: unknown) => void;
  /** Chosen on this device, not sent yet. A tap picks; the button at
   *  the bottom of the stage sends (see `submitFor`). */
  pick: string | null;
  onPickOne: (id: string) => void;
  /** The answer being typed. Held by the stage so its Send button can
   *  sit in the bottom band with every other game's. */
  answerText: string;
  onAnswerText: (text: string) => void;
  /** Imposter: voting shows once you've tapped "Ready to vote". */
  ready: boolean;
  onReady: () => void;
  guessing: Guessing;
}) {
  const turn = myTurn(round, me);
  const playing = Boolean(mine?.playing);
  const text = round.prompt?.text;

  if (round.game === "heads_up") return <HeadsUp round={round} mine={mine} me={me} nameOf={nameOf} onMove={onMove} />;

  if (round.game === "imposter") {
    const order = round.prompt?.order ?? [];
    // Talking first: your secret fills the panel so a glance is enough.
    // Voting waits for "Ready to vote" (or a vote already cast).
    const voting = turn && (ready || round.submitted.includes(me ?? ""));
    return (
      <div className="space-y-3 sm:space-y-4">
        {playing && (
          <div
            className={cn(
              "rounded-3xl border border-primary/25 bg-primary/[0.08] px-5 text-center",
              voting ? "py-3" : "py-8 sm:py-10",
            )}
          >
            <p className="dr-eyebrow text-muted-foreground">
              {round.prompt?.category}
              {mine?.card?.imposter ? "" : " · your word"}
            </p>
            {mine?.card?.imposter ? (
              <>
                <p className={cn("mt-1 font-serif text-cream", voting ? "text-2xl" : "text-4xl sm:text-5xl")}>
                  You're the imposter 🤫
                </p>
                {!voting && <p className="mt-2 text-sm text-muted-foreground">Listen, then blend in.</p>}
              </>
            ) : (
              <p className={cn("mt-1 font-serif text-cream", voting ? "text-3xl" : "text-5xl sm:text-6xl")}>
                {mine?.card?.word}
              </p>
            )}
          </div>
        )}
        {order.length > 0 && !voting && (
          <p className="text-center text-sm text-muted-foreground">
            {/* With three the server sends the order twice: two clues each. */}
            {order.length > round.players.length ? "Two clues each, round twice: " : "One word each: "}
            <span className="text-cream">
              {order.slice(0, round.players.length).map((p, i) => (
                <span key={`${p}-${i}`}>
                  {i > 0 && " → "}
                  <PersonLabel name={nameOf(p)} isMe={p === me} />
                </span>
              ))}
            </span>
          </p>
        )}
        {turn && !voting && (
          <button type="button" onClick={onReady} className="btn-primary focus-ring w-full rounded-full py-3 font-semibold">
            Ready to vote
          </button>
        )}
        {voting && (
          <Ballot
            players={round.players.filter((p) => p !== me)}
            nameOf={nameOf}
            trueNameOf={trueNameOf}
            photoOf={photoOf}
            me={me}
            picked={pick ?? mine?.my_move}
            sent={typeof mine?.my_move === "string" ? mine.my_move : null}
            disabled={busy}
            onPick={onPickOne}
          />
        )}
      </div>
    );
  }

  if (round.game === "most_likely") {
    // The question is the stage's top band now, not part of this.
    return turn ? (
      <Ballot
        players={round.players}
        nameOf={nameOf}
        trueNameOf={trueNameOf}
        photoOf={photoOf}
        me={me}
        picked={pick ?? mine?.my_move}
        sent={typeof mine?.my_move === "string" ? mine.my_move : null}
        disabled={busy}
        onPick={onPickOne}
      />
    ) : null;
  }

  const answers = round.public.answers ?? [];
  if (round.stage === "answer") {
    return turn ? (
      <AnswerBox
        value={answerText}
        onChange={onAnswerText}
        sent={typeof mine?.my_move === "string" ? mine.my_move : null}
        placeholder={round.game === "spill_tea" ? "Fill the blank…" : "Finish the line…"}
      />
    ) : null;
  }

  if (round.game === "spill_tea") {
    // pick: the judge picks one; everyone reads along.
    const chosen = pick ?? (typeof mine?.my_move === "string" ? mine.my_move : null);
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          {turn ? "Pick your favourite. Nobody knows who wrote what." : `${nameOf(round.lead_id ?? "")} is picking…`}
        </p>
        <div className="stagger-children space-y-2">
          {answers.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={!turn || busy}
              aria-pressed={chosen === a.key}
              onClick={() => onPickOne(a.key)}
              className={cn(
                "focus-ring w-full rounded-2xl border px-4 py-3.5 text-left text-[15px] text-cream transition-colors disabled:cursor-default",
                chosen === a.key ? "border-primary/60 bg-primary/20" : "border-white/[0.08] bg-card/30",
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
      round={round}
      me={me}
      nameOf={nameOf}
      trueNameOf={trueNameOf}
      photoOf={photoOf}
      busy={busy}
      turn={turn}
      guessing={guessing}
      onMove={onMove}
    />
  );
}

type Guessing = {
  /** The answers I guess on (not my own). */
  answers: { key: string; text: string }[];
  draft: Record<string, string>;
  /** Which answer is on screen; answers.length once they're all guessed. */
  at: number;
  onPick: (pid: string) => void;
  onJump: (index: number) => void;
};

/** Who Said It: one answer at a time in big type. Tap a face (or a name,
 *  off the call) and the next slides in; then check them and lock in. */
function Guesses({
  round,
  me,
  nameOf,
  trueNameOf,
  photoOf,
  busy,
  turn,
  guessing,
  onMove,
}: {
  round: Round;
  me: string | null;
  nameOf: Names;
  trueNameOf: Names;
  photoOf: (pid: string) => string | null;
  busy: boolean;
  turn: boolean;
  guessing: Guessing;
  onMove: (value: unknown) => void;
}) {
  const { answers, draft, at, onPick, onJump } = guessing;
  const suspects = round.players.filter((p) => p !== me);
  const current = answers[at];

  if (!turn) {
    return (
      <div className="space-y-3">
        <Prompt text={round.prompt?.text} />
        <p className="text-center text-sm text-muted-foreground">The squad is guessing who wrote what.</p>
      </div>
    );
  }

  const dots = (
    <div className="flex justify-center gap-1.5" aria-label="Answers">
      {answers.map((a, i) => (
        <button
          key={a.key}
          type="button"
          onClick={() => onJump(i)}
          aria-label={`Answer ${i + 1}${draft[a.key] ? `, you said ${nameOf(draft[a.key])}` : ""}`}
          className={cn(
            "focus-ring h-2.5 rounded-full transition-all",
            i === at ? "w-6 bg-fill" : draft[a.key] ? "w-2.5 bg-primary/60" : "w-2.5 bg-white/20",
          )}
        />
      ))}
    </div>
  );

  if (current) {
    return (
      <div className="space-y-3 text-center sm:space-y-4">
        <p className="dr-eyebrow text-muted-foreground">
          Who wrote this? · {at + 1} of {answers.length}
        </p>
        <p key={current.key} className="animate-fade-in font-serif text-2xl leading-snug text-cream sm:text-3xl">
          “{current.text}”
        </p>
        <Ballot
          players={suspects}
          nameOf={nameOf}
          trueNameOf={trueNameOf}
          photoOf={photoOf}
          me={me}
          picked={draft[current.key]}
          onPick={onPick}
        />
        {dots}
      </div>
    );
  }

  // All guessed: check them, change any, lock in.
  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">Your guesses. Tap one to change it.</p>
      {answers.map((a, i) => (
        <button
          key={a.key}
          type="button"
          onClick={() => onJump(i)}
          className="focus-ring flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-card/30 px-3.5 py-2.5 text-left hover:border-primary/30"
        >
          <span className="min-w-0 flex-1 truncate text-[15px] text-cream">“{a.text}”</span>
          <span className="shrink-0 text-sm font-semibold text-primary">{draft[a.key] ? nameOf(draft[a.key]) : "?"}</span>
        </button>
      ))}
      <button
        type="button"
        disabled={busy || answers.some((a) => !draft[a.key])}
        onClick={() => onMove(draft)}
        className="btn-primary focus-ring w-full rounded-full py-3 font-semibold disabled:opacity-40"
      >
        Lock in my guesses
      </button>
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
  const clock = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums",
        left <= 10 ? "bg-fill text-primary-foreground" : "bg-white/[0.06] text-cream",
      )}
    >
      <Timer className="h-3.5 w-3.5" aria-hidden /> {left}s
    </span>
  );
  // Almost no screen: the guesser's face is the show (the call, above), so
  // the clue-givers get the word and two thumb-sized buttons.
  if (guesser === me) {
    return (
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2">
          {clock}
          <span className="dr-eyebrow text-muted-foreground">word {progress}</span>
        </div>
      </div>
    );
  }
  if (!(card?.word && mine?.playing)) {
    return (
      <div className="space-y-2 text-center">
        {clock}
        <p className="text-sm text-muted-foreground">{nameOf(guesser ?? "")} is guessing.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 text-center">
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {clock}
        <span>Describe it · don't say it</span>
      </div>
      <p key={card.word} className="animate-in font-serif text-4xl leading-tight text-cream fade-in duration-300 sm:text-5xl">
        {card.word}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onMove({ result: "pass", index: card.index })}
          className="focus-ring h-16 rounded-2xl border border-white/[0.14] text-lg font-semibold text-cream hover:bg-white/[0.06] sm:h-20"
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => onMove({ result: "got", index: card.index })}
          className="btn-primary focus-ring h-16 rounded-2xl text-lg font-semibold sm:h-20"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/** Your card, folded small once you've moved: the room takes over. */
/** Waiting on the others: who's in, a soft clock, Poke, and "Reveal now",
 *  which becomes the main button once the clock runs out. */
function WaitPanel({
  round,
  me,
  nameOf,
  busy,
  onReveal,
  onPoke,
}: {
  round: Round;
  me: string | null;
  nameOf: Names;
  busy: boolean;
  onReveal: () => void;
  onPoke: (pids: string[]) => void;
}) {
  const total = softClockFor(round);
  const [left, setLeft] = useState(total);
  const [poked, setPoked] = useState<string | null>(null);
  useEffect(() => {
    const started = Date.now();
    const t = window.setInterval(() => {
      const l = Math.max(0, total - Math.floor((Date.now() - started) / 1000));
      setLeft(l);
      if (l === 0) window.clearInterval(t);
    }, 250);
    return () => window.clearInterval(t);
  }, [total]);
  useEffect(() => {
    if (!poked) return;
    const t = window.setTimeout(() => setPoked(null), 10000);
    return () => window.clearTimeout(t);
  }, [poked]);

  const still = waitingOn(round);
  if (!still.length) return null;
  const judging = round.game === "spill_tea" && round.stage === "answer" && round.lead_id === me;
  const expected = still.length + round.submitted.length;
  const target = pokeLine(round, me, nameOf);
  const imIn = me !== null && round.players.includes(me);
  const canReveal = imIn && round.submitted.length > 0;
  const out = left === 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <p className="text-sm text-cream">
          <span className="font-semibold">{judging ? "👑 You're judging" : "✓ You're in"}</span>
          {" · "}
          <span className="text-muted-foreground">{waitingLine(round)}</span>
        </p>
        <span
          className={cn(
            "inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-sm font-semibold tabular-nums",
            out ? "border-primary/60 text-primary" : "border-white/15 text-cream/80",
          )}
          aria-label={out ? "Time's up" : `${left} seconds`}
        >
          {out ? <Timer className="h-4 w-4" aria-hidden /> : left}
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {target && (
          <button
            type="button"
            disabled={Boolean(poked)}
            onClick={() => {
              onPoke(target.pids);
              setPoked(`${listNames(target.pids.map(nameOf))} got a nudge`);
            }}
            className="focus-ring rounded-full border border-white/[0.12] px-3.5 py-2.5 text-sm font-semibold text-cream hover:bg-white/[0.06] disabled:opacity-60"
          >
            {poked ?? `👀 ${target.label}`}
          </button>
        )}
        {canReveal && (
          <button
            type="button"
            disabled={busy}
            onClick={onReveal}
            className={cn(
              "focus-ring shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40",
              out ? "btn-primary animate-pulse" : "border border-white/[0.12] text-cream/80 hover:bg-white/[0.06]",
            )}
          >
            {round.stage === "answer" ? "Show answers" : "Reveal now"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────────── The reveal ───────────────── */

/** The reveal, beat by beat (see revealBeats). The call carries the face
 *  and the gold caption; this panel carries the words around it. */
function Reveal({
  round,
  nameOf,
  me,
  beat,
  done,
}: {
  round: Round;
  nameOf: Names;
  me: string | null;
  beat: Beat | null;
  done: boolean;
}) {
  const r = (round.public.results ?? {}) as Record<string, unknown>;
  const you = (pid: string) => (pid === me ? "You" : nameOf(pid));
  /** Mid-sentence: "spotted by you". */
  const youLower = (pid: string) => (pid === me ? "you" : nameOf(pid));
  // In the spotlight the caption rides on the face; the panel only says it
  // when no face is forward (the drumroll, a tie, nobody voted).
  const caption = beat?.caption && beat.mode !== "spotlight" ? (
    <p key={beat.caption} className="animate-in text-center font-serif text-3xl text-primary fade-in zoom-in-95 duration-500 sm:text-4xl">
      {beat.caption}
    </p>
  ) : null;

  if (round.game === "most_likely") {
    return (
      <div className="space-y-3 sm:space-y-4">
        <Prompt text={round.prompt?.text} />
        {caption}
        {done && (r.top as string[] | undefined)?.length ? (
          <p className="text-center text-sm text-muted-foreground">Everyone who agreed scores a point.</p>
        ) : null}
      </div>
    );
  }

  if (round.game === "imposter") {
    return (
      <div className="space-y-3 text-center sm:space-y-4">
        {caption}
        {done && (
          <p className="animate-in text-sm text-muted-foreground fade-in duration-700">
            The word was <span className="font-serif text-lg text-cream">{String(r.word ?? "")}</span>.{" "}
            {r.caught
              ? "Everyone else scores a point."
              : r.imposter === me
                ? "2 points to you."
                : `2 points to ${nameOf(String(r.imposter ?? ""))}.`}
          </p>
        )}
      </div>
    );
  }

  if (round.game === "heads_up") {
    const words = (r.words ?? []) as { word: string; result: string }[];
    return (
      <div className="space-y-4 text-center">
        {caption}
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
    const pick = answers.find((a) => a.key === picked);
    return (
      <div className="space-y-3 sm:space-y-4">
        <Prompt text={round.prompt?.text} />
        {caption}
        {pick && (
          <p className="text-center font-serif text-xl text-cream">“{pick.text}”</p>
        )}
        {done && (
          <ul className="space-y-2">
            {answers
              .filter((a) => a.key !== picked)
              .map((a) => (
                <li key={a.key} className="rounded-2xl border border-white/[0.08] bg-card/30 px-4 py-2.5">
                  <p className="text-[15px] text-cream">{a.text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{authors[a.key] ? you(authors[a.key]) : ""}</p>
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }

  // who_said_it: one author at a time, then all of them.
  const per = (r.answers ?? {}) as Record<string, { author: string; right: string[]; fooled: string[] }>;
  const line = (row: { right: string[]; fooled: string[] }) =>
    [
      row.right.length ? `spotted by ${listNames(row.right.map(youLower))}` : "",
      row.fooled.length ? `fooled ${listNames(row.fooled.map(youLower))}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  const now = beat?.answer ? answers.find((a) => a.key === beat.answer) : null;
  if (now && per[now.key]) {
    const i = answers.findIndex((a) => a.key === now.key);
    return (
      <div key={now.key} className="animate-in space-y-3 text-center fade-in duration-500">
        <p className="dr-eyebrow text-muted-foreground">
          {i + 1} of {answers.length}
        </p>
        <p className="font-serif text-2xl leading-snug text-cream sm:text-3xl">“{now.text}”</p>
        {caption}
        <p className="text-sm text-muted-foreground">{line(per[now.key]) || "Nobody guessed it."}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 sm:space-y-4">
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
                  {line(row) && ` · ${line(row)}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
