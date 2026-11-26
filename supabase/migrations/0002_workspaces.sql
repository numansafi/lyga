-- Lyga Core Web MVP schema (workspaces, paired devices, encrypted feed items)

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_code TEXT NOT NULL UNIQUE,
  max_devices INTEGER NOT NULL DEFAULT 2,
  storage_limit_bytes BIGINT NOT NULL DEFAULT 2147483648,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Browser',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'link', 'code', 'media', 'file')),
  encrypted_meta TEXT NOT NULL,
  encrypted_body TEXT NULL,
  blob_key TEXT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_pair_code ON workspaces(pair_code);
CREATE INDEX IF NOT EXISTS idx_devices_workspace ON workspace_devices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_workspace_created ON feed_items(workspace_id, created_at DESC);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
