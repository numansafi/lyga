import { randomBytes, randomUUID } from 'node:crypto';
import { createJsonFileStore } from '../local-json-store.ts';
import { getSupabaseAdmin } from '../supabase-admin.ts';
import { deleteBlob } from './blob-store.ts';
import {
  FREE_EXPIRY_DAYS,
  FREE_MAX_DEVICES,
  FREE_MAX_FILE_BYTES,
  FREE_MAX_STORAGE_BYTES,
  getWorkspaceLimits,
  type DeviceRecord,
  type FeedItemKind,
  type FeedItemRecord,
  type PlanName,
  type WorkspaceRecord,
} from './constants.ts';
import { PLANS } from '../pricingplan.ts';
import { publishWorkspaceEvent } from './events.ts';

interface UploadSessionRecord {
  blob_key: string;
  workspace_id: string;
  device_id: string;
  upload_id: string;
  size_bytes: number;
  total_parts: number;
  created_at: string;
}

interface LocalMvpData {
  workspaces: WorkspaceRecord[];
  devices: DeviceRecord[];
  items: FeedItemRecord[];
  uploadSessions?: UploadSessionRecord[];
}

const localMvpStore = createJsonFileStore<LocalMvpData>({
  filename: 'mvp.json',
  envDirVar: 'LYGA_MVP_DIR',
  defaultValue: () => ({ workspaces: [], devices: [], items: [] }),
});

const withLocalLock = localMvpStore.withLock;
const readLocalData = localMvpStore.read;
const writeLocalData = localMvpStore.write;

function generatePairCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

function runBackground(task: () => Promise<void>, schedule?: (fn: () => Promise<void>) => void): void {
  if (schedule) {
    schedule(task);
  } else {
    void task().catch(() => undefined);
  }
}

function isExpired(item: FeedItemRecord, nowMs: number): boolean {
  return Boolean(item.expires_at && new Date(item.expires_at).getTime() <= nowMs);
}

export async function createWorkspaceWithDevice(
  deviceLabel = 'Browser',
  userId?: string
): Promise<{ workspace: WorkspaceRecord; device: DeviceRecord }> {
  const now = new Date().toISOString();
  const workspace: WorkspaceRecord = {
    id: randomUUID(),
    ...(userId ? { user_id: userId } : {}),
    pair_code: generatePairCode(),
    max_devices: FREE_MAX_DEVICES,
    storage_limit_bytes: FREE_MAX_STORAGE_BYTES,
    created_at: now,
  };
  const device: DeviceRecord = {
    id: randomUUID(),
    workspace_id: workspace.id,
    label: deviceLabel.slice(0, 40) || 'Browser',
    created_at: now,
    last_seen_at: now,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error: wsErr } = await supabase.from('workspaces').insert(workspace);
    if (wsErr) throw new Error(`Supabase workspace insert error: ${wsErr.message}`);
    const { error: devErr } = await supabase.from('workspace_devices').insert(device);
    if (devErr) throw new Error(`Supabase device insert error: ${devErr.message}`);
    return { workspace, device };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    data.workspaces.push(workspace);
    data.devices.push(device);
    await writeLocalData(data);
    return { workspace, device };
  });
}

