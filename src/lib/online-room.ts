import { supabase } from "@/integrations/supabase/client";

export type Choice = "scissors" | "paper" | "stone";
export type Player = 1 | 2;
export type RoundLog = { round: number; p1: Choice; p2: Choice; winner: Player | 0 };

export type Room = {
  code: string;
  round: number;
  first_player: number;
  turn: number;
  p1_choice: Choice | null;
  p2_choice: Choice | null;
  score1: number;
  score2: number;
  log: RoundLog[];
  phase: "waiting" | "playing" | "reveal" | "over";
  p2_joined: boolean;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeCode(len = 4) {
  let out = "";
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function beats(a: Choice, b: Choice) {
  return (
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "stone") ||
    (a === "stone" && b === "scissors")
  );
}

export async function createRoom(): Promise<Room> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data, error } = await supabase
      .from("game_rooms")
      .insert({ code })
      .select()
      .maybeSingle();
    if (!error && data) return data as unknown as Room;
  }
  throw new Error("Could not open a saloon room. Try again.");
}

export async function fetchRoom(code: string): Promise<Room | null> {
  const { data } = await supabase
    .from("game_rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return (data as unknown as Room) ?? null;
}

export async function joinRoom(code: string): Promise<Room> {
  const room = await fetchRoom(code);
  if (!room) throw new Error("No such room code.");
  if (room.p2_joined) return room;
  const { data, error } = await supabase
    .from("game_rooms")
    .update({ p2_joined: true, phase: "playing" })
    .eq("code", room.code)
    .select()
    .maybeSingle();
  if (error || !data) throw new Error("Could not join that room.");
  return data as unknown as Room;
}

export async function patchRoom(code: string, patch: Partial<Room>) {
  await supabase.from("game_rooms").update(patch as never).eq("code", code);
}

export function subscribeRoom(code: string, onChange: (room: Room) => void) {
  const channel = supabase
    .channel(`room-${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "game_rooms", filter: `code=eq.${code}` },
      (payload) => {
        if (payload.new) onChange(payload.new as unknown as Room);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
