CREATE TABLE public.game_rooms (
  code TEXT PRIMARY KEY,
  round INT NOT NULL DEFAULT 1,
  first_player INT NOT NULL DEFAULT 1,
  turn INT NOT NULL DEFAULT 1,
  p1_choice TEXT,
  p2_choice TEXT,
  score1 INT NOT NULL DEFAULT 0,
  score2 INT NOT NULL DEFAULT 0,
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase TEXT NOT NULL DEFAULT 'waiting',
  p2_joined BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.game_rooms TO anon;
GRANT SELECT, INSERT, UPDATE ON public.game_rooms TO authenticated;
GRANT ALL ON public.game_rooms TO service_role;

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game rooms" ON public.game_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create game rooms" ON public.game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update game rooms" ON public.game_rooms FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_game_room()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER game_rooms_touch BEFORE UPDATE ON public.game_rooms
FOR EACH ROW EXECUTE FUNCTION public.touch_game_room();

ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;