import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, decodeAuthToken, encodeAuthToken } from '@/lib/mvp/auth';
import { SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const cookieStore = await cookies();
  const session = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: session });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      accessToken?: unknown;
      devEmail?: unknown;
    } | null;

    const supabase = getSupabaseAdmin();
    let userId = '';
    let email = '';

    if (supabase) {
      const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
      if (!accessToken) {
        return NextResponse.json({ error: 'Access token is required.' }, { status: 400 });
      }
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (error || !data.user) {
        return NextResponse.json({ error: 'Invalid or expired sign-in session.' }, { status: 401 });
      }
      userId = data.user.id;
      email = data.user.email ?? 'user@lyga.app';
    } else if (process.env.NODE_ENV !== 'production') {
      const rawEmail = typeof body?.devEmail === 'string' ? body.devEmail.trim().toLowerCase() : '';
      if (!rawEmail || !rawEmail.includes('@')) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
      }
      const hash = createHash('sha256').update(rawEmail).digest('hex');
      userId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      email = rawEmail;
    } else {
      return NextResponse.json({ error: 'Auth service unavailable.' }, { status: 500 });
    }

    const token = encodeAuthToken({ userId, email });
    const res = NextResponse.json({ ok: true, user: { userId, email } });
    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    console.error('[auth session POST]', err);
    return NextResponse.json({ error: 'Unable to sign in.' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE_NAME);
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
