import { PLANS } from '../pricingplan.ts';

export const FREE_MAX_FILE_BYTES = PLANS.free.maxFileBytes;
export const FREE_MAX_STORAGE_BYTES = PLANS.free.maxStorageBytes;
export const FREE_MAX_DEVICES = PLANS.free.maxDevices;
export const FREE_EXPIRY_DAYS = PLANS.free.expiryDays;
export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB chunks (format v1)
export const MULTIPART_PART_PLAIN_BYTES = 16 * 1024 * 1024; // 16 MiB per frame/part (format v2)
export const MULTIPART_FRAME_OVERHEAD_BYTES = 4 + 12 + 16; // 4B len + 12B IV + 16B GCM tag
export const MULTIPART_PART_WIRE_BYTES = MULTIPART_PART_PLAIN_BYTES + MULTIPART_FRAME_OVERHEAD_BYTES;
export const MULTIPART_THRESHOLD_BYTES = MULTIPART_PART_PLAIN_BYTES;

export type FeedItemKind = 'text' | 'link' | 'code' | 'media' | 'file';
export type PlanName = 'free' | 'pro';

export interface WorkspaceRecord {
  id: string;
  user_id?: string | null;
  pair_code: string;
  plan?: PlanName;
  max_devices: number;
  storage_limit_bytes: number;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  created_at: string;
}

export function getWorkspaceLimits(
  workspace?: Pick<WorkspaceRecord, 'plan' | 'storage_limit_bytes' | 'max_devices'> | null
) {
  const isPro = workspace?.plan === 'pro';
  const tier = isPro ? PLANS.pro : PLANS.free;
  return {
    plan: (isPro ? 'pro' : 'free') as PlanName,
    maxFileBytes: tier.maxFileBytes,
    maxStorageBytes: workspace?.storage_limit_bytes ?? tier.maxStorageBytes,
    maxDevices: workspace?.max_devices ?? tier.maxDevices,
    expiryDays: tier.expiryDays,
  };
}

export interface DeviceRecord {
  id: string;
  workspace_id: string;
  label: string;
  created_at: string;
  last_seen_at: string;
}

export interface FeedItemRecord {
  id: string;
  workspace_id: string;
  kind: FeedItemKind;
  encrypted_meta: string;
  encrypted_body: string | null;
  blob_key: string | null;
  size_bytes: number;
  chunk_count: number;
  expires_at: string | null;
  created_at: string;
}