export async function getOrCreateUserWorkspace(
  userId: string,
  deviceLabel = 'Desktop Browser'
): Promise<{
  workspace: WorkspaceRecord;
  devices: DeviceRecord[];
  items: FeedItemRecord[];
  usedBytes: number;
  deviceId: string;
}> {
  const supabase = getSupabaseAdmin();
  const label = deviceLabel.slice(0, 40) || 'Desktop Browser';

  if (supabase) {
    const { data: existingWs, error: existingWsErr } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingWsErr) {
      throw new Error(`Supabase workspace lookup error: ${existingWsErr.message}`);
    }

    if (existingWs) {
      const ws = existingWs as WorkspaceRecord;
      const [devsRes, itemsRes] = await Promise.all([
        supabase
          .from('workspace_devices')
          .select('*')
          .eq('workspace_id', ws.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('feed_items')
          .select('*')
          .eq('workspace_id', ws.id)
          .order('created_at', { ascending: false }),
      ]);
      if (devsRes.error) {
        throw new Error(`Supabase devices query error: ${devsRes.error.message}`);
      }
      if (itemsRes.error) {
        throw new Error(`Supabase items query error: ${itemsRes.error.message}`);
      }
      const devList = (devsRes.data ?? []) as DeviceRecord[];
      const matchingDevice = devList.find((d) => d.label === label);
      let activeDevice = matchingDevice ?? devList[0];
      if (!matchingDevice && (!activeDevice || devList.length < ws.max_devices)) {
        const now = new Date().toISOString();
        const created: DeviceRecord = {
          id: randomUUID(),
          workspace_id: ws.id,
          label,
          created_at: now,
          last_seen_at: now,
        };
        const { error: devInsertErr } = await supabase.from('workspace_devices').insert(created);
        if (devInsertErr) {
          throw new Error(`Supabase device insert error: ${devInsertErr.message}`);
        }
        activeDevice = created;
        devList.push(created);
      }
      const nowMs = Date.now();
      const allItems = (itemsRes.data ?? []) as FeedItemRecord[];
      const items = allItems.filter((it) => !isExpired(it, nowMs));
      const usedBytes = items.reduce((sum, it) => sum + Number(it.size_bytes || 0), 0);
      return { workspace: ws, devices: devList, items, usedBytes, deviceId: activeDevice.id };
    }

    const { workspace, device } = await createWorkspaceWithDevice(label, userId);
    return { workspace, devices: [device], items: [], usedBytes: 0, deviceId: device.id };
  }

  const existingId = await withLocalLock(async () => {
    const data = await readLocalData();
    const ws = data.workspaces.find((w) => w.user_id === userId);
    if (!ws) return null;
    let devs = data.devices.filter((d) => d.workspace_id === ws.id);
    const matching = devs.find((d) => d.label === label);
    if (matching) {
      return { workspaceId: ws.id, deviceId: matching.id };
    }
    if (devs.length === 0 || devs.length < ws.max_devices) {
      const now = new Date().toISOString();
      const dev: DeviceRecord = {
        id: randomUUID(),
        workspace_id: ws.id,
        label,
        created_at: now,
        last_seen_at: now,
      };
      data.devices.push(dev);
      await writeLocalData(data);
      return { workspaceId: ws.id, deviceId: dev.id };
    }
    return { workspaceId: ws.id, deviceId: devs[0].id };
  });

  if (existingId) {
    const state = await getWorkspaceState(existingId.workspaceId, existingId.deviceId);
    if (state) {
      return { ...state, deviceId: existingId.deviceId };
    }
  }

  const { workspace, device } = await createWorkspaceWithDevice(label, userId);
  return { workspace, devices: [device], items: [], usedBytes: 0, deviceId: device.id };
}

