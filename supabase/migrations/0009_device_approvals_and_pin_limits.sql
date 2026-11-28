-- Persist ephemeral 1-tap ECDH device approval requests and Sync PIN rate-limit buckets
-- across serverless instances.

create table if not exists public.device_approval_requests (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requester_device_id text not null,
  requester_label text not null,
  public_key_b64 text not null,
  verification_code text not null,
  status text not null default 'pending',
  encrypted_payload text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists device_approval_requests_ws_idx
  on public.device_approval_requests (workspace_id, status, expires_at);

alter table public.device_approval_requests enable row level security;

create table if not exists public.sync_pin_attempts (
  bucket_key text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.sync_pin_attempts enable row level security;
