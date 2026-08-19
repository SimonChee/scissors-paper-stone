import { useCallback, useEffect, useRef, useState } from "react";
import { Scissors, Hand, Mountain, Volume2, VolumeX, RotateCcw, Trophy } from "lucide-react";

import {
  resumeAudio,
  startMusic,
  stopMusic,
  setMuted,
  sfxTick,
  sfxStop,
  sfxWin,
  sfxDraw,
  sfxChampion,
} from "@/lib/saloon-audio";

type Choice = "scissors" | "paper" | "stone";
type Player = 1 | 2;

const CHOICES: Choice[] = ["scissors", "paper", "stone"];
const TOTAL_ROUNDS = 7;
const FLASH_MS = 110;

const LABEL: Record<Choice, string> = {
  scissors: "Scissors",
  paper: "Paper",
  stone: "Stone",
};

function ChoiceIcon({ choice, className }: { choice: Choice; className?: string }) {
  if (choice === "scissors") return <Scissors className={className} strokeWidth={1.5} />;
  if (choice === "paper") return <Hand className={className} strokeWidth={1.5} />;
  return <Mountain className={className} strokeWidth={1.5} />;
}

function beats(a: Choice, b: Choice) {
  return (
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "stone") ||
    (a === "stone" && b === "scissors")
  );
}

type RoundLog = { round: number; p1: Choice; p2: Choice; winner: Player | 0 };