export async function getWorkspaceState(
  workspaceId: string,
  deviceId: string,
  scheduleCleanup?: (fn: () => Promise<void>) => void
): Promise<{
  workspace: WorkspaceRecord;
  devices: DeviceRecord[];
  items: FeedItemRecord[];
  usedBytes: number;
} | null> {
  const nowMs = Date.now();
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const [wsRes, devRes, itemsRes] = await Promise.all([
      supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
      supabase
        .from('workspace_devices')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('feed_items')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    ]);

    if (wsRes.error) {
      throw new Error(`Supabase workspace query error: ${wsRes.error.message}`);
    }
    if (devRes.error) {
      throw new Error(`Supabase devices query error: ${devRes.error.message}`);
    }
    if (itemsRes.error) {
      throw new Error(`Supabase items query error: ${itemsRes.error.message}`);
    }
    if (!wsRes.data) return null;

    const devList = (devRes.data ?? []) as DeviceRecord[];
    if (!devList.some((d) => d.id === deviceId)) return null;

    const allItems = (itemsRes.data ?? []) as FeedItemRecord[];
    const expiredItems = allItems.filter((it) => isExpired(it, nowMs));
    if (expiredItems.length > 0) {
      const expiredIds = expiredItems.map((it) => it.id);
      const blobKeys = expiredItems.map((it) => it.blob_key).filter((k): k is string => Boolean(k));
      runBackground(async () => {
        await Promise.all([
          ...blobKeys.map((k) => deleteBlob(k).catch(() => undefined)),
          supabase
            .from('feed_items')
            .delete()
            .eq('workspace_id', workspaceId)
            .in('id', expiredIds),
        ]);
      }, scheduleCleanup);
    }

    const items = allItems.filter((it) => !isExpired(it, nowMs));
    const usedBytes = items.reduce((sum, it) => sum + Number(it.size_bytes || 0), 0);

    return { workspace: wsRes.data as WorkspaceRecord, devices: devList, items, usedBytes };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const workspace = data.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return null;

    const devices = data.devices.filter((d) => d.workspace_id === workspaceId);
    if (!devices.some((d) => d.id === deviceId)) return null;

    const expiredItems = data.items.filter(
      (it) => it.workspace_id === workspaceId && isExpired(it, nowMs)
    );
    if (expiredItems.length > 0) {
      for (const exp of expiredItems) {
        if (exp.blob_key) {
          await deleteBlob(exp.blob_key).catch(() => undefined);
        }
      }
      data.items = data.items.filter(
        (it) => it.workspace_id !== workspaceId || !isExpired(it, nowMs)
      );
      await writeLocalData(data);
    }

    const items = data.items
      .filter((it) => it.workspace_id === workspaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const usedBytes = items.reduce((sum, it) => sum + Number(it.size_bytes || 0), 0);

    return { workspace, devices, items, usedBytes };
  });
}

export async function pairDeviceByCode(
  pairCode: string,
  deviceLabel = 'Phone Browser'
): Promise<{ ok: true; workspace: WorkspaceRecord; device: DeviceRecord } | { ok: false; reason: 'not_found' | 'device_limit' }> {
  const code = pairCode.trim().toUpperCase();
  const now = new Date().toISOString();
  const label = deviceLabel.slice(0, 40) || 'Phone Browser';
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('*')
      .eq('pair_code', code)
      .maybeSingle();
    if (wsErr) throw new Error(`Supabase pair workspace lookup error: ${wsErr.message}`);
    if (!ws) return { ok: false, reason: 'not_found' };

    const workspace = ws as WorkspaceRecord;
    const { count, error: countErr } = await supabase
      .from('workspace_devices')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id);
    if (countErr) throw new Error(`Supabase pair device count error: ${countErr.message}`);

    if ((count ?? 0) >= workspace.max_devices) {
      return { ok: false, reason: 'device_limit' };
    }

    const device: DeviceRecord = {
      id: randomUUID(),
      workspace_id: workspace.id,
      label,
      created_at: now,
      last_seen_at: now,
    };
    const { error } = await supabase.from('workspace_devices').insert(device);
    if (error) throw new Error(`Supabase pair error: ${error.message}`);
    publishWorkspaceEvent(workspace.id);
    return { ok: true, workspace, device };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const workspace = data.workspaces.find((w) => w.pair_code === code);
    if (!workspace) return { ok: false, reason: 'not_found' };

    const existingDevices = data.devices.filter((d) => d.workspace_id === workspace.id);
    if (existingDevices.length >= workspace.max_devices) {
      return { ok: false, reason: 'device_limit' };
    }

    const device: DeviceRecord = {
      id: randomUUID(),
      workspace_id: workspace.id,
      label,
      created_at: now,
      last_seen_at: now,
    };
    data.devices.push(device);
    await writeLocalData(data);
    publishWorkspaceEvent(workspace.id);
    return { ok: true, workspace, device };
  });
}

