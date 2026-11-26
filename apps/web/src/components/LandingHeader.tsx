'use client';

import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';
import styles from './LandingHeader.module.css';

interface LandingHeaderProps {
  onOpenWaitlist: () => void;
}

export function LandingHeader({ onOpenWaitlist }: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<'pricing' | 'faq' | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);

      const faqEl = document.getElementById('faq');
      const pricingEl = document.getElementById('pricing');
      const offset = 140;

      if (faqEl && faqEl.getBoundingClientRect().top <= offset) {
        setActiveSection('faq');
      } else if (pricingEl && pricingEl.getBoundingClientRect().top <= offset) {
        setActiveSection('pricing');
      } else {
        setActiveSection(null);
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={styles.headerWrap}>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        <a href="#" className={styles.brand} onClick={() => setActiveSection(null)}>
          <svg
            width="26"
            height="26"
            viewBox="48 48 160 178"
            fill="none"
            aria-hidden="true"
          >
            <path
              stroke="#115E59"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M64 94L92 66v116h100l-28 28"
            />
          </svg>
          <span>LYGA</span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a
            href="#pricing"
            className={`${styles.link} ${activeSection === 'pricing' ? styles.linkActive : ''}`}
            onClick={() => setActiveSection('pricing')}
          >
            Pricing
          </a>
          <a
            href="#faq"
            className={`${styles.link} ${activeSection === 'faq' ? styles.linkActive : ''}`}
            onClick={() => setActiveSection('faq')}
          >
            FAQ
          </a>
        </nav>
        <div className={styles.actions}>
          <Button
            size="sm"
            radius="xl"
            className={styles.ctaButton}
            onClick={onOpenWaitlist}
          >
            Log in
          </Button>
        </div>
      </header>
    </div>
  );
}
