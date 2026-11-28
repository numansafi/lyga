import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/mvp/api-context';
import { AUTH_COOKIE_NAME, decodeAuthToken } from '@/lib/mvp/auth';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import {
  getOrCreateUserWorkspace,
  getWorkspaceState,
  getWorkspaceWrappedKey,
  saveWorkspaceWrappedKey,
} from '@/lib/mvp/workspace-store';

async function resolveWorkspaceContext(): Promise<
  | { workspaceId: string; newDeviceId?: string }
  | null
> {
  const cookieStore = await cookies();
  const auth = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (session) {
    const state = await getWorkspaceState(session.workspaceId, session.deviceId);
    if (state && (!auth || !state.workspace.user_id || state.workspace.user_id === auth.userId)) {
      return { workspaceId: session.workspaceId };
    }
  }

  if (!auth) return null;

  const created = await getOrCreateUserWorkspace(auth.userId, 'Desktop Browser');
  return {
    workspaceId: created.workspace.id,
    newDeviceId: created.deviceId,
  };
}

export async function GET() {
  try {
    const ctx = await resolveWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const wrappedKey = await getWorkspaceWrappedKey(ctx.workspaceId);
    const res = NextResponse.json({
      workspaceId: ctx.workspaceId,
      hasWrappedKey: Boolean(wrappedKey),
      wrappedKey,
    });
    if (ctx.newDeviceId) {
      setSessionCookie(res, { workspaceId: ctx.workspaceId, deviceId: ctx.newDeviceId });
    }
    return res;
  } catch (err) {
    console.error('[mvp workspace/key GET]', err);
    return NextResponse.json({ error: 'Unable to load workspace key metadata.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await resolveWorkspaceContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      wrappedWmk?: unknown;
      salt?: unknown;
      iv?: unknown;
      iterations?: unknown;
      kind?: unknown;
      fingerprint?: unknown;
    } | null;

    const wrappedWmk = typeof body?.wrappedWmk === 'string' ? body.wrappedWmk.trim() : '';
    const salt = typeof body?.salt === 'string' ? body.salt.trim() : '';
    const iv = typeof body?.iv === 'string' ? body.iv.trim() : '';
    const iterations = typeof body?.iterations === 'number' ? Math.floor(body.iterations) : 0;
    const kind = body?.kind === 'passphrase' ? 'passphrase' : body?.kind === 'password' ? 'password' : null;
    const fingerprint = typeof body?.fingerprint === 'string' ? body.fingerprint.trim() : '';

    if (!wrappedWmk || !salt || !iv || !fingerprint || !kind || iterations < 100_000) {
      return NextResponse.json({ error: 'Invalid wrapped key payload.' }, { status: 400 });
    }

    const saved = await saveWorkspaceWrappedKey(ctx.workspaceId, {
      wrappedWmk,
      salt,
      iv,
      iterations,
      kind,
      fingerprint,
    });

    if (!saved.ok) {
      return NextResponse.json(
        {
          error:
            saved.reason === 'fingerprint_mismatch'
              ? 'This workspace already has a different encryption key. Unlock from a paired device or backup link first.'
              : 'Workspace not found.',
          code: saved.reason,
        },
        { status: saved.reason === 'fingerprint_mismatch' ? 409 : 404 }
      );
    }

    const res = NextResponse.json({ ok: true, workspaceId: ctx.workspaceId, kind });
    if (ctx.newDeviceId) {
      setSessionCookie(res, { workspaceId: ctx.workspaceId, deviceId: ctx.newDeviceId });
    }
    return res;
  } catch (err) {
    console.error('[mvp workspace/key PUT]', err);
    return NextResponse.json({ error: 'Unable to save workspace key.' }, { status: 500 });
  }
}