export async function addFeedItem(input: {
  workspaceId: string;
  deviceId: string;
  kind: FeedItemKind;
  encryptedMeta: string;
  encryptedBody: string | null;
  blobKey: string | null;
  sizeBytes: number;
  chunkCount: number;
}): Promise<{ ok: true; item: FeedItemRecord } | { ok: false; reason: 'unauthorized' | 'file_too_large' | 'storage_full' }> {
  const now = new Date();
  const isFileLike = input.kind === 'media' || input.kind === 'file';

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const state = await getWorkspaceState(input.workspaceId, input.deviceId);
    if (!state) return { ok: false, reason: 'unauthorized' };

    const limits = getWorkspaceLimits(state.workspace);
    if (input.sizeBytes > limits.maxFileBytes) {
      return { ok: false, reason: 'file_too_large' };
    }

    if (state.usedBytes + input.sizeBytes > state.workspace.storage_limit_bytes) {
      return { ok: false, reason: 'storage_full' };
    }

    const expiresAt =
      isFileLike && limits.expiryDays !== null
        ? new Date(now.getTime() + limits.expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const item: FeedItemRecord = {
      id: randomUUID(),
      workspace_id: input.workspaceId,
      kind: input.kind,
      encrypted_meta: input.encryptedMeta,
      encrypted_body: input.encryptedBody,
      blob_key: input.blobKey,
      size_bytes: input.sizeBytes,
      chunk_count: input.chunkCount,
      expires_at: expiresAt,
      created_at: now.toISOString(),
    };

    const { error } = await supabase.from('feed_items').insert(item);
    if (error) throw new Error(`Supabase item insert error: ${error.message}`);
    publishWorkspaceEvent(input.workspaceId);
    return { ok: true, item };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const ws = data.workspaces.find((w) => w.id === input.workspaceId);
    const dev = data.devices.find(
      (d) => d.id === input.deviceId && d.workspace_id === input.workspaceId
    );
    if (!ws || !dev) return { ok: false, reason: 'unauthorized' };

    const limits = getWorkspaceLimits(ws);
    if (input.sizeBytes > limits.maxFileBytes) {
      return { ok: false, reason: 'file_too_large' };
    }

    const expiresAt =
      isFileLike && limits.expiryDays !== null
        ? new Date(now.getTime() + limits.expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const item: FeedItemRecord = {
      id: randomUUID(),
      workspace_id: input.workspaceId,
      kind: input.kind,
      encrypted_meta: input.encryptedMeta,
      encrypted_body: input.encryptedBody,
      blob_key: input.blobKey,
      size_bytes: input.sizeBytes,
      chunk_count: input.chunkCount,
      expires_at: expiresAt,
      created_at: now.toISOString(),
    };

    const nowMs = Date.now();
    const usedBytes = data.items
      .filter(
        (it) =>
          it.workspace_id === input.workspaceId &&
          (!it.expires_at || Date.parse(it.expires_at) > nowMs)
      )
      .reduce((acc, it) => acc + Number(it.size_bytes || 0), 0);

    if (usedBytes + input.sizeBytes > ws.storage_limit_bytes) {
      return { ok: false, reason: 'storage_full' };
    }

    data.items.push(item);
    await writeLocalData(data);
    publishWorkspaceEvent(input.workspaceId);
    return { ok: true, item };
  });
}

