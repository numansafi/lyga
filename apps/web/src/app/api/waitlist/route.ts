import { NextResponse } from 'next/server';
import type { WaitlistPlan } from '@/lib/analytics';
import { saveWaitlistSignup, updateWaitlistFeedback } from '@/lib/waitlist-store';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_REGEX.test(email);
}

function isValidPlan(plan: unknown): plan is WaitlistPlan {
  return plan === 'free' || plan === 'pro_founder';
}

async function parseJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (body.plan !== undefined && !isValidPlan(body.plan)) {
      return NextResponse.json({ error: 'Invalid waitlist plan.' }, { status: 400 });
    }

    const plan: WaitlistPlan = isValidPlan(body.plan) ? body.plan : 'free';
    const entry = await saveWaitlistSignup(email, plan);

    return NextResponse.json({ ok: true, entry: { email: entry.email, plan: entry.plan } });
  } catch (err) {
    console.error('[waitlist POST]', err);
    return NextResponse.json({ error: 'Unable to save waitlist signup.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await parseJsonObject(req);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const deviceCombo =
      typeof body.deviceCombo === 'string' ? body.deviceCombo.slice(0, 80) : undefined;
    const painNote =
      typeof body.painNote === 'string' ? body.painNote.slice(0, 300) : undefined;

    await updateWaitlistFeedback(email, deviceCombo, painNote);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[waitlist PATCH]', err);
    return NextResponse.json({ error: 'Unable to update feedback.' }, { status: 500 });
  }
}
