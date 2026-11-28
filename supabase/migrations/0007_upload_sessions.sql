-- Persistent upload sessions for multipart ownership binding & cross-instance quota reservations

CREATE TABLE IF NOT EXISTS upload_sessions (
  blob_key TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  upload_id TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  total_parts INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_workspace ON upload_sessions(workspace_id, created_at);

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
