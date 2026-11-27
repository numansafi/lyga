-- Dedicated feedback table for all /app users (including non-waitlist and QR-paired devices)

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  user_id UUID NULL,
  email TEXT NULL,
  workspace_id UUID NULL REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
