import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, decodeAuthToken } from '@/lib/mvp/auth';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const VALID_CATEGORIES = new Set(['bug', 'idea', 'other']);

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const auth = decodeAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!auth && !session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as {
      category?: unknown;
      message?: unknown;
    } | null;

    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 2000) {
      return NextResponse.json(
        { error: 'Feedback must be between 1 and 2,000 characters.' },
        { status: 400 }
      );
    }

    const category =
      typeof body?.category === 'string' && VALID_CATEGORIES.has(body.category)
        ? body.category
        : 'other';

    const entry = {
      id: crypto.randomUUID(),
      category,
      message,
      email: auth?.email ?? null,
      workspaceId: session?.workspaceId ?? null,
      createdAt: new Date().toISOString(),
    };

    const supabase = getSupabaseAdmin();
    if (supabase && auth?.email) {
      await supabase
        .from('waitlist')
        .update({ pain_note: `[${category}] ${message.slice(0, 500)}` })
        .eq('email', auth.email.toLowerCase())
        .then(() => undefined, () => undefined);
    }

    if (process.env.NODE_ENV !== 'production') {
      const dir = path.join(process.cwd(), '.lyga-dev-data');
      const filePath = path.join(dir, 'feedback.json');
      await mkdir(dir, { recursive: true });
      const existing: unknown[] = await readFile(filePath, 'utf8')
        .then((raw) => JSON.parse(raw) as unknown[])
        .catch(() => [] as unknown[]);
      existing.push(entry);
      await writeFile(filePath, JSON.stringify(existing, null, 2), 'utf8');
    } else {
      console.info('[mvp feedback]', JSON.stringify(entry));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mvp feedback POST]', err);
    return NextResponse.json({ error: 'Unable to send feedback.' }, { status: 500 });
  }
}
