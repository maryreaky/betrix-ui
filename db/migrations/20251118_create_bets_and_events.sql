-- 20251118_create_bets_and_events.sql
CREATE TABLE IF NOT EXISTS bets (
  bet_ref TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  market_id TEXT,
  selection_id TEXT,
  stake_bigint BIGINT NOT NULL,
  odds_decimal NUMERIC NOT NULL,
  potential_payout_bigint BIGINT NOT NULL,
  reserve_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS bet_events (
  id BIGSERIAL PRIMARY KEY,
  bet_ref TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bets_user_status ON bets(user_id, status);
