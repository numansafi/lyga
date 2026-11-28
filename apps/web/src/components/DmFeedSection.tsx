'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@mantine/core';
import { ChevronDown, Lock } from 'lucide-react';
import type { PlanTier } from '@/lib/analytics';
import { PLANS } from '@/lib/pricingplan';
import styles from './DmFeedSection.module.css';

interface DmFeedSectionProps {
  onSelectPlan: (plan: PlanTier) => void;
}

type CompetitorKey = 'whatsapp' | 'email' | 'apps';

const COMPETITOR_TABS: { key: CompetitorKey; tabLabel: string; name: string }[] = [
  { key: 'whatsapp', tabLabel: 'vs. Messaging yourself', name: 'Messaging yourself' },
  { key: 'email', tabLabel: 'vs. Email', name: 'Email' },
  { key: 'apps', tabLabel: 'vs. Sharing apps', name: 'File sharing apps' },
];

const COMPARE_ROWS: {
  feature: string;
  whatsapp: { text: string; pct?: number };
  email: { text: string; pct?: number };
  apps: { text: string; pct?: number };
  lyga: { text: string; pct?: number };
}[] = [
  {
    feature: 'How big can a file be?',
    whatsapp: { text: 'Tiny — 16 MB', pct: 4 },
    email: { text: '25 MB', pct: 6 },
    apps: { text: '2 GB (free tier)', pct: 40 },
    lyga: { text: `${PLANS.free.maxFileLabel} free, ${PLANS.pro.maxFileLabel} ${PLANS.pro.shortName}`, pct: 100 },
  },
  {
    feature: 'Does it ruin quality?',
    whatsapp: { text: 'Compresses videos & photos' },
    email: { text: 'Keeps original' },
    apps: { text: 'Keeps original' },
    lyga: { text: 'Never — 100% original' },
  },
  {
    feature: 'Works anywhere?',
    whatsapp: { text: 'Yes' },
    email: { text: 'Yes' },
    apps: { text: 'Links expire or same Wi-Fi' },
    lyga: { text: 'Yes — even if your PC is asleep' },
  },
  {
    feature: 'Easy to find later?',
    whatsapp: { text: 'Buried under old chats' },
    email: { text: 'Lost in your inbox' },
    apps: { text: 'Gone after one transfer' },
    lyga: { text: 'Clean, searchable timeline' },
  },
];

const FAQS = [
  {
    value: 'privacy',
    question: 'Can Lyga see my photos or files?',
    answer:
      "No. Everything is locked in your browser before it leaves your device. Only your own phone and computer can unlock it, so we can't read your notes, file names, or files.",
  },
  {
    value: 'install',
    question: 'Do I have to install an app on my computer?',
    answer:
      "No. Lyga runs straight in your browser, so it works on your main PC, a Mac, or even a work computer where you can't install apps.",
  },
  {
    value: 'wifi',
    question: 'Do my phone and computer need to be on the same Wi-Fi?',
    answer:
      'No. You can send files from anywhere, even on mobile data while your computer is asleep at home. Everything shows up as soon as you open your browser.',
  },
  {
    value: 'quality',
    question: 'Will it shrink my photos or ruin 4K video quality?',
    answer:
      'Never. Everything arrives in the exact original size and quality you sent it in.',
  },
  {
    value: 'expiry',
    question: `What happens to my files after ${PLANS.free.expiryLabel} on the Free plan?`,
    answer:
      `Uploaded files are removed after ${PLANS.free.expiryLabel}, while your text notes and links stay. If you want to keep files long-term, ${PLANS.pro.shortName} gives you ${PLANS.pro.maxStorageLabel} of storage that doesn't expire.`,
  },
  {
    value: 'billing',
    question: 'Do I need a credit card to get started?',
    answer:
      `No. The ${PLANS.free.shortName} plan is completely free with ${PLANS.free.maxFileLabel} per file, ${PLANS.free.maxStorageLabel} active storage, and ${PLANS.free.maxDevices} paired devices. Just sign in and start sending.`,
  },
];

interface AnimatedMsgProps {
  side: 'left' | 'right';
  delayMs?: number;
  id?: string;
  children: React.ReactNode;
}

const revealCallbacks = new WeakMap<Element, () => void>();
let sharedRevealObserver: IntersectionObserver | null = null;

