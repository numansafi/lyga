-- Add Stripe billing and plan fields to workspaces

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON workspaces(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription ON workspaces(stripe_subscription_id);
