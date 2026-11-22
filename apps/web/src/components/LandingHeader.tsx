'use client';

import { Button } from '@mantine/core';
import styles from './LandingHeader.module.css';

interface LandingHeaderProps {
  onOpenWaitlist: () => void;
}

export function LandingHeader({ onOpenWaitlist }: LandingHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="#" className={styles.brand}>
          <svg
            width="30"
            height="30"
            viewBox="48 48 160 178"
            fill="none"
            aria-hidden="true"
          >
            <path
              stroke="#FFFFFF"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M64 94L92 66v116h100l-28 28"
            />
          </svg>
          <span>LYGA</span>
        </a>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#pricing" className={styles.link}>
            Pricing
          </a>
          <a href="#faq" className={styles.link}>
            FAQ
          </a>
          <Button size="sm" className={styles.ctaButton} onClick={onOpenWaitlist}>
            Join Early Access
          </Button>
        </nav>
      </div>
    </header>
  );
}
