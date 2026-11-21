'use client';

import { useEffect, useState } from 'react';
import { ComparisonSection } from '@/components/ComparisonSection';
import { FaqSection } from '@/components/FaqSection';
import { HeroSection } from '@/components/HeroSection';
import { HighlightsSection } from '@/components/HighlightsSection';
import { LandingHeader } from '@/components/LandingHeader';
import { PricingSection } from '@/components/PricingSection';
import { WaitlistModal } from '@/components/WaitlistModal';
import { initAnalytics, trackEvent, type WaitlistPlan } from '@/lib/analytics';

export default function HomePage() {
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WaitlistPlan>('free');

  useEffect(() => {
    initAnalytics();
    trackEvent('landing_viewed');
  }, []);

  const openWaitlist = (plan: WaitlistPlan, source: 'hero' | 'free' | 'pro_founder') => {
    setSelectedPlan(plan);
    setModalOpened(true);
    trackEvent('cta_clicked', { plan: source });
  };

  return (
    <>
      <LandingHeader onOpenWaitlist={() => openWaitlist('free', 'hero')} />
      <main>
        <HeroSection />
        <HighlightsSection />
        <ComparisonSection />
        <PricingSection
          onSelectPlan={(plan) => openWaitlist(plan, plan)}
        />
        <FaqSection />
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
        Built for iPhone + Windows · Encrypted in your browser
      </footer>
      <WaitlistModal
        opened={modalOpened}
        plan={selectedPlan}
        onClose={() => setModalOpened(false)}
      />
    </>
  );
}
