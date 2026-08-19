import { useCallback, useEffect, useRef, useState } from "react";
import { Scissors, Hand, Mountain, Volume2, VolumeX, RotateCcw, Trophy, Share2 } from "lucide-react";

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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.955L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
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
