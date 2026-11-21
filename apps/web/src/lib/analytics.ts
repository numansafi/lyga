'use client';

import posthog from 'posthog-js';

let initialized = false;

export type WaitlistPlan = 'free' | 'pro_founder';

export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: false,
    persistence: 'localStorage',
  });
  initialized = true;
}

export function trackEvent(
  eventName:
    | 'landing_viewed'
    | 'cta_clicked'
    | 'waitlist_submitted'
    | 'device_combo_selected',
  properties?: Record<string, string>
): void {
  if (typeof window === 'undefined') return;
  if (!initialized) initAnalytics();
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(eventName, properties);
}
