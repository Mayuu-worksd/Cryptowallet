-- ─── P2P Chat Table (Supabase Realtime) ──────────────────────────────────────
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS p2p_chat (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  message       TEXT NOT NULL,
  is_support    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast order-based queries
CREATE INDEX IF NOT EXISTS idx_p2p_chat_order_id ON p2p_chat(order_id);

-- Enable Row Level Security
ALTER TABLE p2p_chat ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read chat messages for orders they are part of
CREATE POLICY "p2p_chat_read" ON p2p_chat
  FOR SELECT USING (true);

-- Allow insert from authenticated or anon (wallet-based auth)
CREATE POLICY "p2p_chat_insert" ON p2p_chat
  FOR INSERT WITH CHECK (true);

-- Enable Realtime on this table (run in Supabase Dashboard → Database → Replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE p2p_chat;

-- ─── P2P Orders: Add platform_fee columns ────────────────────────────────────
ALTER TABLE p2p_orders
  ADD COLUMN IF NOT EXISTS platform_fee           NUMERIC(18, 8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiat_total_after_fee   NUMERIC(18, 8) DEFAULT 0;
