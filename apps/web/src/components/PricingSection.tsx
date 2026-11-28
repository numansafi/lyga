'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { Check } from 'lucide-react';
import type { PlanTier } from '@/lib/analytics';
import { PLANS } from '@/lib/pricingplan';
import styles from './PricingSection.module.css';

interface PricingSectionProps {
  onSelectPlan: (plan: PlanTier) => void;
}

export function PricingSection({ onSelectPlan }: PricingSectionProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const isYearly = billing === 'yearly';

  return (
    <section id="pricing" className={styles.section}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.heading}>Simple pricing</h2>
          <p className={styles.lead}>
            Start free for daily drops, or lock in the Founder rate for 5 GB transfers and a 100 GB vault.
          </p>
        </div>
        <div className={styles.billingToggle} role="group" aria-label="Billing interval">
          <button
            type="button"
            className={`${styles.toggleBtn} ${isYearly ? styles.toggleBtnActive : ''}`}
            onClick={() => setBilling('yearly')}
          >
            Yearly
            <span className={styles.savePill}>{PLANS.pro.yearlySaveLabel}</span>
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${!isYearly ? styles.toggleBtnActive : ''}`}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div>
            <div className={styles.planHeader}>
              <h3 className={styles.planName}>{PLANS.free.name} ({PLANS.free.shortName})</h3>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.price}>{PLANS.free.priceLabel}</span>
              <span className={styles.priceUnit}>{PLANS.free.billingPeriodLabel}</span>
            </div>

            <div className={styles.statStrip}>
              <div>
                <div className={styles.statVal}>{PLANS.free.maxFileLabel}</div>
                <div className={styles.statLabel}>Max file</div>
              </div>
              <div>
                <div className={styles.statVal}>{PLANS.free.expiryLabel}</div>
                <div className={styles.statLabel}>File expiry</div>
              </div>
              <div>
                <div className={styles.statVal}>{PLANS.free.maxDevices}</div>
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
                {PLANS.free.maxStorageLabel} active rolling file storage
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
              Start free →
            </Button>
            <p className={styles.ctaNote}>
              Free forever. No credit card required.
            </p>
          </div>
        </div>

        <div className={`${styles.card} ${styles.cardPro}`}>
          <div>
            <div className={styles.planHeader}>
              <h3 className={styles.planName}>{PLANS.pro.name}</h3>
              <span className={styles.badge}>Early Bird</span>
            </div>
            <div className={styles.priceRow}>
              <span className={styles.price}>
                {isYearly ? PLANS.pro.yearlyMonthlyLabel : PLANS.pro.priceLabel}
              </span>
              <span className={styles.priceUnit}>{PLANS.pro.billingPeriodLabel}</span>
              <span className={styles.strikePrice}>
                {isYearly ? `${PLANS.pro.priceLabel}/mo` : PLANS.pro.regularPriceLabel}
              </span>
              {isYearly && (
                <span className={styles.yearlyTotal}>Billed {PLANS.pro.yearlyTotalLabel}</span>
              )}
            </div>

            <div className={styles.statStrip}>
              <div>
                <div className={styles.statVal}>{PLANS.pro.maxFileLabel}</div>
                <div className={styles.statLabel}>Max file</div>
              </div>
              <div>
                <div className={styles.statVal}>{PLANS.pro.maxStorageLabel}</div>
                <div className={styles.statLabel}>Vault</div>
              </div>
              <div>
                <div className={styles.statVal}>{PLANS.pro.maxDevices}</div>
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
                {PLANS.pro.maxStorageLabel} persistent encrypted vault (files never expire)
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
              onClick={() => onSelectPlan('pro')}
            >
              Get Pro →
            </Button>
            <p className={styles.ctaNote}>
              Cancel anytime. Secure checkout via Stripe.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
