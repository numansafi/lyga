'use client';

import { useEffect, useRef, useState } from 'react';
import { Accordion, Button } from '@mantine/core';
import { Check, Lock } from 'lucide-react';
import type { WaitlistPlan } from '@/lib/analytics';
import styles from './DmFeedSection.module.css';

interface DmFeedSectionProps {
  onSelectPlan: (plan: WaitlistPlan) => void;
}

const COMPARE_ROWS = [
  {
    feature: 'How big can a file be?',
    whatsapp: { text: 'Tiny — 16 MB', pct: 4 },
    email: { text: '25 MB', pct: 6 },
    apps: { text: '2 GB (free tier)', pct: 40 },
    lyga: { text: '500 MB free, 5 GB Pro', pct: 100 },
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
    lyga: { text: 'Clean, searchable personal feed' },
  },
];

const FAQS = [
  {
    value: 'encryption',
    question: 'How is it encrypted?',
    answer:
      'Files and messages are encrypted in your browser with AES-256-GCM before upload. The pairing key stays in the URL # fragment and never reaches our servers.',
  },
  {
    value: 'devices',
    question: 'Which devices work?',
    answer:
      'Any modern desktop or mobile browser on Windows, Mac, Linux, iPhone, and Android. Native iOS and Android Share Sheet apps are planned next.',
  },
  {
    value: 'expiry',
    question: 'What happens to Free files after 7 days?',
    answer:
      'Free files expire automatically after 7 days to keep storage lean. Text, links, and code snippets stay, and Pro keeps files in a 100 GB persistent vault.',
  },
  {
    value: 'billing',
    question: 'Will I be charged today for the Founder Spot?',
    answer:
      'No. Entering your email reserves the £5/mo Early Bird rate for when Pro launches. No card is collected today.',
  },
];

