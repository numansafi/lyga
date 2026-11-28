import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { setSessionCookie, withWorkspaceSession } from '@/lib/mvp/api-context';
import { AUTH_COOKIE_NAME, decodeAuthToken } from '@/lib/mvp/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import {
  deleteWorkspaceAndAccount,
  getOrCreateUserWorkspace,
  getWorkspaceState,
} from '@/lib/mvp/workspace-store';

function sanitizeWorkspace(workspace: Awaited<ReturnType<typeof getOrCreateUserWorkspace>>['workspace']) {
  const {
    wrapped_wmk,
    wmk_salt: _salt,
    wmk_iv: _iv,
    wmk_kdf_iterations: _iter,
    wmk_wrap_kind,
    wmk_fingerprint: _fp,
    ...rest
  } = workspace;
  return {
    ...rest,
    hasWrappedKey: Boolean(wrapped_wmk),
    wmkWrapKind: wmk_wrap_kind ?? null,
  };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const auth = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSessionToken(token);

    if (session) {
      const state = await getWorkspaceState(session.workspaceId, session.deviceId, after);
      if (state && (!auth || !state.workspace.user_id || state.workspace.user_id === auth.userId)) {
        let userEmail = auth?.email ?? null;
        if (!userEmail && state.workspace.user_id) {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            try {
              const { data } = await supabase.auth.admin.getUserById(state.workspace.user_id);
              userEmail = data.user?.email ?? null;
            } catch {
              userEmail = null;
            }
          }
        }
        return NextResponse.json({
          ...state,
          workspace: sanitizeWorkspace(state.workspace),
          userEmail,
          deviceId: session.deviceId,
        });
      }
      if (!auth) {
        const res = NextResponse.json({ error: 'Device disconnected.' }, { status: 401 });
        res.cookies.delete(SESSION_COOKIE_NAME);
        return res;
      }
    }

    if (!auth) {
      return NextResponse.json(
        { error: 'Please sign in to open your feed.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const result = await getOrCreateUserWorkspace(auth.userId, 'Desktop Browser');
    const res = NextResponse.json({
      workspace: sanitizeWorkspace(result.workspace),
      devices: result.devices,
      items: result.items,
      usedBytes: result.usedBytes,
      userEmail: auth.email,
      deviceId: result.deviceId,
    });

    setSessionCookie(res, {
      workspaceId: result.workspace.id,
      deviceId: result.deviceId,
    });

    return res;
  } catch (err) {
    console.error('[mvp workspace GET]', err);
    return NextResponse.json({ error: 'Unable to load workspace.' }, { status: 500 });
  }
}

export async function DELETE() {
  return withWorkspaceSession(
    'mvp workspace DELETE',
    'Unable to delete account.',
    async ({ session, auth }) => {
      const deleted = await deleteWorkspaceAndAccount(
        session.workspaceId,
        session.deviceId,
        auth?.userId ?? null
      );
      if (!deleted) {
        return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
      }

      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }
  );
}
