'use client';

import { Accordion } from '@mantine/core';
import { PLANS } from '@/lib/pricingplan';
import styles from './FaqSection.module.css';

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
    question: `What happens to Free files after ${PLANS.free.expiryLabel}?`,
    answer:
      `Free files expire automatically after ${PLANS.free.expiryLabel} to keep storage lean. Text, links, and code snippets stay, and ${PLANS.pro.shortName} keeps files in a ${PLANS.pro.maxStorageLabel} persistent vault.`,
  },
  {
    value: 'billing',
    question: 'Will I be charged today for the Founder Spot?',
    answer:
      'No. Entering your email reserves the £5/mo Early Bird rate for when Pro launches. No card is collected today.',
  },
];

export function FaqSection() {
  return (
    <section id="faq" className={styles.section}>
      <h2 className={styles.heading}>Questions</h2>
      <div className={styles.accordion}>
        <Accordion variant="separated" radius={0}>
          {FAQS.map((item) => (
            <Accordion.Item key={item.value} value={item.value}>
              <Accordion.Control>{item.question}</Accordion.Control>
              <Accordion.Panel>{item.answer}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
