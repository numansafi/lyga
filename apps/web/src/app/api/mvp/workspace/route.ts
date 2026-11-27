import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, decodeAuthToken } from '@/lib/mvp/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  decodeSessionToken,
  encodeSessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/mvp/session';
import {
  deleteWorkspaceAndAccount,
  getOrCreateUserWorkspace,
  getWorkspaceState,
} from '@/lib/mvp/workspace-store';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const auth = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSessionToken(token);

    if (session) {
      const state = await getWorkspaceState(session.workspaceId, session.deviceId);
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
    const newToken = encodeSessionToken({
      workspaceId: result.workspace.id,
      deviceId: result.deviceId,
    });

    const res = NextResponse.json({
      workspace: result.workspace,
      devices: result.devices,
      items: result.items,
      usedBytes: result.usedBytes,
      userEmail: auth.email,
      deviceId: result.deviceId,
    });

    res.cookies.set(SESSION_COOKIE_NAME, newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    console.error('[mvp workspace GET]', err);
    return NextResponse.json({ error: 'Unable to load workspace.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const auth = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

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
  } catch (err) {
    console.error('[mvp workspace DELETE]', err);
    return NextResponse.json({ error: 'Unable to delete account.' }, { status: 500 });
  }
}
