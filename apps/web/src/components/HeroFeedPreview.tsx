'use client';

import { useState } from 'react';
import { FileArchive, Film, Image as ImageIcon, Link2, Lock, QrCode } from 'lucide-react';
import styles from './HeroFeedPreview.module.css';

type FeedTab = 'all' | 'media' | 'links' | 'files';

interface SampleItem {
  id: string;
  name: string;
  meta: string;
  category: Exclude<FeedTab, 'all'>;
  action: string;
}

const SAMPLE_ITEMS: SampleItem[] = [
  {
    id: '1',
    name: 'IMG_4021.MOV',
    meta: '1.4 GB, 4K video',
    category: 'media',
    action: 'Download',
  },
  {
    id: '2',
    name: 'DSC08812.ARW',
    meta: '42 MB, RAW photo',
    category: 'media',
    action: 'Download',
  },
  {
    id: '3',
    name: 'figma.com/file/lyga-cut',
    meta: 'Design review link',
    category: 'links',
    action: 'Copy',
  },
  {
    id: '4',
    name: 'release-v2.zip',
    meta: '310 MB, Archive',
    category: 'files',
    action: 'Download',
  },
];

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'media', label: 'Media' },
  { id: 'links', label: 'Links' },
  { id: 'files', label: 'Files' },
];

function ItemIcon({ item }: { item: SampleItem }) {
  if (item.id === '1') return <Film size={16} aria-hidden="true" />;
  if (item.id === '2') return <ImageIcon size={16} aria-hidden="true" />;
  if (item.category === 'links') return <Link2 size={16} aria-hidden="true" />;
  return <FileArchive size={16} aria-hidden="true" />;
}

export function HeroFeedPreview() {
  const [activeTab, setActiveTab] = useState<FeedTab>('all');

  const visibleItems =
    activeTab === 'all'
      ? SAMPLE_ITEMS
      : SAMPLE_ITEMS.filter((item) => item.category === activeTab);

  return (
    <div className={styles.frame} aria-label="Interactive Lyga workspace preview">
      <div className={styles.topBar}>
        <span className={styles.workspaceTitle}>Personal feed</span>
        <span className={styles.encryptedBadge}>
          <Lock size={12} aria-hidden="true" />
          Encrypted
        </span>
      </div>

      <div className={styles.mobilePairedBar}>
        <span>Paired: iPhone 16 to Windows</span>
        <span>2 devices</span>
      </div>

      <div className={styles.body}>
        <div className={styles.qrPanel}>
          <div className={styles.qrBox}>
            <QrCode size={68} strokeWidth={1.6} color="#111827" aria-hidden="true" />
          </div>
          <span className={styles.qrCaption}>Scan to pair phone</span>
          <span className={styles.pairedMeta}>iPhone 16 · Win11</span>
        </div>

        <div className={styles.feedPanel}>
          <div className={styles.tabs} role="tablist" aria-label="Filter sample items">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={styles.items}>
            {visibleItems.map((item) => (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemIcon}>
                    <ItemIcon item={item} />
                  </div>
                  <div className={styles.itemText}>
                    <div className={styles.itemName}>{item.name}</div>
                    <div className={styles.itemMeta}>{item.meta}</div>
                  </div>
                </div>
                <span className={styles.itemAction}>{item.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
