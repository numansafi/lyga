'use client';

import { Button } from '@mantine/core';
import { Check } from 'lucide-react';
import type { WaitlistPlan } from '@/lib/analytics';
import styles from './PricingSection.module.css';

interface PricingSectionProps {
  onSelectPlan: (plan: WaitlistPlan) => void;
}

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  return (
    <section id="pricing" className={styles.section}>
      <h2 className={styles.heading}>Simple pricing</h2>
      <p className={styles.lead}>
        Start free for daily drops, or lock in the Founder rate for 5 GB transfers and a 100 GB vault.
      </p>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div>
            <div className={styles.planHeader}>
              <h3 className={styles.planName}>Starter (Free)</h3>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.price}>£0</span>
              <span className={styles.priceUnit}>/ month</span>
            </div>

            <div className={styles.statStrip}>
              <div>
                <div className={styles.statVal}>500 MB</div>
                <div className={styles.statLabel}>Max file</div>
              </div>
              <div>
                <div className={styles.statVal}>7 days</div>
                <div className={styles.statLabel}>File expiry</div>
              </div>
              <div>
                <div className={styles.statVal}>2</div>
                <div className={styles.statLabel}>Devices</div>
              </div>
            </div>

            <ul className={styles.list}>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                Unlimited text, links, and code snippets
              </li>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                2 GB active rolling file storage
              </li>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                End-to-end encrypted browser feed
              </li>
            </ul>
          </div>

          <div>
            <Button
              variant="default"
              size="md"
              fullWidth
              onClick={() => onSelectPlan('free')}
            >
              Join Free Waitlist
            </Button>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardPro}`}>
          <div>
            <div className={styles.planHeader}>
              <h3 className={styles.planName}>Pro Founder Spot</h3>
              <span className={styles.badge}>Early Bird</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.price}>£5</span>
              <span className={styles.priceUnit}>/ month</span>
              <span className={styles.strikePrice}>£8/mo</span>
            </div>

            <div className={styles.statStrip}>
              <div>
                <div className={styles.statVal}>5 GB</div>
                <div className={styles.statLabel}>Max file</div>
              </div>
              <div>
                <div className={styles.statVal}>100 GB</div>
                <div className={styles.statLabel}>Vault</div>
              </div>
              <div>
                <div className={styles.statVal}>5</div>
                <div className={styles.statLabel}>Devices</div>
              </div>
            </div>

            <ul className={styles.list}>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                Everything in Starter, plus 5 GB uncompressed uploads
              </li>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                100 GB persistent encrypted vault (no 7-day expiry)
              </li>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                Expiring public Drop Links for clients
              </li>
              <li className={styles.listItem}>
                <Check size={16} color="var(--accent-primary)" aria-hidden="true" />
                1-click HEIC to JPG conversion for Windows
              </li>
            </ul>
          </div>

          <div>
            <Button
              size="md"
              fullWidth
              onClick={() => onSelectPlan('pro_founder')}
            >
              Claim £5/mo Founder Spot
            </Button>
            <p className={styles.ctaNote}>
              No card required today. Locks in £5/mo at launch.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
