'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button, Loader } from '@mantine/core';
import {
  ArrowDownToLine,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  LayoutGrid,
  Link2,
  List,
  Minus,
  Pencil,
  Pin,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { DarkFileBadge } from '@/components/mvp/DarkFileBadge';
import {
  formatBytes,
  formatTime,
  getFileExtension,
  getLinkPreviewInfo,
  getPreviewKind,
  type DecryptedFeedItem,
  type DeviceOption,
  type TabFilter,
} from '@/lib/mvp/feed-selectors';
import styles from '@/app/app/Workspace.module.css';

interface WorkspaceCategoryViewProps {
  filter: TabFilter;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  deviceFilter: string;
  setDeviceFilter: (v: string) => void;
  sortBy: 'newest' | 'oldest' | 'largest';
  setSortBy: (v: 'newest' | 'oldest' | 'largest') => void;
  mediaView: 'grid' | 'list';
  setMediaView: (v: 'grid' | 'list') => void;
  categoryGroups: Array<{ label: string; items: DecryptedFeedItem[] }>;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  toggleSelect: (id: string) => void;
  deviceOptions: DeviceOption[];
  deviceOptionMap: Map<string, DeviceOption>;
  deviceId: string | null;
  myDeviceName: string;
  previewUrls: Record<string, string>;
  pinnedIds: string[];
  togglePin: (id: string) => void;
  downloadingId: string | null;
  copiedId: string | null;
  onCopyText: (id: string, value: string) => void;
  onPreview: (item: DecryptedFeedItem) => void;
  onDownload: (item: DecryptedFeedItem) => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
  onEditItem: (item: DecryptedFeedItem) => void;
  onDeleteItem: (id: string) => void;
}

export function WorkspaceCategoryView({
  filter,
  searchQuery,
  setSearchQuery,
  deviceFilter,
  setDeviceFilter,
  sortBy,
  setSortBy,
  mediaView,
  setMediaView,
  categoryGroups,
  selectedIds,
  setSelectedIds,
  toggleSelect,
  deviceOptions,
  deviceOptionMap,
  deviceId,
  myDeviceName,
  previewUrls,
  pinnedIds,
  togglePin,
  downloadingId,
  copiedId,
  onCopyText,
  onPreview,
  onDownload,
  onBulkDownload,
  onBulkDelete,
  onEditItem,
  onDeleteItem,
}: WorkspaceCategoryViewProps) {
  const visibleIds = Array.from(
    new Set(categoryGroups.flatMap((g) => g.items.map((it) => it.raw.id)))
  );
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someSelected = !allSelected && visibleIds.some((id) => selectedIds.includes(id));

  return (
    <div className={styles.categoryView}>
      <div className={styles.categoryToolbar}>
        <div className={styles.searchBox}>
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search workspace items"
            className={styles.searchInput}
            placeholder={`Search ${
              filter === 'text'
                ? 'notes'
                : filter === 'media'
                  ? 'media'
                  : filter === 'link'
                    ? 'links'
                    : filter === 'code'
                      ? 'code'
                      : 'files'
            }…`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>

        <div className={styles.toolbarFilters}>
          <div className={styles.deviceFilterRow} role="group" aria-label="Filter by device">
            <button
              type="button"
              className={`${styles.masterCheckPill} ${
                allSelected || someSelected ? styles.masterCheckPillActive : ''
              }`}
              aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
              aria-pressed={allSelected}
              disabled={visibleIds.length === 0}
              onClick={() => {
                if (allSelected) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(visibleIds);
                }
              }}
            >
              <span
                className={`${styles.itemCheckbox} ${
                  allSelected ? styles.itemCheckboxChecked : ''
                } ${someSelected ? styles.itemCheckboxIndeterminate : ''}`}
                aria-hidden="true"
              >
                {allSelected ? (
                  <Check size={11} strokeWidth={3} />
                ) : someSelected ? (
                  <Minus size={11} strokeWidth={3} />
                ) : null}
              </span>
              <span>{someSelected ? `${selectedIds.length}` : 'All'}</span>
            </button>
            <button
              type="button"
              className={`${styles.devicePill} ${
                deviceFilter === 'all' ? styles.devicePillActive : ''
              }`}
              onClick={() => setDeviceFilter('all')}
            >
              All devices
            </button>
            {deviceOptions.map((dev) => (
              <button
                key={dev.id}
                type="button"
                className={`${styles.devicePill} ${
                  deviceFilter === dev.id ? styles.devicePillActive : ''
                }`}
                onClick={() => setDeviceFilter(dev.id)}
              >
                <span
                  className={styles.deviceDot}
                  style={{ backgroundColor: dev.dotColor }}
                  aria-hidden="true"
                />
                <span>{dev.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.sortRow} role="group" aria-label="Sort items">
            {(
              [
                ['newest', 'Newest'],
                ['oldest', 'Oldest'],
                ...(filter === 'file' || filter === 'media'
                  ? ([['largest', 'Largest']] as const)
                  : []),
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.sortBtn} ${sortBy === key ? styles.sortBtnActive : ''}`}
                onClick={() => setSortBy(key)}
              >
                {label}
              </button>
            ))}
            {filter === 'media' && (
              <div className={styles.viewSwitchGroup} role="group" aria-label="Media layout">
                <button
                  type="button"
                  className={`${styles.viewSwitchBtn} ${
                    mediaView === 'grid' ? styles.viewSwitchBtnActive : ''
                  }`}
                  aria-label="Grid view"
                  aria-pressed={mediaView === 'grid'}
                  title="Grid view"
                  onClick={() => setMediaView('grid')}
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  type="button"
                  className={`${styles.viewSwitchBtn} ${
                    mediaView === 'list' ? styles.viewSwitchBtnActive : ''
                  }`}
                  aria-label="List view"
                  aria-pressed={mediaView === 'list'}
                  title="List view"
                  onClick={() => setMediaView('list')}
                >
                  <List size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className={styles.bulkBar}>
            <span className={styles.bulkCount}>{selectedIds.length} selected</span>
            <div className={styles.bulkActions}>
              {(filter === 'file' || filter === 'media') && (
                <button
                  type="button"
                  className={styles.previewBtn}
                  onClick={onBulkDownload}
                >
                  <ArrowDownToLine size={13} />
                  <span>Save</span>
                </button>
              )}
              <button
                type="button"
                className={styles.bulkDeleteBtn}
                onClick={onBulkDelete}
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
              <button
                type="button"
                className={styles.actionIconBtn}
                aria-label="Clear selection"
                title="Clear selection"
                onClick={() => setSelectedIds([])}
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {categoryGroups.length === 0 ? (
        <div className={styles.emptyThread}>
          <div>No matching items in this category.</div>
          {(searchQuery || deviceFilter !== 'all') && (
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                setSearchQuery('');
                setDeviceFilter('all');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        categoryGroups.map((group) => (
          <div key={group.label} className={styles.dateGroup}>
            <div className={styles.dateGroupLabel}>{group.label}</div>
            {filter === 'media' && mediaView === 'grid' ? (
              <div className={styles.mediaGrid}>
                {group.items.map((item) => {
                  const thumbUrl = previewUrls[item.raw.id];
                  const ext = getFileExtension(item.meta.fileName || item.meta.title);
                  const isSelected = selectedIds.includes(item.raw.id);
                  const isPinned = pinnedIds.includes(item.raw.id);
                  return (
                    <div
                      key={item.raw.id}
                      className={`${styles.mediaTile} ${
                        isSelected ? styles.mediaTileSelected : ''
                      }`}
                    >
                      <button
                        type="button"
                        className={`${styles.tileCheckBtn} ${
                          isSelected ? styles.tileCheckBtnSelected : ''
                        }`}
                        aria-label={
                          isSelected
                            ? `Deselect ${item.meta.fileName || item.meta.title}`
                            : `Select ${item.meta.fileName || item.meta.title}`
                        }
                        aria-pressed={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.raw.id);
                        }}
                      >
                        <span
                          className={`${styles.itemCheckbox} ${styles.itemCheckboxRound} ${
                            isSelected ? styles.itemCheckboxChecked : ''
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected ? <Check size={11} strokeWidth={3} /> : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={styles.mediaTilePreview}
                        onClick={() => onPreview(item)}
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={item.meta.fileName || item.meta.title}
                            className={styles.mediaTileImg}
                          />
                        ) : (
                          <div className={styles.mediaTileFallback}>
                            <DarkFileBadge ext={ext} />
                          </div>
                        )}
                      </button>
                      <div className={styles.mediaTileBar}>
                        <span className={styles.mediaTileName}>
                          {item.meta.fileName || item.meta.title}
                        </span>
                        <div className={styles.mediaTileBtns}>
                          <button
                            type="button"
                            className={`${styles.actionIconBtn} ${
                              isPinned ? styles.pinActiveBtn : ''
                            }`}
                            aria-label={isPinned ? 'Unpin' : 'Pin'}
                            onClick={() => togglePin(item.raw.id)}
                          >
                            <Pin size={13} />
                          </button>
                          <button
                            type="button"
                            className={styles.actionIconBtn}
                            aria-label="Save"
                            onClick={() => onDownload(item)}
                          >
                            <ArrowDownToLine size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.groupCard}>
                {group.items.map((item) => {
                  const kind = item.raw.kind;
                  const isFile = kind === 'media' || kind === 'file';
                  const isSelf =
                    !item.meta.senderDeviceId || item.meta.senderDeviceId === deviceId;
                  const senderId = item.meta.senderDeviceId ?? deviceId ?? '';
                  const senderOpt = deviceOptionMap.get(senderId);
                  const senderName = isSelf
                    ? myDeviceName
                    : senderOpt?.label || item.meta.senderLabel || 'Paired device';
                  const dotColor = senderOpt?.dotColor ?? '#7dd3fc';
                  const copyValue = item.bodyText ?? item.meta.title;
                  const ext = getFileExtension(item.meta.fileName || item.meta.title);
                  const isDownloading = downloadingId === item.raw.id;
                  const pKind = isFile ? getPreviewKind(item) : null;
                  const thumbUrl = isFile ? previewUrls[item.raw.id] : undefined;
                  const linkInfo =
                    kind === 'link' && item.bodyText ? getLinkPreviewInfo(item.bodyText) : null;
                  const isSelected = selectedIds.includes(item.raw.id);

                  return (
                    <div
                      key={item.raw.id}
                      className={`${styles.groupRow} ${isSelected ? styles.groupRowSelected : ''}`}
                    >
                      <div className={styles.groupRowLeft}>
                        <button
                          type="button"
                          className={styles.rowCheckBtn}
                          aria-label={
                            isSelected
                              ? `Deselect ${item.meta.title || 'item'}`
                              : `Select ${item.meta.title || 'item'}`
                          }
                          aria-pressed={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(item.raw.id);
                          }}
                        >
                          <span
                            className={`${styles.itemCheckbox} ${
                              isSelected ? styles.itemCheckboxChecked : ''
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected ? <Check size={11} strokeWidth={3} /> : null}
                          </span>
                        </button>
                        {isFile ? (
                          thumbUrl ? (
                            <button
                              type="button"
                              className={styles.thumbBtn}
                              aria-label={`Preview ${item.meta.fileName || item.meta.title}`}
                              onClick={() => onPreview(item)}
                            >
                              <img
                                src={thumbUrl}
                                alt={item.meta.fileName || item.meta.title}
                                className={styles.thumbImg}
                              />
                            </button>
                          ) : (
                            <div className={styles.fileIconWrap} aria-hidden="true">
                              <DarkFileBadge ext={ext} />
                            </div>
                          )
                        ) : linkInfo?.youtubeThumbUrl ? (
                          <a
                            href={linkInfo.safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.linkThumbWrap}
                          >
                            <img
                              src={linkInfo.youtubeThumbUrl}
                              alt={linkInfo.hostname}
                              className={styles.thumbImg}
                            />
                          </a>
                        ) : linkInfo ? (
                          <div className={styles.groupRowIcon} aria-hidden="true">
                            <img
                              src={linkInfo.faviconUrl}
                              alt=""
                              className={styles.linkFavicon}
                            />
                          </div>
                        ) : (
                          <div className={styles.groupRowIcon} aria-hidden="true">
                            {kind === 'link' && <Link2 size={16} />}
                            {kind === 'code' && <Code2 size={16} />}
                            {kind === 'text' && <StickyNote size={16} />}
                          </div>
                        )}

                        <div className={styles.groupRowBody}>
                          {kind === 'link' && item.bodyText ? (
                            <>
                              {linkInfo && (
                                <div className={styles.linkHost}>{linkInfo.hostname}</div>
                              )}
                              {linkInfo ? (
                                <a
                                  href={linkInfo.safeHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.groupRowLink}
                                >
                                  {item.bodyText}
                                </a>
                              ) : (
                                <span className={styles.groupRowTitle}>{item.bodyText}</span>
                              )}
                            </>
                          ) : (
                            <div className={styles.groupRowTitle}>
                              {isFile
                                ? item.meta.fileName || item.meta.title
                                : item.bodyText || item.meta.title}
                            </div>
                          )}

                          <div className={styles.groupRowMeta}>
                            <span className={styles.groupDeviceTag}>
                              <span
                                className={styles.deviceDot}
                                style={{ backgroundColor: dotColor }}
                                aria-hidden="true"
                              />
                              <span>{senderName}</span>
                            </span>
                            {isFile && <span>{formatBytes(item.raw.size_bytes)}</span>}
                            <span>{formatTime(item.raw.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.groupRowActions}>
                        {isFile && pKind && (
                          <button
                            type="button"
                            className={styles.previewBtn}
                            aria-label={`Preview ${item.meta.fileName || item.meta.title}`}
                            onClick={() => onPreview(item)}
                          >
                            <Eye size={13} aria-hidden="true" />
                            <span>Preview</span>
                          </button>
                        )}
                        {kind === 'link' && item.bodyText && linkInfo?.youtubeEmbedUrl && (
                          <button
                            type="button"
                            className={styles.previewBtn}
                            aria-label="Watch video preview"
                            onClick={() => onPreview(item)}
                          >
                            <Eye size={13} aria-hidden="true" />
                            <span>Preview</span>
                          </button>
                        )}
                        {kind === 'link' && linkInfo && (
                          <a
                            href={linkInfo.safeHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.previewBtn}
                            aria-label="Open link"
                          >
                            <ExternalLink size={13} aria-hidden="true" />
                            <span>Open</span>
                          </a>
                        )}
                        {isFile ? (
                          <button
                            type="button"
                            className={styles.saveBtnIn}
                            disabled={isDownloading}
                            onClick={() => onDownload(item)}
                          >
                            {isDownloading ? (
                              <Loader size={12} color="currentColor" />
                            ) : (
                              <ArrowDownToLine
                                size={14}
                                strokeWidth={2.2}
                                aria-hidden="true"
                              />
                            )}
                            <span>{isDownloading ? 'Saving…' : 'Save'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.copyRowBtn}
                            onClick={() => onCopyText(item.raw.id, copyValue)}
                          >
                            {copiedId === item.raw.id ? <Check size={13} /> : <Copy size={13} />}
                            <span>{copiedId === item.raw.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className={`${styles.actionIconBtn} ${
                            pinnedIds.includes(item.raw.id) ? styles.pinActiveBtn : ''
                          }`}
                          aria-label={pinnedIds.includes(item.raw.id) ? 'Unpin item' : 'Pin item'}
                          onClick={() => togglePin(item.raw.id)}
                        >
                          <Pin size={14} />
                        </button>
                        {(kind === 'text' || kind === 'code') && item.bodyText && (
                          <button
                            type="button"
                            className={styles.actionIconBtn}
                            aria-label="Edit item"
                            onClick={() => onEditItem(item)}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${styles.actionIconBtn} ${styles.actionDeleteBtn}`}
                          aria-label="Delete item"
                          onClick={() => onDeleteItem(item.raw.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
