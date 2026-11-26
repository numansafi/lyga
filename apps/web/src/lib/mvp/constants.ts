export const FREE_MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB per file
export const FREE_MAX_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB active storage
export const FREE_MAX_DEVICES = 2;
export const FREE_EXPIRY_DAYS = 7;
export const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB chunks

export type FeedItemKind = 'text' | 'link' | 'code' | 'media' | 'file';

export interface WorkspaceRecord {
  id: string;
  pair_code: string;
  max_devices: number;
  storage_limit_bytes: number;
  created_at: string;
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
