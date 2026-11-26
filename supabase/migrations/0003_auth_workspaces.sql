-- Tie workspaces to authenticated Supabase Auth users

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS user_id UUID NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