export async function removeFeedItem(
  workspaceId: string,
  deviceId: string,
  itemId: string
): Promise<boolean> {
  const state = await getWorkspaceState(workspaceId, deviceId);
  if (!state) return false;

  const target = state.items.find((it) => it.id === itemId);
  if (!target) return false;

  if (target.blob_key) {
    await deleteBlob(target.blob_key).catch(() => undefined);
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from('feed_items')
      .delete()
      .eq('id', itemId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Supabase item delete error: ${error.message}`);
    publishWorkspaceEvent(workspaceId);
    return true;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    data.items = data.items.filter((it) => !(it.id === itemId && it.workspace_id === workspaceId));
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return true;
  });
}

export async function updateFeedItem(input: {
  workspaceId: string;
  deviceId: string;
  itemId: string;
  kind: FeedItemKind;
  encryptedMeta: string;
  encryptedBody: string | null;
}): Promise<FeedItemRecord | null> {
  const state = await getWorkspaceState(input.workspaceId, input.deviceId);
  if (!state) return null;

  const target = state.items.find((it) => it.id === input.itemId);
  if (!target) return null;

  const updated: FeedItemRecord = {
    ...target,
    kind: input.kind,
    encrypted_meta: input.encryptedMeta,
    encrypted_body: input.encryptedBody,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from('feed_items')
      .update({
        kind: updated.kind,
        encrypted_meta: updated.encrypted_meta,
        encrypted_body: updated.encrypted_body,
      })
      .eq('id', input.itemId)
      .eq('workspace_id', input.workspaceId);
    if (error) throw new Error(`Supabase item update error: ${error.message}`);
    publishWorkspaceEvent(input.workspaceId);
    return updated;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    data.items = data.items.map((it) =>
      it.id === input.itemId && it.workspace_id === input.workspaceId ? updated : it
    );
    await writeLocalData(data);
    publishWorkspaceEvent(input.workspaceId);
    return updated;
  });
}

export async function removeWorkspaceDevice(
  workspaceId: string,
  requesterDeviceId: string,
  targetDeviceId: string
): Promise<{ ok: true } | { ok: false; reason: 'unauthorized' | 'not_found' | 'last_device' }> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const state = await getWorkspaceState(workspaceId, requesterDeviceId);
    if (!state) return { ok: false, reason: 'unauthorized' };

    if (!state.devices.some((d) => d.id === targetDeviceId)) {
      return { ok: false, reason: 'not_found' };
    }

    if (state.devices.length <= 1) {
      return { ok: false, reason: 'last_device' };
    }

    const { error } = await supabase
      .from('workspace_devices')
      .delete()
      .eq('id', targetDeviceId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Supabase device delete error: ${error.message}`);
    publishWorkspaceEvent(workspaceId);
    return { ok: true };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const wsDevices = data.devices.filter((d) => d.workspace_id === workspaceId);
    if (!wsDevices.some((d) => d.id === requesterDeviceId)) {
      return { ok: false, reason: 'unauthorized' };
    }
    if (!wsDevices.some((d) => d.id === targetDeviceId)) {
      return { ok: false, reason: 'not_found' };
    }
    if (wsDevices.length <= 1) {
      return { ok: false, reason: 'last_device' };
    }

    data.devices = data.devices.filter(
      (d) => !(d.id === targetDeviceId && d.workspace_id === workspaceId)
    );
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return { ok: true };
  });
}

export async function renameWorkspaceDevice(
  workspaceId: string,
  requesterDeviceId: string,
  targetDeviceId: string,
  rawLabel: string
): Promise<{ ok: true; label: string } | { ok: false; reason: 'unauthorized' | 'not_found' | 'invalid' }> {
  const label = rawLabel.trim().slice(0, 32);
  if (!label) return { ok: false, reason: 'invalid' };

  const state = await getWorkspaceState(workspaceId, requesterDeviceId);
  if (!state) return { ok: false, reason: 'unauthorized' };

  if (!state.devices.some((d) => d.id === targetDeviceId)) {
    return { ok: false, reason: 'not_found' };
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase
      .from('workspace_devices')
      .update({ label })
      .eq('id', targetDeviceId)
      .eq('workspace_id', workspaceId);
    if (error) throw new Error(`Supabase device rename error: ${error.message}`);
    publishWorkspaceEvent(workspaceId);
    return { ok: true, label };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const target = data.devices.find(
      (d) => d.id === targetDeviceId && d.workspace_id === workspaceId
    );
    if (!target) return { ok: false, reason: 'not_found' as const };
    target.label = label;
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return { ok: true, label };
  });
}

/** Delete all items and blobs in a workspace while keeping the workspace and paired devices. */
export async function clearWorkspaceFeed(
  workspaceId: string,
  deviceId: string
): Promise<boolean> {
  const state = await getWorkspaceState(workspaceId, deviceId);
  if (!state) return false;

  const clearBlobKeys = state.items
    .map((it) => it.blob_key)
    .filter((k): k is string => Boolean(k));
  if (clearBlobKeys.length > 0) {
    await Promise.allSettled(clearBlobKeys.map((k) => deleteBlob(k)));
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from('feed_items').delete().eq('workspace_id', workspaceId);
    if (error) throw new Error(`Supabase clear feed error: ${error.message}`);
    publishWorkspaceEvent(workspaceId);
    return true;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    data.items = data.items.filter((it) => it.workspace_id !== workspaceId);
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return true;
  });
}

