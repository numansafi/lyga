import { cookies } from 'next/headers';
import { subscribeWorkspaceEvents } from '@/lib/mvp/events';
import { decodeSessionToken, SESSION_COOKIE_NAME } from '@/lib/mvp/session';

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const session = decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));

      const unsubscribe = subscribeWorkspaceEvents(session.workspaceId, (evt) => {
        try {
          controller.enqueue(encoder.encode(`event: refresh\ndata: ${JSON.stringify(evt)}\n\n`));
        } catch {
          // stream closed
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          // stream closed
        }
      }, 20000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.signal.addEventListener('abort', () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
