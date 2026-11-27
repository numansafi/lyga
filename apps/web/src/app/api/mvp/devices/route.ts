import { NextResponse } from 'next/server';
import { mapStoreError, withWorkspaceSession } from '@/lib/mvp/api-context';
import { removeWorkspaceDevice, renameWorkspaceDevice } from '@/lib/mvp/workspace-store';

export async function PATCH(req: Request) {
  return withWorkspaceSession('mvp devices PATCH', 'Unable to rename device.', async ({ session }) => {
    const body = (await req.json().catch(() => null)) as {
      id?: unknown;
      label?: unknown;
    } | null;

    const targetDeviceId =
      typeof body?.id === 'string' && body.id.trim() ? body.id.trim() : session.deviceId;
    const label = typeof body?.label === 'string' ? body.label : '';

    const result = await renameWorkspaceDevice(
      session.workspaceId,
      session.deviceId,
      targetDeviceId,
      label
    );
    if (!result.ok) {
      return mapStoreError(result.reason, {
        invalid: 'Device name is required.',
        not_found: 'Device not found.',
      });
    }

    return NextResponse.json({ ok: true, label: result.label });
  });
}

export async function DELETE(req: Request) {
  return withWorkspaceSession('mvp devices DELETE', 'Unable to remove device.', async ({ session }) => {
    const targetDeviceId = new URL(req.url).searchParams.get('id')?.trim() ?? '';
    if (!targetDeviceId) {
      return NextResponse.json({ error: 'Device ID is required.' }, { status: 400 });
    }

    const result = await removeWorkspaceDevice(
      session.workspaceId,
      session.deviceId,
      targetDeviceId
    );
    if (!result.ok) {
      return mapStoreError(result.reason, { not_found: 'Device not found.' });
    }

    return NextResponse.json({ ok: true });
  });
}