/** Permanently delete a workspace, all its items/blobs/devices, and optionally the Supabase Auth user. */
export async function deleteWorkspaceAndAccount(
  workspaceId: string,
  deviceId: string,
  userId?: string | null
): Promise<boolean> {
  const state = await getWorkspaceState(workspaceId, deviceId);
  if (!state) return false;

  const blobKeys = state.items.map((it) => it.blob_key).filter((k): k is string => Boolean(k));
  if (blobKeys.length > 0) {
    await Promise.all(blobKeys.map((k) => deleteBlob(k).catch(() => undefined)));
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
    if (error) throw new Error(`Supabase workspace delete error: ${error.message}`);
    const uid = userId || state.workspace.user_id;
    if (uid) {
      await supabase.auth.admin.deleteUser(uid).catch(() => undefined);
    }
    publishWorkspaceEvent(workspaceId);
    return true;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    data.items = data.items.filter((it) => it.workspace_id !== workspaceId);
    data.devices = data.devices.filter((d) => d.workspace_id !== workspaceId);
    data.workspaces = data.workspaces.filter((w) => w.id !== workspaceId);
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return true;
  });
}

const MAX_CONCURRENT_MULTIPART_UPLOADS = 3;
const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

export async function reserveUploadQuota(
  workspaceId: string,
  deviceId: string,
  blobKey: string,
  uploadId: string,
  sizeBytes: number,
  totalParts: number
): Promise<
  | { ok: true }
  | { ok: false; reason: 'unauthorized' | 'file_too_large' | 'storage_full' | 'too_many_uploads' }
> {
  if (sizeBytes <= 0) {
    return { ok: false, reason: 'file_too_large' };
  }

  const cutoffIso = new Date(Date.now() - RESERVATION_TTL_MS).toISOString();
  const nowIso = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const state = await getWorkspaceState(workspaceId, deviceId);
    if (!state) return { ok: false, reason: 'unauthorized' };

    const limits = getWorkspaceLimits(state.workspace);
    if (sizeBytes > limits.maxFileBytes) {
      return { ok: false, reason: 'file_too_large' };
    }

    await supabase
      .from('upload_sessions')
      .delete()
      .eq('workspace_id', workspaceId)
      .lt('created_at', cutoffIso);

    const { data: activeSessions, error: sessErr } = await supabase
      .from('upload_sessions')
      .select('size_bytes')
      .eq('workspace_id', workspaceId);
    if (sessErr) throw new Error(`Supabase upload session lookup error: ${sessErr.message}`);

    const active = (activeSessions ?? []) as Array<{ size_bytes: number }>;
    if (active.length >= MAX_CONCURRENT_MULTIPART_UPLOADS) {
      return { ok: false, reason: 'too_many_uploads' };
    }

    const reserved = active.reduce((sum, s) => sum + Number(s.size_bytes || 0), 0);
    if (state.usedBytes + reserved + sizeBytes > state.workspace.storage_limit_bytes) {
      return { ok: false, reason: 'storage_full' };
    }

    const { error: insErr } = await supabase.from('upload_sessions').insert({
      blob_key: blobKey,
      workspace_id: workspaceId,
      device_id: deviceId,
      upload_id: uploadId,
      size_bytes: sizeBytes,
      total_parts: totalParts,
      created_at: nowIso,
    });
    if (insErr) throw new Error(`Supabase upload session insert error: ${insErr.message}`);
    return { ok: true };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const ws = data.workspaces.find((w) => w.id === workspaceId);
    const dev = data.devices.find(
      (d) => d.id === deviceId && d.workspace_id === workspaceId
    );
    if (!ws || !dev) return { ok: false, reason: 'unauthorized' };

    const limits = getWorkspaceLimits(ws);
    if (sizeBytes > limits.maxFileBytes) {
      return { ok: false, reason: 'file_too_large' };
    }

    const cutoffMs = Date.now() - RESERVATION_TTL_MS;
    const allSessions = (data.uploadSessions ?? []).filter(
      (s) => Date.parse(s.created_at) >= cutoffMs
    );
    const wsSessions = allSessions.filter((s) => s.workspace_id === workspaceId);
    if (wsSessions.length >= MAX_CONCURRENT_MULTIPART_UPLOADS) {
      return { ok: false, reason: 'too_many_uploads' };
    }

    const nowMs = Date.now();
    const usedBytes = data.items
      .filter(
        (it) =>
          it.workspace_id === workspaceId &&
          (!it.expires_at || Date.parse(it.expires_at) > nowMs)
      )
      .reduce((sum, it) => sum + it.size_bytes, 0);
    const reserved = wsSessions.reduce((sum, s) => sum + s.size_bytes, 0);

    if (usedBytes + reserved + sizeBytes > ws.storage_limit_bytes) {
      return { ok: false, reason: 'storage_full' };
    }

    allSessions.push({
      blob_key: blobKey,
      workspace_id: workspaceId,
      device_id: deviceId,
      upload_id: uploadId,
      size_bytes: sizeBytes,
      total_parts: totalParts,
      created_at: nowIso,
    });
    data.uploadSessions = allSessions;
    await writeLocalData(data);
    return { ok: true };
  });
}

