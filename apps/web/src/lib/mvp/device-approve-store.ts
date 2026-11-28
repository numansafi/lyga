import { randomBytes } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase-admin.ts';
import { publishWorkspaceEvent } from './events.ts';

export interface DeviceApprovalRequest {
  id: string;
  workspaceId: string;
  requesterDeviceId: string;
  requesterLabel: string;
  publicKeyB64: string;
  verificationCode: string;
  status: 'pending' | 'approved';
  encryptedPayload?: string;
  expiresAt: number;
}

const APPROVAL_TTL_MS = 5 * 60 * 1000;

const globalStore = globalThis as typeof globalThis & {
  __lygaDeviceApprovals?: Map<string, DeviceApprovalRequest>;
};

function getApprovalMap(): Map<string, DeviceApprovalRequest> {
  if (!globalStore.__lygaDeviceApprovals) {
    globalStore.__lygaDeviceApprovals = new Map();
  }
  return globalStore.__lygaDeviceApprovals;
}

function pruneExpired(now = Date.now()): void {
  const store = getApprovalMap();
  for (const [id, req] of store.entries()) {
    if (req.expiresAt <= now) {
      store.delete(id);
    }
  }
}

export async function createDeviceApproval(
  input: {
    workspaceId: string;
    requesterDeviceId: string;
    requesterLabel: string;
    publicKeyB64: string;
    verificationCode: string;
  },
  now = Date.now()
): Promise<DeviceApprovalRequest> {
  const id = randomBytes(8).toString('hex');
  const expiresAt = now + APPROVAL_TTL_MS;
  const requesterLabel = input.requesterLabel.slice(0, 40) || 'New Browser';
  const entry: DeviceApprovalRequest = {
    id,
    workspaceId: input.workspaceId,
    requesterDeviceId: input.requesterDeviceId,
    requesterLabel,
    publicKeyB64: input.publicKeyB64,
    verificationCode: input.verificationCode,
    status: 'pending',
    expiresAt,
  };

  const supabase = getSupabaseAdmin();
  if (supabase) {
    await supabase.from('device_approval_requests').delete().lt('expires_at', new Date(now).toISOString());
    const { error } = await supabase.from('device_approval_requests').insert({
      id,
      workspace_id: input.workspaceId,
      requester_device_id: input.requesterDeviceId,
      requester_label: requesterLabel,
      public_key_b64: input.publicKeyB64,
      verification_code: input.verificationCode,
      status: 'pending',
      expires_at: new Date(expiresAt).toISOString(),
    });
    if (!error) {
      publishWorkspaceEvent(input.workspaceId);
      return entry;
    }
  }

  pruneExpired(now);
  getApprovalMap().set(id, entry);
  publishWorkspaceEvent(input.workspaceId);
  return entry;
}

export async function listPendingApprovalsForWorkspace(
  workspaceId: string,
  now = Date.now()
): Promise<DeviceApprovalRequest[]> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('device_approval_requests')
      .select(
        'id, workspace_id, requester_device_id, requester_label, public_key_b64, verification_code, status, encrypted_payload, expires_at'
      )
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .gt('expires_at', new Date(now).toISOString());

    if (!error && data) {
      return data.map((row) => ({
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        requesterDeviceId: row.requester_device_id as string,
        requesterLabel: row.requester_label as string,
        publicKeyB64: row.public_key_b64 as string,
        verificationCode: row.verification_code as string,
        status: 'pending',
        encryptedPayload: (row.encrypted_payload as string | null) ?? undefined,
        expiresAt: new Date(row.expires_at as string).getTime(),
      }));
    }
  }

  pruneExpired(now);
  return Array.from(getApprovalMap().values()).filter(
    (r) => r.workspaceId === workspaceId && r.status === 'pending' && r.expiresAt > now
  );
}

export async function approveDeviceRequest(
  workspaceId: string,
  approvalId: string,
  approverDeviceId: string,
  encryptedPayload: string,
  now = Date.now()
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('device_approval_requests')
      .update({
        status: 'approved',
        encrypted_payload: encryptedPayload,
      })
      .eq('id', approvalId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .neq('requester_device_id', approverDeviceId)
      .gt('expires_at', new Date(now).toISOString())
      .select('id')
      .maybeSingle();

    if (!error) {
      if (data) {
        publishWorkspaceEvent(workspaceId);
        return true;
      }
      return false;
    }
  }

  pruneExpired(now);
  const entry = getApprovalMap().get(approvalId);
  if (
    !entry ||
    entry.workspaceId !== workspaceId ||
    entry.status !== 'pending' ||
    entry.requesterDeviceId === approverDeviceId ||
    entry.expiresAt <= now
  ) {
    return false;
  }
  entry.status = 'approved';
  entry.encryptedPayload = encryptedPayload;
  publishWorkspaceEvent(workspaceId);
  return true;
}

export async function claimDeviceApproval(
  workspaceId: string,
  approvalId: string,
  requesterDeviceId: string,
  now = Date.now()
): Promise<DeviceApprovalRequest | null> {
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const nowIso = new Date(now).toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from('device_approval_requests')
      .delete()
      .eq('id', approvalId)
      .eq('workspace_id', workspaceId)
      .eq('requester_device_id', requesterDeviceId)
      .eq('status', 'approved')
      .gt('expires_at', nowIso)
      .select(
        'id, workspace_id, requester_device_id, requester_label, public_key_b64, verification_code, status, encrypted_payload, expires_at'
      )
      .maybeSingle();

    if (!claimErr && claimed) {
      return {
        id: claimed.id as string,
        workspaceId: claimed.workspace_id as string,
        requesterDeviceId: claimed.requester_device_id as string,
        requesterLabel: claimed.requester_label as string,
        publicKeyB64: claimed.public_key_b64 as string,
        verificationCode: claimed.verification_code as string,
        status: 'approved',
        encryptedPayload: (claimed.encrypted_payload as string | null) ?? undefined,
        expiresAt: new Date(claimed.expires_at as string).getTime(),
      };
    }

    const { data, error } = await supabase
      .from('device_approval_requests')
      .select(
        'id, workspace_id, requester_device_id, requester_label, public_key_b64, verification_code, status, encrypted_payload, expires_at'
      )
      .eq('id', approvalId)
      .eq('workspace_id', workspaceId)
      .eq('requester_device_id', requesterDeviceId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (!error) {
      if (!data) return null;
      return {
        id: data.id as string,
        workspaceId: data.workspace_id as string,
        requesterDeviceId: data.requester_device_id as string,
        requesterLabel: data.requester_label as string,
        publicKeyB64: data.public_key_b64 as string,
        verificationCode: data.verification_code as string,
        status: 'pending',
        encryptedPayload: (data.encrypted_payload as string | null) ?? undefined,
        expiresAt: new Date(data.expires_at as string).getTime(),
      };
    }
  }

  pruneExpired(now);
  const entry = getApprovalMap().get(approvalId);
  if (
    !entry ||
    entry.workspaceId !== workspaceId ||
    entry.requesterDeviceId !== requesterDeviceId ||
    entry.expiresAt <= now
  ) {
    return null;
  }
  if (entry.status === 'approved') {
    getApprovalMap().delete(approvalId);
  }
  return entry;
}
