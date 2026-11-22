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
          LYGA
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
