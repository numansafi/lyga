import { NextResponse } from 'next/server';
import { withWorkspaceSession } from '@/lib/mvp/api-context';
import {
  approveDeviceRequest,
  claimDeviceApproval,
  createDeviceApproval,
  listPendingApprovalsForWorkspace,
} from '@/lib/mvp/device-approve-store';
import { getWorkspaceState } from '@/lib/mvp/workspace-store';

export async function GET(req: Request) {
  return withWorkspaceSession(
    'mvp device-approve GET',
    'Unable to load device approval requests.',
    async ({ session }) => {
      const { workspaceId, deviceId } = session;
      const state = await getWorkspaceState(workspaceId, deviceId);
      if (!state) {
        return NextResponse.json(
          { error: 'This device was disconnected.', code: 'DEVICE_DISCONNECTED' },
          { status: 401 }
        );
      }
      const url = new URL(req.url);
      const id = url.searchParams.get('id')?.trim();

      if (id) {
        const entry = await claimDeviceApproval(workspaceId, id, deviceId);
        if (!entry) {
          return NextResponse.json({ status: 'expired' });
        }
        if (entry.status === 'approved' && entry.encryptedPayload) {
          return NextResponse.json({
            status: 'approved',
            encryptedPayload: entry.encryptedPayload,
          });
        }
        return NextResponse.json({ status: 'pending' });
      }

      const pending = (await listPendingApprovalsForWorkspace(workspaceId))
        .filter((r) => r.requesterDeviceId !== deviceId)
        .map((r) => ({
          id: r.id,
          requesterLabel: r.requesterLabel,
          publicKeyB64: r.publicKeyB64,
          verificationCode: r.verificationCode,
          expiresAt: r.expiresAt,
        }));
      return NextResponse.json({ pending });
    }
  );
}

export async function POST(req: Request) {
  return withWorkspaceSession(
    'mvp device-approve POST',
    'Unable to create device approval request.',
    async ({ session }) => {
      const { workspaceId, deviceId } = session;
      const state = await getWorkspaceState(workspaceId, deviceId);
      if (!state) {
        return NextResponse.json(
          { error: 'This device was disconnected.', code: 'DEVICE_DISCONNECTED' },
          { status: 401 }
        );
      }
      const body = (await req.json().catch(() => null)) as {
        publicKeyB64?: unknown;
        verificationCode?: unknown;
        label?: unknown;
      } | null;
      const publicKeyB64 = typeof body?.publicKeyB64 === 'string' ? body.publicKeyB64.trim() : '';
      const verificationCode =
        typeof body?.verificationCode === 'string' ? body.verificationCode.trim() : '';
      const requesterLabel = typeof body?.label === 'string' ? body.label.trim() : 'New Browser';

      if (!publicKeyB64 || publicKeyB64.length > 256 || !/^\d{4}$/.test(verificationCode)) {
        return NextResponse.json({ error: 'Invalid approval request.' }, { status: 400 });
      }

      const entry = await createDeviceApproval({
        workspaceId,
        requesterDeviceId: deviceId,
        requesterLabel,
        publicKeyB64,
        verificationCode,
      });
      return NextResponse.json({
        id: entry.id,
        expiresAt: entry.expiresAt,
      });
    }
  );
}

export async function PATCH(req: Request) {
  return withWorkspaceSession(
    'mvp device-approve PATCH',
    'Unable to approve device request.',
    async ({ session }) => {
      const { workspaceId, deviceId } = session;
      const state = await getWorkspaceState(workspaceId, deviceId);
      if (!state) {
        return NextResponse.json(
          { error: 'This device was disconnected.', code: 'DEVICE_DISCONNECTED' },
          { status: 401 }
        );
      }
      const body = (await req.json().catch(() => null)) as {
        id?: unknown;
        encryptedPayload?: unknown;
      } | null;
      const id = typeof body?.id === 'string' ? body.id.trim() : '';
      const encryptedPayload =
        typeof body?.encryptedPayload === 'string' ? body.encryptedPayload.trim() : '';

      if (!id || !encryptedPayload || encryptedPayload.length > 4096) {
        return NextResponse.json({ error: 'Invalid approval payload.' }, { status: 400 });
      }

      const ok = await approveDeviceRequest(workspaceId, id, deviceId, encryptedPayload);
      if (!ok) {
        return NextResponse.json({ error: 'Approval request expired or not found.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
  );
}