export function ShowdownGame() {
  const [round, setRound] = useState(1);
  const [first, setFirst] = useState<Player>(1);
  const [turn, setTurn] = useState<Player>(1);
  const [locked, setLocked] = useState<Partial<Record<Player, Choice>>>({});
  const [flash, setFlash] = useState<Choice>("scissors");
  const [scores, setScores] = useState({ 1: 0, 2: 0 });
  const [log, setLog] = useState<RoundLog[]>([]);
  const [resultText, setResultText] = useState("Round 1 — Player 1 draws first. Hit STOP!");
  const [phase, setPhase] = useState<"playing" | "reveal" | "over">("playing");
  const [muted, setMutedState] = useState(false);
  const [started, setStarted] = useState(false);
  const [shake, setShake] = useState(false);

  const flashIndex = useRef(0);

  // Flashing cycle — runs whenever a pick is pending.
  useEffect(() => {
    if (phase !== "playing" || !started) return;
    const id = window.setInterval(() => {
      flashIndex.current = (flashIndex.current + 1) % CHOICES.length;
      setFlash(CHOICES[flashIndex.current] as Choice);
      if (!muted) sfxTick();
    }, FLASH_MS);
    return () => window.clearInterval(id);
  }, [phase, started, muted]);

  useEffect(() => {
    return () => stopMusic();
  }, []);

  const begin = useCallback(() => {
    resumeAudio();
    startMusic();
    setStarted(true);
  }, []);

  const resolveRound = useCallback(
    (p1: Choice, p2: Choice) => {
      const winner: Player | 0 = p1 === p2 ? 0 : beats(p1, p2) ? 1 : 2;
      setLog((l) => [...l, { round, p1, p2, winner }]);
      if (winner) {
        setScores((s) => ({ ...s, [winner]: s[winner] + 1 }));
        sfxWin();
        setResultText(`Round ${round}: Player ${winner} takes it — ${LABEL[winner === 1 ? p1 : p2]} beats ${LABEL[winner === 1 ? p2 : p1]}.`);
      } else {
        sfxDraw();
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setResultText(`Round ${round}: Standoff — both drew ${LABEL[p1]}.`);
      }
      setPhase("reveal");

      const nextFirst: Player = winner ? winner : first;
      window.setTimeout(() => {
        if (round >= TOTAL_ROUNDS) {
          setPhase("over");
          sfxChampion();
          return;
        }
        setRound((r) => r + 1);
        setFirst(nextFirst);
        setTurn(nextFirst);
        setLocked({});
        setPhase("playing");
        setResultText(
          `Round ${round + 1} — Player ${nextFirst} draws first${winner ? " (last round's winner)" : ""}. Hit STOP!`,
        );
      }, 1700);
    },
    [round, first],
  );

  const handleStop = useCallback(
    (player: Player) => {
      if (phase !== "playing" || !started) return;
      if (turn !== player || locked[player]) return;
      const pick = flash;
      sfxStop();
      const next = { ...locked, [player]: pick };
      setLocked(next);
      const other: Player = player === 1 ? 2 : 1;
      if (next[other]) {
        resolveRound(next[1] as Choice, next[2] as Choice);
      } else {
        setTurn(other);
        setResultText(`Player ${player} is locked in. Player ${other}, your draw!`);
      }
    },
    [phase, started, turn, locked, flash, resolveRound],
  );

  // Keyboard: A = player 1 stop, L = player 2 stop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "a") handleStop(1);
      if (e.key.toLowerCase() === "l") handleStop(2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleStop]);

  const reset = () => {
    setRound(1);
    setFirst(1);
    setTurn(1);
    setLocked({});
    setScores({ 1: 0, 2: 0 });
    setLog([]);
    setPhase("playing");
    setResultText("Round 1 — Player 1 draws first. Hit STOP!");
  };

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
  };

  const champion: Player | 0 =
    scores[1] === scores[2] ? 0 : scores[1] > scores[2] ? 1 : 2;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="text-center">
        <p className="text-display text-xs uppercase tracking-[0.45em] text-primary/80">
          The Dusty Spur Saloon presents
        </p>
        <h1 className="text-display gold-text mt-3 text-4xl leading-tight sm:text-6xl animate-flicker">
          Scissors Paper Stone
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Seven rounds. Two gunslingers. One champion.
        </p>
      </header>

      <div className="panel-wood mt-8 rounded-xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-display text-lg text-primary">
            Round {Math.min(round, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
              const entry = log[i];
              return (
                <span
                  key={i}
                  title={entry ? `Round ${i + 1}` : "Pending"}
                  className={[
                    "h-3 w-6 rounded-sm border border-primary/50",
                    !entry
                      ? "bg-transparent"
                      : entry.winner === 1
                        ? "bg-primary"
                        : entry.winner === 2
                          ? "bg-accent"
                          : "bg-muted-foreground/60",
                  ].join(" ")}
                />
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className="inline-flex items-center gap-2 rounded-md border border-primary/60 px-3 py-1.5 text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary/15"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {muted ? "Muted" : "Music"}
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-primary/60 px-3 py-1.5 text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary/15"
            >
              <RotateCcw className="h-4 w-4" /> New match
            </button>
          </div>
        </div>

        <div
          className={`mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] ${shake ? "animate-shake" : ""}`}
        >
          <PlayerPanel
            player={1}
            score={scores[1]}
            locked={locked[1]}
            flash={flash}
            active={phase === "playing" && turn === 1 && started}
            waiting={phase === "playing" && turn !== 1}
            onStop={() => handleStop(1)}
            hotkey="A"
            disabled={!started || phase !== "playing"}
          />

          <div className="flex items-center justify-center">
            <span className="text-display gold-text text-3xl sm:text-4xl">VS</span>
          </div>

          <PlayerPanel
            player={2}
            score={scores[2]}
            locked={locked[2]}
            flash={flash}
            active={phase === "playing" && turn === 2 && started}
            waiting={phase === "playing" && turn !== 2}
            onStop={() => handleStop(2)}
            hotkey="L"
            disabled={!started || phase !== "playing"}
          />
        </div>

        <div className="mt-6 rounded-lg border border-primary/40 bg-background/50 px-4 py-3 text-center">
          <p className="text-sm sm:text-base">{started ? resultText : "Push the swinging doors open to begin."}</p>
        </div>

        {!started && (
          <div className="mt-4 text-center">
            <button
              onClick={begin}
              className="text-display rounded-md bg-primary px-8 py-3 text-lg text-primary-foreground shadow-brass transition-transform hover:scale-105"
            >
              Enter the Saloon
            </button>
            <p className="mt-2 text-xs text-muted-foreground">Starts the honky-tonk band and the flashing draw.</p>
          </div>
        )}

        {phase === "over" && (
          <div className="animate-swing-in mt-6 rounded-lg border-2 border-primary bg-secondary/60 p-6 text-center">
            <Trophy className="mx-auto h-10 w-10 text-primary" />
            <h2 className="text-display gold-text mt-3 text-3xl">
              {champion ? `Player ${champion} is the Champion!` : "The Match is a Draw"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Final tally — Player 1: {scores[1]} · Player 2: {scores[2]}
            </p>
            <button
              onClick={reset}
              className="text-display mt-5 rounded-md bg-primary px-6 py-2.5 text-primary-foreground shadow-brass transition-transform hover:scale-105"
            >
              Rematch
            </button>
          </div>
        )}
      </div>

      <section className="panel-wood mt-6 rounded-xl p-4 sm:p-6">
        <h3 className="text-display text-lg text-primary">Tally Board</h3>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No rounds played yet.</p>
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {log.map((l) => (
              <li key={l.round} className="flex items-center justify-between border-b border-border/60 pb-1.5">
                <span className="text-muted-foreground">Round {l.round}</span>
                <span>
                  {LABEL[l.p1]} vs {LABEL[l.p2]}
                </span>
                <span className={l.winner === 0 ? "text-muted-foreground" : "text-primary"}>
                  {l.winner === 0 ? "Standoff" : `Player ${l.winner}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          House rules: choices flash nonstop. Player 1 stops first in round one; after that the previous
          round&apos;s winner stops first. Hotkeys — A for Player 1, L for Player 2.
        </p>
      </section>
    </main>
  );
}

function PlayerPanel({
  player,
  score,
  locked,
  flash,
  active,
  waiting,
  onStop,
  hotkey,
  disabled,
}: {
  player: Player;
  score: number;
  locked?: Choice | undefined;
  flash: Choice;
  active: boolean;
  waiting: boolean;
  onStop: () => void;
  hotkey: string;
  disabled: boolean;
}) {
  const shown = locked ?? flash;
  return (
    <div
      className={[
        "rounded-lg border-2 p-4 text-center transition-colors",
        active ? "border-primary bg-secondary/70 shadow-brass" : "border-border bg-secondary/30",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-display text-sm uppercase tracking-widest text-primary">
          Player {player}
        </span>
        <span className="text-display text-2xl gold-text">{score}</span>
      </div>

      <div
        className={[
          "mx-auto mt-4 flex h-32 w-32 items-center justify-center rounded-full border-2",
          locked ? "border-primary bg-background animate-swing-in" : "border-border bg-background/70",
        ].join(" ")}
      >
        <ChoiceIcon
          choice={shown}
          className={`h-14 w-14 ${locked ? "text-primary" : "text-foreground/70"}`}
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {locked ? LABEL[locked] : waiting ? "Hold steady…" : "Flashing…"}
      </p>

      <button
        onClick={onStop}
        disabled={disabled || !active || !!locked}
        className="text-display mt-4 w-full rounded-md bg-primary px-4 py-3 text-lg text-primary-foreground shadow-brass transition-transform enabled:hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Stop
      </button>
      <p className="mt-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">Key: {hotkey}</p>
    </div>
  );
}
