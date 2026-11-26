'use client';

import { FileText, Film } from 'lucide-react';
import styles from './HeroSection.module.css';

interface HeroSectionProps {
  onOpenWaitlist: () => void;
}

export function HeroSection({ onOpenWaitlist }: HeroSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.orbitStage} aria-hidden="true">
          <div className={styles.cornerPhone}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="6" y="2" width="12" height="20" rx="3" />
              <line x1="10.5" y1="5" x2="13.5" y2="5" />
            </svg>
          </div>

          <div className={styles.cornerPc}>
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2.5" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
          </div>

          <div className={`${styles.orbitFile} ${styles.orbitSend}`}>
            <Film size={13} strokeWidth={2.2} />
            <span>4K.MOV</span>
          </div>

          <div className={`${styles.orbitFile} ${styles.orbitReturn}`}>
            <FileText size={13} strokeWidth={2.2} />
            <span>DOC.PDF</span>
          </div>
        </div>

        <div className={styles.copy}>
          <h1 className={styles.headline}>DM yourself the important stuff.</h1>

          <p className={`${styles.bubble} ${styles.bubbleRight} ${styles.step1}`}>
            Send 4K videos, photos, and any file between your phone and computer.
            <span className={`${styles.receipt} ${styles.receipt1}`} aria-hidden="true">
              ✓✓
            </span>
          </p>

          <button type="button" className={styles.heroCta} onClick={onOpenWaitlist}>
            Get started free →
          </button>

          <p className={styles.heroNote}>
            Free up to 500 MB/file. Sign in with Google or email.
          </p>
        </div>
      </div>
    </section>
  );
}