export async function verifyUploadSession(
  workspaceId: string,
  blobKey: string,
  uploadId: string
): Promise<{ ok: true; totalParts: number } | { ok: false }> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('upload_sessions')
      .select('total_parts, upload_id')
      .eq('blob_key', blobKey)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (error || !data) return { ok: false };
    const row = data as { total_parts: number; upload_id: string };
    if (row.upload_id !== uploadId) return { ok: false };
    return { ok: true, totalParts: row.total_parts };
  }

  const data = await readLocalData();
  const row = (data.uploadSessions ?? []).find(
    (s) =>
      s.blob_key === blobKey &&
      s.workspace_id === workspaceId &&
      s.upload_id === uploadId
  );
  if (!row) return { ok: false };
  return { ok: true, totalParts: row.total_parts };
}

export async function releaseUploadQuota(
  workspaceId: string,
  blobKey: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase
      .from('upload_sessions')
      .delete()
      .eq('blob_key', blobKey)
      .eq('workspace_id', workspaceId);
    return;
  }

  await withLocalLock(async () => {
    const data = await readLocalData();
    if (!data.uploadSessions) return;
    data.uploadSessions = data.uploadSessions.filter(
      (s) => !(s.blob_key === blobKey && s.workspace_id === workspaceId)
    );
    await writeLocalData(data);
  });
}

export async function setWorkspacePlan(
  workspaceId: string,
  input: {
    plan: PlanName;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
  }
): Promise<boolean> {
  const tier = input.plan === 'pro' ? PLANS.pro : PLANS.free;
  const patch: Partial<WorkspaceRecord> = {
    plan: input.plan,
    max_devices: tier.maxDevices,
    storage_limit_bytes: tier.maxStorageBytes,
    ...(input.stripeCustomerId !== undefined
      ? { stripe_customer_id: input.stripeCustomerId }
      : {}),
    ...(input.stripeSubscriptionId !== undefined
      ? { stripe_subscription_id: input.stripeSubscriptionId }
      : {}),
    ...(input.subscriptionStatus !== undefined
      ? { subscription_status: input.subscriptionStatus }
      : {}),
    ...(input.currentPeriodEnd !== undefined
      ? { current_period_end: input.currentPeriodEnd }
      : {}),
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', workspaceId)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Supabase plan update error: ${error.message}`);
    if (!data) return false;
    publishWorkspaceEvent(workspaceId);
    return true;
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const ws = data.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return false;
    Object.assign(ws, patch);
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return true;
  });
}

