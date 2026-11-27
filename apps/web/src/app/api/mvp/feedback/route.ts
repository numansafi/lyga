import { cookies } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { createJsonFileStore } from '@/lib/local-json-store';
import { AUTH_COOKIE_NAME, decodeAuthToken } from '@/lib/mvp/auth';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const VALID_CATEGORIES = new Set(['bug', 'idea', 'other']);
const localFeedbackStore = createJsonFileStore<unknown[]>({
  filename: 'feedback.json',
  envDirVar: 'LYGA_MVP_DIR',
  defaultValue: () => [],
});

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
      const email = auth.email.toLowerCase();
      after(async () => {
        await supabase
          .from('waitlist')
          .update({ pain_note: `[${category}] ${message.slice(0, 500)}` })
          .eq('email', email)
          .then(() => undefined, () => undefined);
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      await localFeedbackStore.withLock(async () => {
        const existing = await localFeedbackStore.read();
        existing.push(entry);
        await localFeedbackStore.write(existing);
      });
    } else {
      console.info('[mvp feedback]', JSON.stringify(entry));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[mvp feedback POST]', err);
    return NextResponse.json({ error: 'Unable to send feedback.' }, { status: 500 });
  }
}
