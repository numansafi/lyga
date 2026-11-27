'use client';

type PostHogClient = typeof import('posthog-js').default;

let posthogPromise: Promise<PostHogClient | null> | null = null;
let initialized = false;

export type WaitlistPlan = 'free' | 'pro_founder';

async function loadPostHog(): Promise<PostHogClient | null> {
  if (typeof window === 'undefined') return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!posthogPromise) {
    posthogPromise = import('posthog-js')
      .then((mod) => {
        const ph = mod.default;
        if (!initialized) {
          ph.init(key, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
            capture_pageview: false,
            persistence: 'localStorage',
          });
          initialized = true;
        }
        return ph;
      })
      .catch(() => null);
  }
  return posthogPromise;
}

export function initAnalytics(): void {
  void loadPostHog();
}

export function trackEvent(
  eventName:
    | 'landing_viewed'
    | 'cta_clicked'
    | 'waitlist_submitted'
    | 'device_combo_selected',
  properties?: Record<string, string>
): void {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  void loadPostHog().then((ph) => {
    ph?.capture(eventName, properties);
  });
}
