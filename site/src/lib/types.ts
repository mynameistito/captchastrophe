export const CAPABILITIES = ['camera', 'microphone', 'motion', 'fullscreen', 'audio'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export type EntryStatus = 'accepted' | 'pre-review';

/** One row of data/index.json after validation. `concept` is deliberately dropped: it is for similarity checks only. */
export interface Entry {
  id: string;
  title: string;
  description: string;
  /** GitHub login, attribution only. */
  author: string;
  capabilities: Capability[];
  status: EntryStatus;
  prNumber?: number;
  addedAt: string;
  sourceUrl?: string;
}

export interface SiteIndex {
  generatedAt?: string;
  entries: Entry[];
  /** Rows that failed validation and were left out. */
  skipped: number;
}

export type SortKey = 'top' | 'trending' | 'recent';
export type Theme = 'light' | 'dark';
