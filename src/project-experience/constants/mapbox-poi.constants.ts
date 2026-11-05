import { ProjectLocationCategory } from '../types/project-location.enums';

/**
 * Marketing category → one Mapbox Search Box canonical ID.
 * One ID per category keeps discover under free-tier rate limits
 * (was ~20 parallel calls → HTTP 429).
 * @see https://docs.mapbox.com/api/search/search-box/#category-search
 */
export const MAPBOX_CATEGORY_IDS: Readonly<
  Record<ProjectLocationCategory, readonly string[]>
> = {
  [ProjectLocationCategory.hospital]: ['health_services'],
  [ProjectLocationCategory.education]: ['education'],
  [ProjectLocationCategory.shopping]: ['shopping'],
  [ProjectLocationCategory.tourism]: ['tourist_attraction'],
  [ProjectLocationCategory.nature]: ['park'],
  [ProjectLocationCategory.transport]: ['transportation'],
  [ProjectLocationCategory.road]: [],
  [ProjectLocationCategory.town]: ['place'],
  [ProjectLocationCategory.services]: ['services'],
  [ProjectLocationCategory.other]: [],
};

export const MAPBOX_ATTRIBUTION =
  '© Mapbox and its suppliers. All rights reserved. Use of this data is subject to the Mapbox Terms of Service.';

export const MAPBOX_SEARCH_BOX_CATEGORY_URL =
  'https://api.mapbox.com/search/searchbox/v1/category';

export const MAPBOX_CATEGORY_LIMIT = 25;

export const DEFAULT_MAPBOX_TIMEOUT_MS = 15_000;

/** Sequential discover only — Mapbox free tier 429s under parallel bursts. */
export const MAPBOX_DISCOVER_CONCURRENCY = 1;

/** Pause between category requests (ms). */
export const MAPBOX_REQUEST_GAP_MS = 250;

/** Extra wait before a single 429 retry (ms). */
export const MAPBOX_RATE_LIMIT_RETRY_MS = 1_200;

export const METERS_PER_DEGREE_LAT = 111_320;

export const MAPBOX_RADIUS_DEG_MIN = 0.000_01;

export const MAPBOX_RADIUS_DEG_MAX = 10;
