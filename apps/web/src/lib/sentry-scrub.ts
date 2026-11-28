/**
 * Scrubs E2EE workspace master key fragments (#wmk=... / #key=... / #k=...) from URLs
 * before any error or breadcrumb leaves the browser for Sentry.
 */
export function scrubE2eeUrl(raw: string): string {
  return raw.replace(/([#&](?:wmk|key|k)=)[^&\s]*/gi, '$1[REDACTED_KEY]');
}

export function scrubSentryEvent<
  T extends {
    message?: string;
    exception?: { values?: Array<{ value?: string }> };
    request?: { url?: string; headers?: Record<string, string> };
    breadcrumbs?: Array<{ data?: Record<string, unknown>; message?: string }>;
  },
>(event: T): T {
  if (typeof event.message === 'string') {
    event.message = scrubE2eeUrl(event.message);
  }
  if (Array.isArray(event.exception?.values)) {
    for (const ex of event.exception.values) {
      if (typeof ex.value === 'string') {
        ex.value = scrubE2eeUrl(ex.value);
      }
    }
  }
  if (event.request?.url) {
    event.request.url = scrubE2eeUrl(event.request.url);
  }
  if (event.request?.headers) {
    delete event.request.headers.cookie;
    delete event.request.headers.authorization;
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === 'string') {
        crumb.message = scrubE2eeUrl(crumb.message);
      }
      if (crumb.data) {
        for (const key of ['url', 'from', 'to'] as const) {
          const val = crumb.data[key];
          if (typeof val === 'string') {
            crumb.data[key] = scrubE2eeUrl(val);
          }
        }
      }
    }
  }
  return event;
}