export async function findWorkspaceByStripeCustomerId(
  customerId: string
): Promise<WorkspaceRecord | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('stripe_customer_id', customerId)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase customer lookup error: ${error.message}`);
    return (data as WorkspaceRecord | null) ?? null;
  }

  const data = await readLocalData();
  return data.workspaces.find((w) => w.stripe_customer_id === customerId) ?? null;
}

export interface WorkspaceWrappedKeyRow {
  wrappedWmk: string;
  salt: string;
  iv: string;
  iterations: number;
  kind: 'password' | 'passphrase';
  fingerprint: string;
}

export async function getWorkspaceWrappedKey(
  workspaceId: string
): Promise<WorkspaceWrappedKeyRow | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('wrapped_wmk, wmk_salt, wmk_iv, wmk_kdf_iterations, wmk_wrap_kind, wmk_fingerprint')
      .eq('id', workspaceId)
      .maybeSingle();
    if (error) throw new Error(`Supabase wrapped key lookup error: ${error.message}`);
    const row = data as Partial<WorkspaceRecord> | null;
    if (!row?.wrapped_wmk || !row.wmk_salt || !row.wmk_iv || !row.wmk_kdf_iterations) {
      return null;
    }
    return {
      wrappedWmk: row.wrapped_wmk,
      salt: row.wmk_salt,
      iv: row.wmk_iv,
      iterations: row.wmk_kdf_iterations,
      kind: 'password',
      fingerprint: row.wmk_fingerprint ?? '',
    };
  }

  const data = await readLocalData();
  const ws = data.workspaces.find((w) => w.id === workspaceId);
  if (!ws?.wrapped_wmk || !ws.wmk_salt || !ws.wmk_iv || !ws.wmk_kdf_iterations) {
    return null;
  }
  return {
    wrappedWmk: ws.wrapped_wmk,
    salt: ws.wmk_salt,
    iv: ws.wmk_iv,
    iterations: ws.wmk_kdf_iterations,
    kind: 'password',
    fingerprint: ws.wmk_fingerprint ?? '',
  };
}

export async function saveWorkspaceWrappedKey(
  workspaceId: string,
  input: WorkspaceWrappedKeyRow
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'fingerprint_mismatch' }> {
  const patch: Partial<WorkspaceRecord> = {
    wrapped_wmk: input.wrappedWmk,
    wmk_salt: input.salt,
    wmk_iv: input.iv,
    wmk_kdf_iterations: input.iterations,
    wmk_wrap_kind: input.kind,
    wmk_fingerprint: input.fingerprint,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data: existing, error: fetchErr } = await supabase
      .from('workspaces')
      .select('id, wrapped_wmk, wmk_fingerprint')
      .eq('id', workspaceId)
      .maybeSingle();
    if (fetchErr) throw new Error(`Supabase wrapped key read error: ${fetchErr.message}`);
    if (!existing) return { ok: false, reason: 'not_found' };
    const row = existing as Pick<WorkspaceRecord, 'id' | 'wrapped_wmk' | 'wmk_fingerprint'>;
    if (row.wrapped_wmk && row.wmk_fingerprint && row.wmk_fingerprint !== input.fingerprint) {
      return { ok: false, reason: 'fingerprint_mismatch' };
    }
    const { error: updateErr } = await supabase
      .from('workspaces')
      .update(patch)
      .eq('id', workspaceId);
    if (updateErr) throw new Error(`Supabase wrapped key update error: ${updateErr.message}`);
    publishWorkspaceEvent(workspaceId);
    return { ok: true };
  }

  return withLocalLock(async () => {
    const data = await readLocalData();
    const ws = data.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return { ok: false, reason: 'not_found' };
    if (ws.wrapped_wmk && ws.wmk_fingerprint && ws.wmk_fingerprint !== input.fingerprint) {
      return { ok: false, reason: 'fingerprint_mismatch' };
    }
    Object.assign(ws, patch);
    await writeLocalData(data);
    publishWorkspaceEvent(workspaceId);
    return { ok: true };
  });
}
