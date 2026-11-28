'use client';

import { useEffect, useRef, useState } from 'react';
import { PLANS } from '@/lib/pricingplan';
import styles from './ComparisonSection.module.css';

interface ComparisonCell {
  text: string;
  pct?: number;
}

interface ComparisonRow {
  feature: string;
  whatsapp: ComparisonCell;
  emailFwd: ComparisonCell;
  localSend: ComparisonCell;
  lyga: ComparisonCell;
}

const ROWS: ComparisonRow[] = [
  {
    feature: 'How big can a file be?',
    whatsapp: { text: 'Tiny — 16 MB', pct: 4 },
    emailFwd: { text: '25 MB', pct: 6 },
    localSend: { text: '2 GB (free tier)', pct: 40 },
    lyga: { text: `${PLANS.free.maxFileLabel} free, ${PLANS.pro.maxFileLabel} ${PLANS.pro.shortName}`, pct: 100 },
  },
  {
    feature: 'Does it ruin quality?',
    whatsapp: { text: 'Compresses videos & photos' },
    emailFwd: { text: 'Keeps original' },
    localSend: { text: 'Keeps original' },
    lyga: { text: 'Never — 100% original' },
  },
  {
    feature: 'Works anywhere?',
    whatsapp: { text: 'Yes' },
    emailFwd: { text: 'Yes' },
    localSend: { text: 'Links expire or same Wi-Fi' },
    lyga: { text: 'Yes — even if your PC is asleep' },
  },
  {
    feature: 'Easy to find later?',
    whatsapp: { text: 'Buried under old chats' },
    emailFwd: { text: 'Lost in your inbox' },
    localSend: { text: 'Gone after one transfer' },
    lyga: { text: 'Clean, searchable personal feed' },
  },
];

function CellContent({
  cell,
  isLyga,
  barsVisible,
}: {
  cell: ComparisonCell;
  isLyga?: boolean;
  barsVisible: boolean;
}) {
  return (
    <>
      <div className={isLyga ? styles.lygaCellRow : undefined}>
        {isLyga && (
          <span className={styles.lygaTick} aria-hidden="true">
            ✓✓
          </span>
        )}
        <span>{cell.text}</span>
      </div>
      {typeof cell.pct === 'number' && (
        <div className={styles.barTrack} aria-hidden="true">
          <div
            className={`${isLyga ? styles.barFillLyga : styles.barFill} ${
              barsVisible ? styles.barVisible : ''
            }`}
            style={{ width: `${cell.pct}%` }}
          />
        </div>
      )}
    </>
  );
}

export function ComparisonSection() {
  const tableRef = useRef<HTMLDivElement>(null);
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setBarsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="compare" className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.heading}>Built for the gap between your phone and computer</h2>
        <p className={styles.lead}>
          Stop emailing yourself attachments or shrinking 4K clips through chat apps.
        </p>

        <div ref={tableRef} className={styles.tableWrap}>
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
              {ROWS.map((row) => (
                <tr key={row.feature}>
                  <td className={styles.featureCell}>{row.feature}</td>
                  <td><CellContent cell={row.whatsapp} barsVisible={barsVisible} /></td>
                  <td><CellContent cell={row.emailFwd} barsVisible={barsVisible} /></td>
                  <td><CellContent cell={row.localSend} barsVisible={barsVisible} /></td>
                  <td className={styles.lygaCol}>
                    <CellContent cell={row.lyga} isLyga barsVisible={barsVisible} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
