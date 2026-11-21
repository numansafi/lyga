'use client';

import { Button } from '@mantine/core';
import { HeroFeedPreview } from './HeroFeedPreview';
import styles from './HeroSection.module.css';

interface HeroSectionProps {
  onOpenWaitlist: () => void;
}

export function HeroSection({ onOpenWaitlist }: HeroSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.copy}>
        <h1 className={styles.headline}>DM yourself the important stuff.</h1>
        <p className={styles.subheadline}>
          Send full-size videos, photos, and any file between your phone and computer.
        </p>
        <div className={styles.ctaGroup}>
          <Button size="md" onClick={onOpenWaitlist}>
            Join Early Access
          </Button>
          <p className={styles.trustLine}>
            Early access opens soon. Free up to 500 MB per file.
          </p>
        </div>
      </div>

      <HeroFeedPreview />
    </section>
  );
}
