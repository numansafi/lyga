-- Add zero-knowledge wrapped workspace key metadata to workspaces
alter table public.workspaces
  add column if not exists wrapped_wmk text,
  add column if not exists wmk_salt text,
  add column if not exists wmk_iv text,
  add column if not exists wmk_kdf_iterations integer,
  add column if not exists wmk_wrap_kind text,
  add column if not exists wmk_fingerprint text;