export function DmFeedSection({ onSelectPlan }: DmFeedSectionProps) {
  const compareRef = useRef<HTMLDivElement>(null);
  const [barsVisible, setBarsVisible] = useState(false);

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
            <span className={styles.statusDevices}>· PHONE ↔ PC</span>
          </span>
        </div>

        {/* Message 1: Left (The Problem) */}
        <div className={`${styles.msgRow} ${styles.msgLeft}`}>
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>iPhone 16</span>
              <span className={styles.timestamp}>4:18 PM</span>
            </div>
            <p className={styles.msgText}>
              Ugh, just tried sending a 4K video to my PC. WhatsApp completely ruined the quality
              and email said it&apos;s too big.
            </p>
          </div>
        </div>

        {/* Message 2: Right (The Lyga Solution) */}
        <div className={`${styles.msgRow} ${styles.msgRight}`}>
          <div className={styles.bubbleOutgoing}>
            <div className={styles.senderMetaOutgoing}>
              <span>Lyga</span>
            </div>
            <p className={styles.outgoingLead}>Send it with Lyga instead.</p>
            <ul className={styles.outgoingList}>
              <li>
                <span className={styles.outgoingTick} aria-hidden="true">
                  ✓✓
                </span>
                <span>From phone to PC in milliseconds</span>
              </li>
              <li>
                <span className={styles.outgoingTick} aria-hidden="true">
                  ✓✓
                </span>
                <span>Feels like texting yourself</span>
              </li>
              <li>
                <span className={styles.outgoingTick} aria-hidden="true">
                  ✓✓
                </span>
                <span>No clunky cables, no email limits, zero quality loss</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Message 3: Left Question from iPhone 16 */}
        <div className={`${styles.msgRow} ${styles.msgLeft}`}>
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>iPhone 16</span>
              <span className={styles.timestamp}>4:19 PM</span>
            </div>
            <p className={styles.msgText}>
              Okay, but why wouldn&apos;t I just use WhatsApp, email, or another sharing app?
            </p>
          </div>
        </div>

        {/* Message 4: Lyga Reply Rich Card (Comparison) */}
        <div id="compare" ref={compareRef} className={`${styles.msgRow} ${styles.msgRight}`}>
          <div className={styles.compareMsgCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Lyga</span>
              <span className={styles.timestamp}>4:19 PM ✓✓</span>
            </div>
            <h2 className={styles.compareMsgTitle}>
              Built for the gap between your phone and computer
            </h2>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>What matters</th>
                    <th>WhatsApp</th>
                    <th>Email</th>
                    <th>File sharing apps</th>
                    <th className={styles.lygaHeader}>LYGA</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <td className={styles.featureCell}>{row.feature}</td>
                      {[row.whatsapp, row.email, row.apps].map((cell, idx) => (
                        <td key={idx}>
                          <div>{cell.text}</div>
                          {typeof cell.pct === 'number' && (
                            <div className={styles.barTrack} aria-hidden="true">
                              <div
                                className={`${styles.barFill} ${
                                  barsVisible ? styles.barVisible : ''
                                }`}
                                style={{ width: `${cell.pct}%` }}
                              />
                            </div>
                          )}
                        </td>
                      ))}
                      <td className={styles.lygaCol}>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Message 5: Left Price Objection from iPhone 16 */}
        <div className={`${styles.msgRow} ${styles.msgLeft}`}>
          <div className={styles.bubbleIncoming}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>iPhone 16</span>
              <span className={styles.timestamp}>4:20 PM</span>
            </div>
            <p className={styles.msgText}>
              Sounds good, I bet it&apos;s really expensive though?
            </p>
          </div>
        </div>

        {/* Message 6: Right Reply Card (Pricing) */}
        <div id="pricing" className={`${styles.msgRow} ${styles.msgRight}`}>
          <div className={styles.pricingMsgCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Lyga</span>
              <span className={styles.timestamp}>4:20 PM ✓✓</span>
            </div>
            <div className={styles.pricingMsgHeader}>
              <h2 className={styles.compareMsgTitle} style={{ margin: 0 }}>
                Not at all — simple pricing
              </h2>
              <span className={styles.cardBadge}>No card required today</span>
            </div>

            <div className={styles.pricingGrid}>
              <div className={styles.planCard}>
                <div>
                  <h3 className={styles.planName}>Starter (Free)</h3>
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
                      <div className={styles.statLabel}>Auto-expiry</div>
                    </div>
                    <div>
                      <div className={styles.statVal}>2</div>
                      <div className={styles.statLabel}>Devices</div>
                    </div>
                  </div>
                  <ul className={styles.checkList}>
                    <li>
                      <Check size={15} color="var(--accent-primary)" aria-hidden="true" />
                      Unlimited text, links, and code snippets
                    </li>
                    <li>
                      <Check size={15} color="var(--accent-primary)" aria-hidden="true" />2 GB
                      active rolling file storage
                    </li>
                    <li>
                      <Check size={15} color="var(--accent-primary)" aria-hidden="true" />
                      End-to-end encrypted browser feed
                    </li>
                  </ul>
                </div>
                <Button
                  variant="default"
                  size="md"
                  fullWidth
                  className={styles.pressBtn}
                  onClick={() => onSelectPlan('free')}
                >
                  Join Free Waitlist
                </Button>
              </div>

              <div className={`${styles.planCard} ${styles.planCardPro}`}>
                <div>
                  <div className={styles.planHeader}>
                    <h3 className={styles.planName}>Pro Founder Spot</h3>
                    <span className={styles.earlyBadge}>Early Bird</span>
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
                  <ul className={styles.checkList}>
                    <li>
                      <Check size={15} color="var(--accent-primary)" aria-hidden="true" />
                      Everything in Starter, plus 5 GB uncompressed uploads
                    </li>
                    <li>
                      <Check size={15} color="var(--accent-primary)" aria-hidden="true" />
                      100 GB persistent encrypted vault
                    </li>
                    <li>
                      <Check size={15} color="var(--accent-primary)" aria-hidden="true" />
                      Expiring Drop Links &amp; 1-click HEIC to JPG
                    </li>
                  </ul>
                </div>
                <div>
                  <Button
                    size="md"
                    fullWidth
                    className={styles.pressBtn}
                    onClick={() => onSelectPlan('pro_founder')}
                  >
                    Claim £5/mo Founder Spot
                  </Button>
                  <p className={styles.ctaNote}>No card required today. Locks in £5/mo at launch.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Message 5: Left FAQ Bubble */}
        <div id="faq" className={`${styles.msgRow} ${styles.msgLeftWide}`}>
          <div className={styles.faqCard}>
            <div className={styles.senderMeta}>
              <span className={styles.senderName}>Questions</span>
              <span className={styles.timestamp}>Before you join</span>
            </div>
            <Accordion variant="separated" radius={0}>
              {FAQS.map((item) => (
                <Accordion.Item key={item.value} value={item.value}>
                  <Accordion.Control>{item.question}</Accordion.Control>
                  <Accordion.Panel>{item.answer}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
