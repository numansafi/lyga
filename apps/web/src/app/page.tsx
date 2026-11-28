'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DmFeedSection } from '@/components/DmFeedSection';
import feedStyles from '@/components/DmFeedSection.module.css';
import { HeroSection } from '@/components/HeroSection';
import { LandingHeader } from '@/components/LandingHeader';
import { initAnalytics, trackEvent, type PlanTier } from '@/lib/analytics';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    initAnalytics();
    trackEvent('landing_viewed');
  }, []);

  const goToApp = (source: 'hero' | PlanTier) => {
    trackEvent('cta_clicked', { plan: source });
    router.push(source === 'free' || source === 'pro' ? `/login?plan=${source}` : '/login');
  };

  return (
    <>
      <LandingHeader onGetStarted={() => goToApp('hero')} />
      <main>
        <HeroSection onGetStarted={() => goToApp('hero')} />
        <DmFeedSection onSelectPlan={(plan) => goToApp(plan)} />
      </main>
      <footer className={feedStyles.siteFooter}>
        <strong className={feedStyles.siteFooterBrand}>LYGA</strong> · Built for phone and
        computer · Encrypted in your browser ·{' '}
        <Link href="/privacy" className={feedStyles.siteFooterLink}>
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className={feedStyles.siteFooterLink}>
          Terms
        </Link>
      </footer>
    </>
  );
}
