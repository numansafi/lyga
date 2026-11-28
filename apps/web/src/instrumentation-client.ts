import * as Sentry from '@sentry/nextjs';
import { scrubE2eeUrl, scrubSentryEvent } from '@/lib/sentry-scrub';

const dsn =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://b932a6aa37ac1f18848424c5d6ece1c2@o4512506655735808.ingest.de.sentry.io/4512506661503056';

Sentry.init({
  dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    if (typeof breadcrumb.message === 'string') {
      breadcrumb.message = scrubE2eeUrl(breadcrumb.message);
    }
    if (breadcrumb.data) {
      for (const key of ['url', 'from', 'to'] as const) {
        if (typeof breadcrumb.data[key] === 'string') {
          breadcrumb.data[key] = scrubE2eeUrl(breadcrumb.data[key]);
        }
      }
    }
    return breadcrumb;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
