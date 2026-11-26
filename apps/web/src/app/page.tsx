'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DmFeedSection } from '@/components/DmFeedSection';
import { HeroSection } from '@/components/HeroSection';
import { LandingHeader } from '@/components/LandingHeader';
import { initAnalytics, trackEvent, type WaitlistPlan } from '@/lib/analytics';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    initAnalytics();
    trackEvent('landing_viewed');
  }, []);

  const goToApp = (source: 'hero' | WaitlistPlan) => {
    trackEvent('cta_clicked', { plan: source });
    router.push('/login');
  };

  return (
    <>
      <LandingHeader onOpenWaitlist={() => goToApp('hero')} />
      <main>
        <HeroSection onOpenWaitlist={() => goToApp('hero')} />
        <DmFeedSection onSelectPlan={(plan) => goToApp(plan)} />
      </main>
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <strong style={{ color: 'var(--text-primary)', letterSpacing: '0.03em' }}>LYGA</strong> ·
        Built for phone and computer · Encrypted in your browser
      </footer>
    </>
  );
}