function observeReveal(el: Element, onReveal: () => void): () => void {
  if (!sharedRevealObserver) {
    sharedRevealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = revealCallbacks.get(entry.target);
            if (cb) {
              revealCallbacks.delete(entry.target);
              sharedRevealObserver?.unobserve(entry.target);
              cb();
            }
          }
        }
      },
      { threshold: 0.01 }
    );
  }
  revealCallbacks.set(el, onReveal);
  sharedRevealObserver.observe(el);
  return () => {
    revealCallbacks.delete(el);
    sharedRevealObserver?.unobserve(el);
  };
}

function AnimatedMsg({ side, delayMs = 0, id, children }: AnimatedMsgProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      setVisible(true);
      return;
    }

    setPending(true);
    return observeReveal(el, () => {
      setVisible(true);
      setPending(false);
    });
  }, []);

  const alignClass = side === 'left' ? styles.msgLeft : styles.msgRight;
  const animClass = side === 'left' ? styles.animLeft : styles.animRight;

  return (
    <div
      id={id}
      ref={ref}
      className={`${styles.msgRow} ${alignClass} ${animClass} ${
        pending ? styles.animPending : ''
      } ${visible ? styles.msgVisible : ''}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}

export function DmFeedSection({ onSelectPlan }: DmFeedSectionProps) {
  const compareRef = useRef<HTMLDivElement>(null);
  const [barsVisible, setBarsVisible] = useState(false);
  const [activeCompetitor, setActiveCompetitor] = useState<CompetitorKey>('whatsapp');
  const [openFaq, setOpenFaq] = useState<string | null>(FAQS[0]?.value ?? null);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const isYearly = billing === 'yearly';

  const selectedCompetitor =
    COMPETITOR_TABS.find((tab) => tab.key === activeCompetitor) ?? COMPETITOR_TABS[0];

  useEffect(() => {
    const el = compareRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setBarsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.canvas} aria-label="Personal feed walkthrough">
      <div className={styles.thread}>
        {/* Thread Status Pill */}
        <div className={styles.threadDivider}>
          <span className={styles.statusPill}>
            <Lock size={12} strokeWidth={2.2} aria-hidden="true" />
            <span>TODAY · END-TO-END ENCRYPTED</span>
          </span>
        </div>

        {/* Exchange 1: Problem & Solution */}
        <div className={styles.exchangeGroup}>
          {/* Message 1: Left (The Problem) */}
          <AnimatedMsg side="left">
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>You</span>
              <span className={styles.timestamp}>4:18 PM</span>
            </div>
            <p className={styles.msgText}>
              Ugh, just tried sending a 4K video to my PC. WhatsApp completely ruined the quality
              and email said it&apos;s too big.
            </p>
          </div>
        </AnimatedMsg>

        {/* Message 2: Right (The Lyga Solution) */}
        <AnimatedMsg side="right" delayMs={120}>
          <div className={styles.bubbleOutgoing}>
            <div className={styles.senderMetaOutgoing}>
              <span>Lyga</span>
              <span className={styles.ticks} aria-hidden="true">
                4:18 PM
              </span>
            </div>
            <p className={styles.outgoingLead}>Drop it in Lyga instead.</p>
            <ul className={styles.outgoingList}>
              <li>
                <span className={styles.outgoingTick} aria-hidden="true">
                  ✓✓
                </span>
                <span>Works in your browser — nothing to install</span>
              </li>
              <li>
                <span className={styles.outgoingTick} aria-hidden="true">
                  ✓✓
                </span>
                <span>Scan a QR code to connect your phone and PC</span>
              </li>
              <li>
                <span className={styles.outgoingTick} aria-hidden="true">
                  ✓✓
                </span>
                <span>Full-quality 4K videos and iPhone .HEIC photo previews</span>
              </li>
            </ul>
          </div>
        </AnimatedMsg>
        </div>

        {/* Exchange 2: Comparison */}
        <div className={styles.exchangeGroup}>
          {/* Message 3: Left Question from iPhone 16 */}
          <AnimatedMsg side="left">
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>You</span>
              <span className={styles.timestamp}>4:19 PM</span>
            </div>
            <p className={styles.msgText}>
              Okay, but why wouldn&apos;t I just message myself, use email, or try another sharing
              app?
            </p>
          </div>
        </AnimatedMsg>

        {/* Message 4: Lyga Reply Rich Card (1-vs-1 Tabbed Comparison) */}
        <AnimatedMsg side="right" id="compare" delayMs={100}>
          <div ref={compareRef} className={styles.compareMsgCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Lyga</span>
              <span className={styles.timestamp}>4:19 PM</span>
            </div>
            <h2 className={styles.compareMsgTitle}>
              Built for the gap between your phone and computer
            </h2>

            <div
              className={styles.compareTabs}
              role="tablist"
              aria-label="Compare Lyga against"
              onKeyDown={(e) => {
                const idx = COMPETITOR_TABS.findIndex((t) => t.key === activeCompetitor);
                if (idx === -1) return;
                let nextIdx = idx;
                if (e.key === 'ArrowRight') nextIdx = (idx + 1) % COMPETITOR_TABS.length;
                else if (e.key === 'ArrowLeft')
                  nextIdx = (idx - 1 + COMPETITOR_TABS.length) % COMPETITOR_TABS.length;
                else if (e.key === 'Home') nextIdx = 0;
                else if (e.key === 'End') nextIdx = COMPETITOR_TABS.length - 1;
                else return;
                e.preventDefault();
                const nextKey = COMPETITOR_TABS[nextIdx].key;
                setActiveCompetitor(nextKey);
                document.getElementById(`tab-${nextKey}`)?.focus();
              }}
            >
              {COMPETITOR_TABS.map((tab) => {
                const isSelected = activeCompetitor === tab.key;
                return (
                  <button
                    key={tab.key}
                    id={`tab-${tab.key}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls="compare-tabpanel"
                    tabIndex={isSelected ? 0 : -1}
                    className={`${styles.compareTab} ${
                      isSelected ? styles.compareTabActive : ''
                    }`}
                    onClick={() => setActiveCompetitor(tab.key)}
                  >
                    {tab.tabLabel}
                  </button>
                );
              })}
            </div>

            <div
              id="compare-tabpanel"
              className={styles.comparePairCard}
              role="tabpanel"
              aria-labelledby={`tab-${activeCompetitor}`}
            >
              <div className={styles.comparePairHeader}>
                <div className={styles.comparePairLabelHeader}>What matters</div>
                <div className={styles.comparePairThemHeader}>{selectedCompetitor.name}</div>
                <div className={styles.comparePairLygaHeader}>
                  <span className={styles.lygaHeaderTick} aria-hidden="true">
                    ✓✓
                  </span>
                  <span>LYGA</span>
                </div>
              </div>

              {COMPARE_ROWS.map((row) => {
                const compCell = row[activeCompetitor];
                return (
                  <div key={row.feature} className={styles.comparePairGroup}>
                    <div className={styles.comparePairQuestion}>{row.feature}</div>
                    <div className={styles.comparePairThemCell}>
                      <div>{compCell.text}</div>
                      {typeof compCell.pct === 'number' && (
                        <div className={styles.barTrack} aria-hidden="true">
                          <div
                            className={`${styles.barFill} ${
                              barsVisible ? styles.barVisible : ''
                            }`}
                            style={{ width: `${compCell.pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className={styles.comparePairLygaCell}>
                      <div className={styles.lygaCellRow}>
                        <span className={styles.lygaTick} aria-hidden="true">
                          ✓✓
                        </span>
                        <span>{row.lyga.text}</span>
                      </div>
                      {typeof row.lyga.pct === 'number' && (
                        <div className={styles.barTrack} aria-hidden="true">
                          <div
                            className={`${styles.barFillLyga} ${
                              barsVisible ? styles.barVisible : ''
                            }`}
                            style={{ width: `${row.lyga.pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AnimatedMsg>
        </div>

        {/* Exchange 3: Security */}
        <div className={styles.exchangeGroup}>
          {/* Message 5: Left Security Question from iPhone 16 */}
          <AnimatedMsg side="left">
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>You</span>
              <span className={styles.timestamp}>4:20 PM</span>
            </div>
            <p className={styles.msgText}>
              Wait, can anyone else see my photos or files?
            </p>
          </div>
        </AnimatedMsg>

        {/* Message 6: Right Reply Card (Security) */}
        <AnimatedMsg side="right" id="security" delayMs={100}>
          <div className={styles.securityMsgCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Lyga</span>
              <span className={styles.timestamp}>4:20 PM</span>
            </div>
            <div className={styles.pricingMsgHeader}>
              <h2 className={styles.compareMsgTitle} style={{ margin: 0 }}>
                Nobody can see them. Not even us.
              </h2>
              <span className={styles.securityBadge}>
                <Lock size={11} strokeWidth={2.2} aria-hidden="true" />
                <span>Only for your devices</span>
              </span>
            </div>

            <div className={styles.securitySplit} aria-label="What you see versus what Lyga sees">
              <div className={styles.securitySplitYou}>
                <div className={styles.securitySplitLabelYou}>What you see</div>
                <div className={styles.securityPreviewCard}>
                  <div className={styles.securityPreviewIconYou} aria-hidden="true">
                    4K
                  </div>
                  <div className={styles.securityPreviewMeta}>
                    <div className={styles.securityPreviewName}>Vacation_clip.mov</div>
                    <div className={styles.securityPreviewSub}>1.2 GB · Original quality</div>
                  </div>
                </div>
              </div>

              <div className={styles.securitySplitBridge} aria-hidden="true">
                <Lock size={12} strokeWidth={2.3} />
              </div>

              <div className={styles.securitySplitServer}>
                <div className={styles.securitySplitLabelServer}>What Lyga sees</div>
                <div className={styles.securityPreviewCardDark}>
                  <div className={styles.securityPreviewIconServer} aria-hidden="true">
                    <Lock size={14} strokeWidth={2.2} />
                  </div>
                  <div className={styles.securityPreviewMeta} style={{ flex: 1 }}>
                    <div className={styles.securityRedactBar} aria-hidden="true" />
                    <div className={styles.securityPreviewSubDark}>File &amp; name hidden</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.securityList}>
              <div className={styles.securityItem}>
                <span className={styles.checkTick} aria-hidden="true">
                  ✓✓
                </span>
                <div>
                  <div className={styles.securityItemTitle}>End-to-end encrypted</div>
                  <p className={styles.securityItemDesc}>
                    Your phone and computer lock everything before it&apos;s sent. We deliver it,
                    but we can&apos;t see your files, notes, or even file names.
                  </p>
                </div>
              </div>

              <div className={styles.securityItem}>
                <span className={styles.checkTick} aria-hidden="true">
                  ✓✓
                </span>
                <div>
                  <div className={styles.securityItemTitle}>Private to your devices only</div>
                  <p className={styles.securityItemDesc}>
                    Your files and notes only appear on the phone and computer you&apos;re signed
                    into. Nobody else can view or open what you send.
                  </p>
                </div>
              </div>

              <div className={styles.securityItem}>
                <span className={styles.checkTick} aria-hidden="true">
                  ✓✓
                </span>
                <div>
                  <div className={styles.securityItemTitle}>
                    Delete a file and it&apos;s gone immediately
                  </div>
                  <p className={styles.securityItemDesc}>
                    Delete a file with one tap and it&apos;s wiped from our servers right away. We
                    never keep hidden copies or backups.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedMsg>
        </div>

        {/* Exchange 4: Pricing */}
        <div className={styles.exchangeGroup}>
          {/* Message 7: Left Price Objection from iPhone 16 */}
          <AnimatedMsg side="left">
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>You</span>
              <span className={styles.timestamp}>4:21 PM</span>
            </div>
            <p className={styles.msgText}>
              Sounds good, I bet it&apos;s really expensive though?
            </p>
          </div>
        </AnimatedMsg>

        {/* Message 8: Right Reply Card (Pricing) */}
        <AnimatedMsg side="right" id="pricing" delayMs={100}>
          <div className={styles.pricingMsgCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Lyga</span>
              <span className={styles.timestamp}>4:21 PM</span>
            </div>
            <div className={styles.pricingMsgHeader}>
              <h2 className={styles.compareMsgTitle} style={{ margin: 0 }}>
                Start free today. Pro ({isYearly ? `${PLANS.pro.yearlyMonthlyLabel}/mo` : `${PLANS.pro.priceLabel}/mo`}) is coming soon.
              </h2>
              <div className={styles.billingToggle} role="group" aria-label="Billing interval">
                <button
                  type="button"
                  aria-pressed={isYearly}
                  className={`${styles.billingBtn} ${isYearly ? styles.billingBtnActive : ''}`}
                  onClick={() => setBilling('yearly')}
                >
                  Yearly
                  <span className={styles.savePill}>{PLANS.pro.yearlySaveLabel}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={!isYearly}
                  className={`${styles.billingBtn} ${!isYearly ? styles.billingBtnActive : ''}`}
                  onClick={() => setBilling('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className={styles.pricingGrid}>
              <div className={styles.planCard}>
                <div>
                  <h3 className={styles.planName}>Free</h3>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>£0</span>
                    <span className={styles.priceUnit}>/ month</span>
                  </div>
                  <div className={styles.statStrip}>
                    <div>
                      <div className={styles.statVal}>{PLANS.free.maxFileLabel}</div>
                      <div className={styles.statLabel}>Per file</div>
                    </div>
                    <div>
                      <div className={styles.statVal}>{PLANS.free.expiryLabel}</div>
                      <div className={styles.statLabel}>Files kept</div>
                    </div>
                    <div>
                      <div className={styles.statVal}>{PLANS.free.maxDevices}</div>
                      <div className={styles.statLabel}>Devices</div>
                    </div>
                  </div>
                  <ul className={styles.checkList}>
                    <li>
                      <span className={styles.checkTick} aria-hidden="true">
                        ✓✓
                      </span>
                      <span>Unlimited notes and links</span>
                    </li>
                    <li>
                      <span className={styles.checkTick} aria-hidden="true">
                        ✓✓
                      </span>
                      <span>{PLANS.free.maxStorageLabel} of space for recent files</span>
                    </li>
                    <li>
                      <span className={styles.checkTick} aria-hidden="true">
                        ✓✓
                      </span>
                      <span>Encrypted in your browser before upload</span>
                    </li>
                  </ul>
                </div>
                <Button
                  size="md"
                  fullWidth
                  className={styles.pressBtn}
                  onClick={() => onSelectPlan('free')}
                >
                  Start Free →
                </Button>
              </div>

              <div className={`${styles.planCard} ${styles.planCardPro}`}>
                <div>
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>Pro</h3>
                    <span className={styles.earlyBadge}>Coming soon · Founder Rate</span>
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
                      <div className={styles.statLabel}>Per file</div>
                    </div>
                    <div>
                      <div className={styles.statVal}>{PLANS.pro.maxStorageLabel}</div>
                      <div className={styles.statLabel}>Storage</div>
                    </div>
                    <div>
                      <div className={styles.statVal}>{PLANS.pro.maxDevices}</div>
                      <div className={styles.statLabel}>Devices</div>
                    </div>
                  </div>
                  <ul className={styles.checkList}>
                    <li>
                      <span className={styles.checkTick} aria-hidden="true">
                        ✓✓
                      </span>
                      <span>Send {PLANS.pro.maxFileLabel} files with zero quality loss</span>
                    </li>
                    <li>
                      <span className={styles.checkTick} aria-hidden="true">
                        ✓✓
                      </span>
                      <span>{PLANS.pro.maxStorageLabel} storage that never expires</span>
                    </li>
                    <li>
                      <span className={styles.checkTick} aria-hidden="true">
                        ✓✓
                      </span>
                      <span>Send anytime, even when your PC is asleep</span>
                    </li>
                  </ul>
                </div>
                <div>
                  <Button
                    variant="default"
                    size="md"
                    fullWidth
                    className={styles.pressBtn}
                    onClick={() => onSelectPlan('pro')}
                  >
                    Start free · Pro coming soon →
                  </Button>
                  <p className={styles.ctaNote}>Free plan works right now. No card needed.</p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedMsg>
        </div>

        {/* Exchange 5: FAQ & Closing CTA */}
        <div className={styles.exchangeGroup}>
          {/* Message 9: Left FAQ Prompt from You */}
          <AnimatedMsg side="left">
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>You</span>
              <span className={styles.timestamp}>4:22 PM</span>
            </div>
            <p className={styles.msgText}>
              I&apos;m ready to join, just got a few quick questions.
            </p>
          </div>
        </AnimatedMsg>

        {/* Message 10: Right FAQ Reply Bubble */}
        <AnimatedMsg side="right" id="faq" delayMs={100}>
          <div className={styles.faqCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Lyga</span>
              <span className={styles.timestamp}>4:22 PM</span>
            </div>
            <h2 className={styles.compareMsgTitle}>Of course. Here&apos;s what to know.</h2>
            <div className={styles.faqList}>
              {FAQS.map((item) => {
                const isOpen = openFaq === item.value;
                return (
                  <div
                    key={item.value}
                    className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.faqTrigger}
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${item.value}`}
                      onClick={() => setOpenFaq(isOpen ? null : item.value)}
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={`${styles.faqChevron} ${
                          isOpen ? styles.faqChevronOpen : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p id={`faq-answer-${item.value}`} className={styles.faqAnswer}>
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </AnimatedMsg>

        {/* Message 11: Closing CTA from Lyga */}
        <AnimatedMsg side="right">
          <div className={styles.closingCtaCard}>
            <div className={styles.senderMetaOutgoing}>
              <span>Lyga</span>
              <span className={styles.ticks}>4:22 PM</span>
            </div>
            <p className={styles.closingCtaCopy}>
              Ready when you are. Start free in seconds.
            </p>
            <Button
              size="md"
              className={`${styles.pressBtn} ${styles.closingCtaBtn}`}
              onClick={() => onSelectPlan('free')}
            >
              Start Free →
            </Button>
          </div>
        </AnimatedMsg>
        </div>
      </div>
    </section>
  );
}
