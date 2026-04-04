import { NextRequest } from 'next/server';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  ALL_RATING_PREFERENCES,
  RATING_PROVIDER_OPTIONS,
  normalizeRatingPreference,
  parseRatingPreferencesAllowEmpty,
  type RatingPreference,
} from '@/lib/ratingPreferences';
import {
  DEFAULT_BACKDROP_RATING_LAYOUT,
  isVerticalBackdropRatingLayout,
  normalizeBackdropRatingLayout,
  type BackdropRatingLayout,
} from '@/lib/backdropRatingLayout';
import {
  DEFAULT_THUMBNAIL_RATING_LAYOUT,
  isVerticalThumbnailRatingLayout,
  normalizeThumbnailRatingLayout,
  type ThumbnailRatingLayout,
} from '@/lib/thumbnailRatingLayout';
import {
  normalizeThumbnailSize,
  type ThumbnailSize,
} from '@/lib/thumbnailSize';
import {
  normalizeBackdropRatingsSize,
  type BackdropRatingsSize,
} from '@/lib/backdropRatingsSize';
import {
  DEFAULT_POSTER_RATINGS_MAX_PER_SIDE,
  DEFAULT_POSTER_RATING_LAYOUT,
  getPosterRatingLayoutMaxBadges,
  getPosterRatingLayoutLimit,
  isVerticalPosterRatingLayout,
  normalizePosterRatingLayout,
  normalizePosterRatingsMaxPerSide,
  type PosterRatingLayout,
} from '@/lib/posterRatingLayout';
import { normalizeLogoRatingsMax } from '@/lib/logoRatingsMax';
import { DEFAULT_LOGO_MODE, normalizeLogoMode, type LogoMode } from '@/lib/logoMode';
import { DEFAULT_LOGO_FONT_VARIANT, normalizeLogoFontVariant, type LogoFontVariant } from '@/lib/logoFontVariant';
import {
  DEFAULT_LOGO_CUSTOM_PRIMARY,
  DEFAULT_LOGO_CUSTOM_OUTLINE,
  DEFAULT_LOGO_CUSTOM_SECONDARY,
  normalizeHexColor,
} from '@/lib/logoCustomColors';
import {
  DEFAULT_RATING_STYLE,
  normalizeRatingStyle,
  type RatingStyle,
} from '@/lib/ratingStyle';
import {
  buildIncludeImageLanguage,
  getTmdbLanguageBase,
  normalizeTmdbLanguageCode,
} from '@/lib/tmdbLanguage';
import { findImdbEpisodeBySeriesSeasonEpisode, getImdbEpisodeFromDataset, getImdbRatingFromDataset } from '@/lib/imdbDataset';
import { scheduleImdbDatasetSync } from '@/lib/imdbDatasetSync';
// Removed mdblistRequestLogs import

import {
  buildObjectStorageImageKey,
  buildObjectStorageSourceImageKey,
  getCachedImageFromObjectStorage,
  isObjectStorageConfigured,
  putCachedImageToObjectStorage,
} from '@/lib/objectStorage';
import { getMetadata, setMetadata } from '@/lib/metadataCache';
import { fetchWithRetry } from '@/lib/request';
import { buildPublicImageCacheControl } from '@/lib/imageCacheTtl';
import { getTokenConfig } from '@/lib/tokens';

export const runtime = 'nodejs';

type PosterTextPreference = 'default' | 'clean' | 'alternative';
type RenderImageType = 'poster' | 'backdrop' | 'logo' | 'thumbnail';
type AnimeMappingProvider = 'mal' | 'anilist' | 'imdb' | 'tmdb' | 'anidb';
type AiometadataEpisodeProvider = 'tvdb' | 'realimdb';
type StreamBadgeKey = '4k' | 'hdr' | 'dolbyvision' | 'dolbyatmos' | 'remux';
type BadgeKey = RatingPreference | StreamBadgeKey;
type QualityBadgesSide = 'left' | 'right';
type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
type StreamQualityFlags = {
  has4k: boolean;
  hasHdr: boolean;
  hasDolbyVision: boolean;
  hasDolbyAtmos: boolean;
  hasRemux: boolean;
};
const FALLBACK_IMAGE_LANGUAGE = 'en';
const ALLOWED_IMAGE_TYPES = new Set<RenderImageType>(['poster', 'backdrop', 'logo', 'thumbnail']);
const isRenderImageType = (value: string): value is RenderImageType =>
  ALLOWED_IMAGE_TYPES.has(value as RenderImageType);
const ANIME_MAPPING_PROVIDER_SET = new Set<AnimeMappingProvider>([
  'mal',
  'anilist',
  'imdb',
  'tmdb',
  'anidb',
]);
const AIOMETADATA_EPISODE_PROVIDER_SET = new Set<AiometadataEpisodeProvider>(['tvdb', 'realimdb']);
const ANIME_NATIVE_INPUT_ID_PREFIX_SET = new Set(['kitsu', 'mal', 'anilist', 'anidb']);
const parseApiKeyList = (...values: Array<string | undefined>) => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    for (const candidate of (value || '').split(/[\s,;]+/)) {
      const normalized = candidate.trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
};
const toAnimeMappingProvider = (value?: string | null): AnimeMappingProvider | null => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  return ANIME_MAPPING_PROVIDER_SET.has(normalized as AnimeMappingProvider)
    ? (normalized as AnimeMappingProvider)
    : null;
};
const normalizeAiometadataEpisodeProvider = (value?: string | null): AiometadataEpisodeProvider | null => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  return AIOMETADATA_EPISODE_PROVIDER_SET.has(normalized as AiometadataEpisodeProvider)
    ? (normalized as AiometadataEpisodeProvider)
    : null;
};
const parseCacheTtlMs = (value: string | undefined, fallbackMs: number, minMs: number, maxMs: number) => {
  if (!value) return fallbackMs;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.min(maxMs, Math.max(minMs, parsed));
};
const parseNonNegativeInt = (value?: string | null, max = Number.MAX_SAFE_INTEGER) => {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(max, Math.floor(parsed));
};
const getTmdbLanguageFallbackChain = (requestedLanguage?: string | null, fallbackLanguage: string = FALLBACK_IMAGE_LANGUAGE) => {
  const requested = normalizeTmdbLanguageCode(requestedLanguage);
  const requestedBase = getTmdbLanguageBase(requested);
  const fallback = normalizeTmdbLanguageCode(fallbackLanguage);
  const fallbackBase = getTmdbLanguageBase(fallback);

  return [...new Set([requested, requestedBase, fallback, fallbackBase].filter(Boolean) as string[])];
};
const isOriginalLanguageSetting = (value?: string | null) =>
  String(value || '').trim().toLowerCase() === 'original';

const resolveRequestedImageLanguage = (input: {
  configuredLanguage?: string | null;
  requestLanguage?: string | null;
  fallbackLanguage: string;
}) =>
  normalizeTmdbLanguageCode(
    isOriginalLanguageSetting(input.configuredLanguage)
      ? input.requestLanguage
      : input.configuredLanguage || input.requestLanguage
  ) || input.fallbackLanguage;

const resolveOriginalAwareImageLanguage = (input: {
  configuredLanguage?: string | null;
  requestLanguage?: string | null;
  mediaOriginalLanguage?: string | null;
  fallbackLanguage: string;
}) =>
  normalizeTmdbLanguageCode(
    isOriginalLanguageSetting(input.configuredLanguage) && input.mediaOriginalLanguage
      ? input.mediaOriginalLanguage
      : input.configuredLanguage || input.requestLanguage
  ) ||
  normalizeTmdbLanguageCode(input.requestLanguage) ||
  input.fallbackLanguage;
const FINAL_IMAGE_RENDERER_CACHE_VERSION = 'poster-backdrop-logo-thumbnail-v63';
const TMDB_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_TMDB_CACHE_TTL_MS,
  3 * 24 * 60 * 60 * 1000,
  10 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
);
const MDBLIST_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_MDBLIST_CACHE_TTL_MS,
  3 * 24 * 60 * 60 * 1000,
  10 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
);
const MDBLIST_OLD_MOVIE_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
  7 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
);
const MDBLIST_OLD_MOVIE_AGE_DAYS = (() => {
  const rawValue = Number(process.env.ERDB_MDBLIST_OLD_MOVIE_AGE_DAYS);
  if (!Number.isFinite(rawValue) || rawValue <= 0) return 365;
  return Math.min(3650, Math.max(30, Math.floor(rawValue)));
})();
const MDBLIST_RATE_LIMIT_COOLDOWN_MS = parseCacheTtlMs(
  process.env.ERDB_MDBLIST_RATE_LIMIT_COOLDOWN_MS,
  24 * 60 * 60 * 1000,
  30 * 1000,
  7 * 24 * 60 * 60 * 1000
);
const IMDB_DATASET_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_IMDB_DATASET_CACHE_TTL_MS,
  7 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000,
  365 * 24 * 60 * 60 * 1000
);
const KITSU_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_KITSU_CACHE_TTL_MS,
  3 * 24 * 60 * 60 * 1000,
  10 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
);
const SIMKL_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_SIMKL_CACHE_TTL_MS,
  3 * 24 * 60 * 60 * 1000,
  10 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
);
const STREAM_BADGES_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_TORRENTIO_CACHE_TTL_MS,
  6 * 60 * 60 * 1000,
  10 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000
);
const STREAM_BADGES_PROVIDER_BASE_URL = (
  process.env.ERDB_STREAM_BADGES_PROVIDER_URL || 'https://corsaro.stremio.dpdns.org/eyJ0bWRiX2tleSI6IjU0NjJmNzg0NjlmM2Q4MGJmNTIwMTY0NTI5NGMxNmU0IiwidXNlX2NvcnNhcm9uZXJvIjp0cnVlLCJ1c2VfdWluZGV4IjpmYWxzZSwidXNlX2tuYWJlbiI6dHJ1ZSwidXNlX3RvcnJlbnRnYWxheHkiOmZhbHNlLCJ1c2VfdG9ycmVudGlvIjp0cnVlLCJ1c2VfbWVkaWFmdXNpb24iOnRydWUsInVzZV9jb21ldCI6dHJ1ZSwidXNlX3N0cmVtdGhydV90b3J6Ijp0cnVlLCJ1c2VfcmFyYmciOnRydWUsImZ1bGxfaXRhIjpmYWxzZSwiZGJfb25seSI6ZmFsc2UsInVzZV9nbG9iYWxfY2FjaGUiOmZhbHNlLCJvbmx5X2RlYnJpZF9jYWNoZSI6ZmFsc2UsImh5YnJpZF9tb2RlIjp0cnVlfQ/manifest.json'
)
  .trim()
  .replace(/\/manifest\.json$/i, '')
  .replace(/\/+$/, '');
const PROVIDER_ICON_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_PROVIDER_ICON_CACHE_TTL_MS,
  7 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000,
  30 * 24 * 60 * 60 * 1000
);
const GENERATED_LOGO_VARIANT_CACHE_TTL_MS = parseCacheTtlMs(
  process.env.ERDB_GENERATED_LOGO_CACHE_TTL_MS,
  30 * 24 * 60 * 60 * 1000,
  60 * 60 * 1000,
  365 * 24 * 60 * 60 * 1000
);
const FINAL_IMAGE_CACHE_MAX_ENTRIES = 300;
const SOURCE_IMAGE_CACHE_MAX_ENTRIES = 128;
const METADATA_CACHE_MAX_ENTRIES = 2000;
const PROVIDER_ICON_CACHE_MAX_ENTRIES = 64;
const GENERATED_LOGO_VARIANT_CACHE_MAX_ENTRIES = 256;
const TMDB_ANIMATION_GENRE_ID = 16;
const MDBLIST_API_KEYS = parseApiKeyList(process.env.MDBLIST_API_KEYS, process.env.MDBLIST_API_KEY);
const SIMKL_CLIENT_ID =
  process.env.SIMKL_CLIENT_ID ||
  process.env.SIMKL_API_KEY ||
  process.env.ERDB_SIMKL_CLIENT_ID ||
  '';
type TimedCacheEntry<T> = {
  value: T;
  expiresAt: number;
  lastAccessedAt: number;
};
type CachedJsonResponse = {
  ok: boolean;
  status: number;
  data: any;
};
type CachedTextResponse = {
  ok: boolean;
  status: number;
  data: string | null;
};
type CachedJsonNetworkObserver = {
  onNetworkResponse?: (input: {
    key: string;
    url: string;
    status: number;
    ok: boolean;
    data: any;
    durationMs: number;
  }) => Promise<void> | void;
  onNetworkError?: (input: {
    key: string;
    url: string;
    errorMessage: string;
    durationMs: number;
  }) => Promise<void> | void;
};
type StreamBadgesCache = {
  flags: StreamQualityFlags;
};
type StreamBadgesResult = {
  badges: RatingBadge[];
  cacheTtlMs: number;
};
type RenderedImagePayload = {
  body: ArrayBuffer;
  contentType: string;
  cacheControl: string;
};
type PhaseDurations = {
  auth: number;
  tmdb: number;
  mdb: number;
  stream: number;
  render: number;
};
class HttpError extends Error {
  status: number;
  headers?: HeadersInit;

  constructor(message: string, status: number, headers?: HeadersInit) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}
const finalImageInFlight = new Map<string, Promise<RenderedImagePayload>>();
const sourceImageInFlight = new Map<string, Promise<RenderedImagePayload>>();
const metadataInFlight = new Map<string, Promise<CachedJsonResponse>>();
const providerIconInFlight = new Map<string, Promise<string | null>>();
const streamBadgesInFlight = new Map<string, Promise<StreamBadgesResult>>();
const mdbListRateLimitedUntil = new Map<string, number>();
const generatedLogoVariantCache = new Map<string, { dataUrl: string; aspectRatio: number }>();
const generatedLogoVariantInFlight = new Map<string, Promise<{ dataUrl: string; aspectRatio: number }>>();
let mdbListApiKeyCursor = 0;
const sha1Hex = (value: string) => createHash('sha1').update(value).digest('hex');
const buildSecretCacheSeed = (name: string, value?: string | null) => {
  const normalized = String(value || '').trim();
  return normalized ? `${name}:${sha1Hex(normalized).slice(0, 12)}` : `${name}:none`;
};
const buildMdbListCacheSeed = (manualApiKey?: string | null) => {
  const normalizedManual = String(manualApiKey || '').trim();
  if (normalizedManual) {
    return `mdblist:manual:${sha1Hex(normalizedManual).slice(0, 12)}`;
  }
  if (!MDBLIST_API_KEYS.length) {
    return 'mdblist:none';
  }
  return `mdblist:pool:${sha1Hex(MDBLIST_API_KEYS.join('|')).slice(0, 12)}`;
};
const safeCompareText = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
};
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isImdbId = (value?: string | null) => {
  if (!value) return false;
  return /^tt\d+$/.test(value.trim());
};
const getDeterministicTtlMs = (baseTtlMs: number, seed: string) => {
  const normalizedSeed = String(seed || '').trim();
  if (!normalizedSeed) return baseTtlMs;

  const jitterWindowMs = Math.min(12 * 60 * 60 * 1000, Math.floor(baseTtlMs * 0.15));
  if (jitterWindowMs <= 0) return baseTtlMs;

  const hashPrefix = sha1Hex(normalizedSeed).slice(0, 8);
  const hashValue = Number.parseInt(hashPrefix, 16);
  if (!Number.isFinite(hashValue)) return baseTtlMs;

  const offsetMs = (hashValue % (jitterWindowMs + 1)) - Math.floor(jitterWindowMs / 2);
  return Math.max(60 * 1000, baseTtlMs + offsetMs);
};
const getCacheTtlMsFromCacheControl = (value: string | null | undefined, fallbackMs: number) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallbackMs;

  const sMaxAgeMatch = normalized.match(/s-maxage=(\d+)/);
  if (sMaxAgeMatch) {
    const ttlSeconds = Number(sMaxAgeMatch[1]);
    if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
      return ttlSeconds * 1000;
    }
  }

  const maxAgeMatch = normalized.match(/max-age=(\d+)/);
  if (maxAgeMatch) {
    const ttlSeconds = Number(maxAgeMatch[1]);
    if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
      return ttlSeconds * 1000;
    }
  }

  return fallbackMs;
};

const getGeneratedLogoVariantCacheKey = (
  title: string,
  logoFontVariant: LogoFontVariant,
  primaryColor: string,
  secondaryColor: string,
  outlineColor: string
) =>
  JSON.stringify({
    title: title.trim(),
    logoFontVariant,
    primaryColor: normalizeHexColor(primaryColor, DEFAULT_LOGO_CUSTOM_PRIMARY),
    secondaryColor: normalizeHexColor(secondaryColor, DEFAULT_LOGO_CUSTOM_SECONDARY),
    outlineColor: normalizeHexColor(outlineColor, DEFAULT_LOGO_CUSTOM_OUTLINE),
  });

const getCachedGeneratedLogoVariant = (cacheKey: string) => {
  const cached = generatedLogoVariantCache.get(cacheKey);
  if (!cached) return null;

  // Refresh insertion order for simple LRU behavior.
  generatedLogoVariantCache.delete(cacheKey);
  generatedLogoVariantCache.set(cacheKey, cached);
  return cached;
};

const setCachedGeneratedLogoVariant = (
  cacheKey: string,
  value: { dataUrl: string; aspectRatio: number }
) => {
  generatedLogoVariantCache.set(cacheKey, value);
  if (generatedLogoVariantCache.size <= GENERATED_LOGO_VARIANT_CACHE_MAX_ENTRIES) {
    return;
  }

  const oldestKey = generatedLogoVariantCache.keys().next().value;
  if (oldestKey) {
    generatedLogoVariantCache.delete(oldestKey);
  }
};



// pruneCache and setCacheEntry removed as we now use metadataCache and objectStorage

const withDedupe = async <T,>(
  inFlightMap: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>
) => {
  const existing = inFlightMap.get(key);
  if (existing) return existing;
  const promise = factory().finally(() => {
    inFlightMap.delete(key);
  });
  inFlightMap.set(key, promise);
  return promise;
};

const measurePhase = async <T,>(phases: PhaseDurations, phase: keyof PhaseDurations, fn: () => Promise<T>) => {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    phases[phase] += performance.now() - start;
  }
};

const buildServerTimingHeader = (phases: PhaseDurations, totalMs: number) => {
  const parts = [
    `auth;dur=${phases.auth.toFixed(1)}`,
    `tmdb;dur=${phases.tmdb.toFixed(1)}`,
    `mdb;dur=${phases.mdb.toFixed(1)}`,
    `stream;dur=${phases.stream.toFixed(1)}`,
    `render;dur=${phases.render.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ];
  return parts.join(', ');
};

const createImageHttpResponse = (
  payload: RenderedImagePayload,
  serverTiming: string,
  cacheStatus: 'hit' | 'miss' | 'shared'
) =>
  new Response(payload.body.slice(0), {
    status: 200,
    headers: {
      'Content-Type': payload.contentType,
      'Cache-Control': payload.cacheControl,
      Vary: 'Accept',
      'Server-Timing': serverTiming,
      'X-ERDB-Cache': cacheStatus,
    },
  });
const PERCENTAGE_RATING_PROVIDERS = new Set<RatingPreference>([
  'mdblist',
  'tomatoes',
  'tomatoesaudience',
  'metacritic',
  'trakt',
  'anilist',
  'kitsu',
]);
const ANIME_ONLY_RATING_PROVIDER_SET = new Set<RatingPreference>(['myanimelist', 'anilist', 'kitsu']);
const SCALE_SUFFIX_RATING_PROVIDERS: Partial<Record<RatingPreference, string>> = {
  tmdb: '/10',
  imdb: '/10',
  metacriticuser: '/10',
  simkl: '/10',
  letterboxd: '/5',
  myanimelist: '/10',
  rogerebert: '/4',
};
type RatingBadge = {
  key: BadgeKey;
  label: string;
  value: string;
  iconUrl: string;
  accentColor: string;
  iconCornerRadius?: number;
  iconScale?: number;
};
type OutputFormat = 'png' | 'jpeg' | 'webp';
const RATING_PROVIDER_META = new Map(
  RATING_PROVIDER_OPTIONS.map((provider) => [provider.id, provider] as const)
);
const STREAM_BADGE_META = new Map<StreamBadgeKey, { label: string; value: string; accentColor: string; iconUrl: string }>([
  [
    '4k',
    {
      label: '4K',
      value: '',
      accentColor: '#f59e0b',
      iconUrl: '',
    },
  ],
  [
    'hdr',
    {
      label: 'HDR',
      value: '',
      accentColor: '#10b981',
      iconUrl: '',
    },
  ],
  [
    'dolbyvision',
    {
      label: 'Dolby Vision',
      value: '',
      accentColor: '#60a5fa',
      iconUrl: '',
    },
  ],
  [
    'dolbyatmos',
    {
      label: 'Dolby Atmos',
      value: '',
      accentColor: '#22d3ee',
      iconUrl: '',
    },
  ],
  [
    'remux',
    {
      label: 'REMUX',
      value: '',
      accentColor: '#ef4444',
      iconUrl: '',
    },
  ],
]);
const STREAM_BADGE_ORDER: StreamBadgeKey[] = ['4k', 'hdr', 'dolbyvision', 'dolbyatmos', 'remux'];
const DEFAULT_QUALITY_BADGES_STYLE: RatingStyle = 'glass';
const LOGO_BASE_HEIGHT = 320;
const LOGO_FALLBACK_ASPECT_RATIO = 2.5;
const LOGO_MIN_WIDTH = 360;
const LOGO_MAX_WIDTH = 3000;


const buildProviderMonogram = (label: string) => {
  const cleaned = label.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  if (!cleaned) return 'R';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

const normalizeStreamBadgesSetting = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'auto';
  if (['1', 'true', 'yes', 'on', 'torrentio'].includes(normalized)) return 'on';
  if (['0', 'false', 'no', 'off', 'none'].includes(normalized)) return 'off';
  return 'auto';
};

const normalizeQualityBadgesSide = (value?: string | null): QualityBadgesSide => {
  const normalized = (value || '').trim().toLowerCase();
  if (['right', 'r', 'end'].includes(normalized)) return 'right';
  return 'left';
};
const normalizePosterQualityBadgesPosition = (value?: string | null): PosterQualityBadgesPosition => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto' || normalized === 'default') return 'auto';
  if (['right', 'r', 'end'].includes(normalized)) return 'right';
  if (['left', 'l', 'start'].includes(normalized)) return 'left';
  return 'auto';
};
const resolvePosterQualityBadgePlacement = (
  layout: PosterRatingLayout,
  qualityBadgesSide: QualityBadgesSide,
  posterQualityBadgesPosition: PosterQualityBadgesPosition
): 'top' | 'bottom' | QualityBadgesSide => {
  if (layout === 'left' || layout === 'right' || layout === 'left-right') {
    return 'bottom';
  }
  if (layout === 'top-bottom') {
    return qualityBadgesSide;
  }
  if (layout === 'top') {
    return posterQualityBadgesPosition === 'auto' ? 'bottom' : posterQualityBadgesPosition;
  }
  if (layout === 'bottom') {
    return posterQualityBadgesPosition === 'auto' ? 'top' : posterQualityBadgesPosition;
  }
  return qualityBadgesSide;
};

const normalizeQualityBadgesStyle = (value?: string | null): RatingStyle => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'glass' || normalized === 'square' || normalized === 'plain') {
    return normalized;
  }
  return DEFAULT_QUALITY_BADGES_STYLE;
};

const createEmptyStreamFlags = (): StreamQualityFlags => ({
  has4k: false,
  hasHdr: false,
  hasDolbyVision: false,
  hasDolbyAtmos: false,
  hasRemux: false,
});

const parseStreamFlagsFromFilename = (filename: string): StreamQualityFlags => {
  const normalized = filename.toUpperCase();
  const hasDolbyVision =
    /\bDOVI\b/.test(normalized) || /\bDV\b/.test(normalized) || /DOLBY\s*VISION/.test(normalized);
  const hasHdr =
    /\bHDR10\+\b/.test(normalized) ||
    /\bHDR10\b/.test(normalized) ||
    /\bHDR\b/.test(normalized) ||
    /\bHLG\b/.test(normalized) ||
    hasDolbyVision;
  const hasDolbyAtmos = /\bATMOS\b/.test(normalized) || /DOLBY\s*ATMOS/.test(normalized);
  const has4k =
    /\b2160P\b/.test(normalized) ||
    /\b2160\b/.test(normalized) ||
    /\b4K\b/.test(normalized) ||
    /\bUHD\b/.test(normalized) ||
    /\bULTRAHD\b/.test(normalized);
  const hasRemux = /\bREMUX\b/.test(normalized);
  return { has4k, hasHdr, hasDolbyVision, hasDolbyAtmos, hasRemux };
};

const mergeStreamFlags = (left: StreamQualityFlags, right: StreamQualityFlags): StreamQualityFlags => ({
  has4k: left.has4k || right.has4k,
  hasHdr: left.hasHdr || right.hasHdr,
  hasDolbyVision: left.hasDolbyVision || right.hasDolbyVision,
  hasDolbyAtmos: left.hasDolbyAtmos || right.hasDolbyAtmos,
  hasRemux: left.hasRemux || right.hasRemux,
});

const extractTorrentioFilenames = (payload: any) => {
  const streams = Array.isArray(payload?.streams) ? payload.streams : [];
  const filenames: string[] = [];
  for (const stream of streams) {
    const filename =
      (typeof stream?.filename === 'string' && stream.filename) ||
      (typeof stream?.behaviorHints?.filename === 'string' && stream.behaviorHints.filename) ||
      (typeof stream?.title === 'string' && stream.title) ||
      (typeof stream?.name === 'string' && stream.name) ||
      '';
    if (filename) filenames.push(filename);
  }
  return filenames;
};

const collectStreamFlags = (filenames: string[]) => {
  let flags = createEmptyStreamFlags();
  for (const filename of filenames) {
    if (!filename) continue;
    flags = mergeStreamFlags(flags, parseStreamFlagsFromFilename(filename));
    if (flags.has4k && flags.hasHdr && flags.hasDolbyVision && flags.hasDolbyAtmos && flags.hasRemux) {
      break;
    }
  }
  return flags;
};

const buildStreamBadgesFromFlags = (flags: StreamQualityFlags): RatingBadge[] => {
  const badges: RatingBadge[] = [];
  const flagMap: Record<StreamBadgeKey, boolean> = {
    '4k': flags.has4k,
    hdr: flags.hasHdr,
    dolbyvision: flags.hasDolbyVision,
    dolbyatmos: flags.hasDolbyAtmos,
    remux: flags.hasRemux,
  };
  for (const key of STREAM_BADGE_ORDER) {
    if (!flagMap[key]) continue;
    const meta = STREAM_BADGE_META.get(key);
    if (!meta) continue;
    badges.push({
      key,
      label: meta.label,
      value: meta.value,
      iconUrl: meta.iconUrl,
      accentColor: meta.accentColor,
    });
  }
  return badges;
};

const buildTorrentioUrl = (type: 'movie' | 'series', id: string) =>
  `${STREAM_BADGES_PROVIDER_BASE_URL}/stream/${type}/${encodeURIComponent(id)}.json`;

const fetchStreamBadges = async (input: {
  type: 'movie' | 'series';
  id: string;
  phases: PhaseDurations;
  cacheTtlMs?: number;
}): Promise<StreamBadgesResult> => {
  const trimmedId = input.id.trim();
  if (!trimmedId) {
    return { badges: [], cacheTtlMs: STREAM_BADGES_CACHE_TTL_MS };
  }
  const cacheKey = `streambadges:${input.type}:${trimmedId}`;
  const ttlMs =
    typeof input.cacheTtlMs === 'number' && Number.isFinite(input.cacheTtlMs) && input.cacheTtlMs > 0
      ? input.cacheTtlMs
      : getDeterministicTtlMs(STREAM_BADGES_CACHE_TTL_MS, cacheKey);
  const cached = getMetadata<StreamBadgesCache>(cacheKey);
  if (cached) {
    return { badges: buildStreamBadgesFromFlags(cached.flags), cacheTtlMs: ttlMs };
  }

  return withDedupe(streamBadgesInFlight, cacheKey, async () => {
    const warm = getMetadata<StreamBadgesCache>(cacheKey);
    if (warm) {
      return { badges: buildStreamBadgesFromFlags(warm.flags), cacheTtlMs: ttlMs };
    }

    let response: Response | null = null;
    try {
      response = await measurePhase(input.phases, 'stream', () =>
        fetchWithRetry(buildTorrentioUrl(input.type, trimmedId), {
          cache: 'no-store',
          timeout: 10000,
        })
      );
    } catch {
      const failureTtl = Math.min(ttlMs, 2 * 60 * 1000);
      setMetadata(cacheKey, { flags: createEmptyStreamFlags() }, failureTtl);
      return { badges: [], cacheTtlMs: failureTtl };
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const flags = collectStreamFlags(extractTorrentioFilenames(payload));
    const targetTtl = response.ok ? ttlMs : Math.min(ttlMs, 2 * 60 * 1000);
    setMetadata(cacheKey, { flags }, targetTtl);
    return { badges: buildStreamBadgesFromFlags(flags), cacheTtlMs: targetTtl };
  });
};

const formatRatingNumber = (value: number) => {
  const rounded = value.toFixed(1);
  return rounded === '10.0' ? '10' : rounded;
};

const formatDisplayRatingValue = (
  provider: RatingPreference,
  baseValue: string,
  imageType?: RenderImageType
) => {
  if (baseValue === 'N/A') return baseValue;

  if (PERCENTAGE_RATING_PROVIDERS.has(provider)) {
    if (imageType === 'poster' || imageType === 'backdrop' || imageType === 'logo' || imageType === 'thumbnail') {
      const numericValue = Number(baseValue.replace('%', '').replace(',', '.').trim());
      if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
        return formatRatingNumber(numericValue / 10);
      }
    }
    return baseValue.endsWith('%') ? baseValue : `${baseValue}%`;
  }

  const suffix = SCALE_SUFFIX_RATING_PROVIDERS[provider];
  if (imageType === 'poster' || imageType === 'backdrop' || imageType === 'logo' || imageType === 'thumbnail') {
    const numericValue = Number(baseValue.replace(',', '.').trim());
    if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
      if (suffix === '/10') return formatRatingNumber(numericValue);
      if (suffix === '/5') return formatRatingNumber(numericValue * 2);
      if (suffix === '/4') return formatRatingNumber(numericValue * 2.5);
    }
  }
  if (suffix && !baseValue.includes('/') && !baseValue.endsWith('%')) {
    return `${baseValue}${suffix}`;
  }

  return baseValue;
};

const shouldRenderRatingValue = (value: string | null | undefined) => {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.toUpperCase() === 'N/A') return false;

  const numericCandidate = normalized
    .replace('%', '')
    .split('/')[0]
    .replace(',', '.')
    .trim();
  const numericValue = Number(numericCandidate);
  if (!Number.isNaN(numericValue) && numericValue === 0) return false;

  return true;
};

const pickOutputFormat = (imageType: RenderImageType, acceptHeader?: string | null): OutputFormat => {
  if (imageType === 'logo') return 'png';
  const accept = (acceptHeader || '').toLowerCase();
  return accept.includes('image/webp') ? 'webp' : 'jpeg';
};

const outputFormatToContentType = (format: OutputFormat) => {
  if (format === 'webp') return 'image/webp';
  if (format === 'jpeg') return 'image/jpeg';
  return 'image/png';
};

const outputFormatToExtension = (format: OutputFormat) => {
  if (format === 'webp') return 'webp';
  if (format === 'jpeg') return 'jpg';
  return 'png';
};

const isTmdbAnimationTitle = (media: any) => {
  const genreIds = Array.isArray(media?.genre_ids) ? media.genre_ids : [];
  if (genreIds.some((genreId: any) => Number(genreId) === TMDB_ANIMATION_GENRE_ID)) {
    return true;
  }

  const genres = Array.isArray(media?.genres) ? media.genres : [];
  return genres.some((genre: any) => {
    if (Number(genre?.id) === TMDB_ANIMATION_GENRE_ID) {
      return true;
    }

    return String(genre?.name || '').trim().toLowerCase() === 'animation';
  });
};

const normalizeRatingValue = (value: unknown): string | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return formatRatingNumber(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = Number(trimmed.replace(',', '.'));
    if (!Number.isNaN(normalized) && Number.isFinite(normalized)) {
      return formatRatingNumber(normalized);
    }
  }

  if (value && typeof value === 'object') {
    const nested = value as { value?: unknown; rating?: unknown; score?: unknown };
    return normalizeRatingValue(nested.value ?? nested.rating ?? nested.score);
  }

  return null;
};

const isNegativeRatingValue = (value: string | null | undefined) => {
  if (!value) return false;
  const numericCandidate = value
    .replace('%', '')
    .split('/')[0]
    .replace(',', '.')
    .trim();
  const numericValue = Number(numericCandidate);
  return !Number.isNaN(numericValue) && numericValue < 0;
};

const collectMDBListRatings = (payload: any) => {
  const result = new Map<RatingPreference, string>();
  const items = payload?.ratings;
  if (!Array.isArray(items)) {
    const directMdbListScore = normalizeRatingValue(
      payload?.score ?? payload?.mdblist_score ?? payload?.mdblist ?? null
    );
    if (directMdbListScore && !isNegativeRatingValue(directMdbListScore)) {
      result.set('mdblist', directMdbListScore);
    }
    return result;
  }

  for (const item of items) {
    const sourceRaw = String(item?.source || item?.name || item?.provider || '');
    const source = normalizeRatingPreference(sourceRaw);
    if (!source || result.has(source)) continue;
    const rating = normalizeRatingValue(item?.value ?? item?.rating ?? item?.score);
    if (rating && !(source === 'mdblist' && isNegativeRatingValue(rating))) {
      result.set(source, rating);
    }
  }

  if (!result.has('mdblist')) {
    const directMdbListScore = normalizeRatingValue(
      payload?.score ?? payload?.mdblist_score ?? payload?.mdblist ?? null
    );
    if (directMdbListScore && !isNegativeRatingValue(directMdbListScore)) {
      result.set('mdblist', directMdbListScore);
    }
  }

  return result;
};

const getMdbListApiKeysInPriorityOrder = () => {
  if (!MDBLIST_API_KEYS.length) return [];

  const now = Date.now();
  const availableKeys = MDBLIST_API_KEYS.filter((apiKey) => {
    const limitedUntil = mdbListRateLimitedUntil.get(apiKey) || 0;
    return limitedUntil <= now;
  });
  const candidates = availableKeys.length ? availableKeys : MDBLIST_API_KEYS;
  const startIndex = mdbListApiKeyCursor % candidates.length;
  mdbListApiKeyCursor = (mdbListApiKeyCursor + 1) % candidates.length;

  return [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)];
};

const markMdbListApiKeyRateLimited = (apiKey: string) => {
  mdbListRateLimitedUntil.set(apiKey, Date.now() + MDBLIST_RATE_LIMIT_COOLDOWN_MS);
};

const getMdbListResponseMessage = (payload: any) =>
  [
    payload?.error,
    payload?.message,
    payload?.detail,
    payload?.description,
    payload?.status_message,
    payload?.response,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();

const isMdbListRateLimitedResponse = (response: CachedJsonResponse) => {
  if (response.status === 429) return true;

  const message = getMdbListResponseMessage(response.data);
  if (!message) return false;

  return ['rate limit', 'too many requests', 'quota', 'limit reached', 'limit exceeded', 'throttle'].some(
    (token) => message.includes(token)
  );
};

const shouldRetryMdbListWithAnotherKey = (response: CachedJsonResponse) => {
  if (isMdbListRateLimitedResponse(response)) return true;
  return response.status === 401 || response.status === 403 || response.status >= 500;
};

const getRatingCacheTtlMs = ({
  id,
  mediaType,
  releaseDate,
  defaultTtlMs,
  oldTtlMs,
}: {
  id: string;
  mediaType: 'movie' | 'tv';
  releaseDate?: string | null;
  defaultTtlMs: number;
  oldTtlMs: number;
}) => {
  let ttlMs = defaultTtlMs;

  if (mediaType === 'movie') {
    const normalizedReleaseDate = String(releaseDate || '').trim();
    if (normalizedReleaseDate) {
      const releaseTimestamp = Date.parse(`${normalizedReleaseDate}T00:00:00Z`);
      if (Number.isFinite(releaseTimestamp)) {
        const movieAgeMs = Date.now() - releaseTimestamp;
        if (movieAgeMs >= MDBLIST_OLD_MOVIE_AGE_DAYS * 24 * 60 * 60 * 1000) {
          ttlMs = Math.max(defaultTtlMs, oldTtlMs);
        }
      }
    }
  }

  return getDeterministicTtlMs(ttlMs, id);
};

const getMdbListCacheTtlMs = ({
  imdbId,
  mediaType,
  releaseDate,
}: {
  imdbId: string;
  mediaType: 'movie' | 'tv';
  releaseDate?: string | null;
}) => {
  return getRatingCacheTtlMs({
    id: imdbId,
    mediaType,
    releaseDate,
    defaultTtlMs: MDBLIST_CACHE_TTL_MS,
    oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
  });
};

const fetchMdbListRatings = async ({
  imdbId,
  cacheTtlMs,
  phases,
  requestSource,
  imageType,
  cleanId,
  manualApiKey,
}: {
  imdbId: string;
  cacheTtlMs: number;
  phases: PhaseDurations;
  requestSource?: string;
  imageType?: string;
  cleanId?: string;
  manualApiKey?: string | null;
}) => {
  const normalizedImdbId = String(imdbId || '').trim();
  const apiKeys = manualApiKey ? [manualApiKey] : getMdbListApiKeysInPriorityOrder();

  if (!normalizedImdbId || !apiKeys.length) return null;

  for (const apiKey of apiKeys) {
    try {
      const apiKeyHash = sha1Hex(apiKey).slice(0, 12);
      const response = await fetchJsonCached(
        `mdblist:${normalizedImdbId}:key:${sha1Hex(apiKey)}`,
        `https://mdblist.com/api/?apikey=${encodeURIComponent(apiKey)}&i=${encodeURIComponent(normalizedImdbId)}`,
        cacheTtlMs,
        phases,
        'mdb'
      );

      if (isMdbListRateLimitedResponse(response)) {
        markMdbListApiKeyRateLimited(apiKey);
        continue;
      }

      if (!response.ok) {
        if (shouldRetryMdbListWithAnotherKey(response)) {
          continue;
        }
        return null;
      }

      return collectMDBListRatings(response.data);
    } catch {
      // Try the next key before giving up on MDBList entirely.
    }
  }

  return null;
};

const fetchSimklRating = async ({
  clientId,
  imdbId,
  tmdbId,
  mediaType,
  anilistId,
  malId,
  kitsuId,
  cacheTtlMs,
  phases,
}: {
  clientId: string;
  imdbId?: string | null;
  tmdbId?: string | null;
  mediaType: 'movie' | 'tv';
  anilistId?: string | null;
  malId?: string | null;
  kitsuId?: string | null;
  cacheTtlMs: number;
  phases: PhaseDurations;
}) => {
  const normalizedClientId = String(clientId || '').trim();
  const normalizedImdbId = String(imdbId || '').trim();
  const normalizedTmdbId = String(tmdbId || '').trim();
  const normalizedAnilistId = String(anilistId || '').trim();
  const normalizedMalId = String(malId || '').trim();
  const normalizedKitsuId = String(kitsuId || '').trim();

  if (!normalizedClientId) return null;

  const query = new URLSearchParams();
  query.set('client_id', normalizedClientId);
  query.set('fields', 'simkl');

  if (normalizedImdbId) {
    query.set('imdb', normalizedImdbId);
  } else if (normalizedTmdbId) {
    query.set('tmdb', normalizedTmdbId);
    query.set('type', mediaType);
  } else if (normalizedAnilistId) {
    query.set('anilist', normalizedAnilistId);
  } else if (normalizedMalId) {
    query.set('mal', normalizedMalId);
  } else if (normalizedKitsuId) {
    query.set('kitsu', normalizedKitsuId);
  } else {
    return null;
  }

  const cacheIdSource =
    normalizedImdbId ||
    (normalizedTmdbId ? `tmdb:${mediaType}:${normalizedTmdbId}` : '') ||
    (normalizedAnilistId ? `anilist:${normalizedAnilistId}` : '') ||
    (normalizedMalId ? `mal:${normalizedMalId}` : '') ||
    (normalizedKitsuId ? `kitsu:${normalizedKitsuId}` : '');

  const response = await fetchJsonCached(
    `simkl:ratings:${cacheIdSource}:client:${sha1Hex(normalizedClientId)}`,
    `https://api.simkl.com/ratings?${query.toString()}`,
    cacheTtlMs,
    phases,
    'mdb',
    {
      headers: {
        'Content-Type': 'application/json',
        'simkl-api-key': normalizedClientId,
      },
    }
  );

  if (!response.ok) return null;

  const rating = normalizeRatingValue(response.data?.simkl?.rating);
  return rating && !isNegativeRatingValue(rating) ? rating : null;
};

const normalizeKitsuId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asInt = Math.trunc(value);
    return asInt > 0 ? String(asInt) : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase().startsWith('kitsu:') ? trimmed.slice(6) : trimmed;
  if (!normalized) return null;
  const match = normalized.match(/\d+/);
  return match ? match[0] : null;
};

const normalizeTmdbId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asInt = Math.trunc(value);
    return asInt > 0 ? String(asInt) : null;
  }

  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\d+/);
  return match ? match[0] : null;
};

const extractKitsuIdFromAnimemapping = (payload: any) => {
  const candidates = [
    payload?.requested?.resolvedKitsuId,
    payload?.kitsu?.id,
    payload?.mappings?.ids?.kitsu,
    payload?.data?.requested?.resolvedKitsuId,
    payload?.data?.kitsu?.id,
    payload?.data?.mappings?.ids?.kitsu,
  ];

  for (const candidate of candidates) {
    const kitsuId = normalizeKitsuId(candidate);
    if (kitsuId) return kitsuId;
  }

  return null;
};

const normalizeNumericAnimeSiteId = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asInt = Math.trunc(value);
    return asInt > 0 ? String(asInt) : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\d+/);
  return match ? match[0] : null;
};

const extractAnilistIdFromAnimemapping = (payload: any) => {
  const candidates = [
    payload?.mappings?.ids?.anilist,
    payload?.data?.mappings?.ids?.anilist,
    payload?.anilist?.id,
    payload?.data?.anilist?.id,
    payload?.ids?.anilist,
  ];
  for (const candidate of candidates) {
    const id = normalizeNumericAnimeSiteId(candidate);
    if (id) return id;
  }
  return null;
};

const extractMalIdFromAnimemapping = (payload: any) => {
  const candidates = [
    payload?.mappings?.ids?.mal,
    payload?.mappings?.ids?.myanimelist,
    payload?.data?.mappings?.ids?.mal,
    payload?.data?.mappings?.ids?.myanimelist,
    payload?.mal?.id,
    payload?.data?.mal?.id,
  ];
  for (const candidate of candidates) {
    const id = normalizeNumericAnimeSiteId(candidate);
    if (id) return id;
  }
  return null;
};

const fetchAnimemappingPayload = async ({
  provider,
  externalId,
  season,
  episode,
  phases,
}: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | number | null;
  episode?: string | number | null;
  phases: PhaseDurations;
}) => {
  const normalizedExternalId = externalId.trim();
  if (!normalizedExternalId) return null;

  const normalizedSeason = String(season ?? '').trim();
  const normalizedEpisode = String(episode ?? '').trim();
  const searchParams = new URLSearchParams();
  if (normalizedSeason) {
    searchParams.set('s', normalizedSeason);
  }
  if (normalizedEpisode) {
    searchParams.set('ep', normalizedEpisode);
  }
  const query = searchParams.toString();
  const cacheKey = `animemapping:${provider}:${normalizedExternalId}:s:${normalizedSeason || '-'}:e:${normalizedEpisode || '-'}`;
  const url = `https://animemapping.realbestia.com/${provider}/${encodeURIComponent(normalizedExternalId)}${query ? `?${query}` : ''}`;

  try {
    const response = await fetchJsonCached(
      cacheKey,
      url,
      KITSU_CACHE_TTL_MS,
      phases,
      'tmdb'
    );
    if (!response.ok) return null;
    const payload = response.data;
    if (payload?.ok === false) return null;
    return payload;
  } catch {
    return null;
  }
};

const extractTmdbIdFromAnimemapping = (payload: any) => {
  const candidates = [
    payload?.mappings?.ids?.tmdb,
    payload?.data?.mappings?.ids?.tmdb,
  ];

  for (const candidate of candidates) {
    const tmdbId = normalizeTmdbId(candidate);
    if (tmdbId) return tmdbId;
  }

  return null;
};

const extractAnimeSubtypeFromAnimemapping = (payload: any) => {
  const candidates = [
    payload?.requested?.subtype,
    payload?.subtype,
    payload?.kitsu?.subtype,
    payload?.mappings?.subtype,
    payload?.data?.requested?.subtype,
    payload?.data?.subtype,
    payload?.data?.kitsu?.subtype,
    payload?.data?.mappings?.subtype,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toLowerCase();
    if (normalized) return normalized;
  }

  return null;
};

const fetchKitsuIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractKitsuIdFromAnimemapping(payload);
};

const fetchTmdbIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractTmdbIdFromAnimemapping(payload);
};

const fetchAnilistIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractAnilistIdFromAnimemapping(payload);
};

const fetchMalIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractMalIdFromAnimemapping(payload);
};

const fetchKitsuAnimeAttributes = async (kitsuId: string, phases: PhaseDurations) => {
  const normalizedKitsuId = String(kitsuId || '').trim();
  if (!normalizedKitsuId) return null;

  try {
    const response = await fetchJsonCached(
      `kitsu:anime:${normalizedKitsuId}:details`,
      `https://kitsu.io/api/edge/anime/${encodeURIComponent(normalizedKitsuId)}`,
      KITSU_CACHE_TTL_MS,
      phases,
      'mdb',
      {
        headers: {
          Accept: 'application/vnd.api+json',
        },
      }
    );
    if (!response.ok) return null;

    return response.data?.data?.attributes || null;
  } catch {
    return null;
  }
};

const pickKitsuImageUrl = (image: any) => {
  const candidates = [
    image?.original,
    image?.large,
    image?.medium,
    image?.small,
    image?.tiny,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim();
    if (normalized) return normalized;
  }

  return null;
};

const normalizeKitsuTitleCandidate = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
};

const pickKitsuOriginalTitle = (attributes: any) => {
  const titles = attributes?.titles;
  const candidates = [
    titles?.en_jp,
    attributes?.canonicalTitle,
    titles?.ja_jp,
    titles?.en,
    titles?.en_us,
    typeof attributes?.slug === 'string' ? attributes.slug.replace(/-/g, ' ') : null,
  ];

  if (titles && typeof titles === 'object') {
    candidates.push(...Object.values(titles));
  }

  for (const candidate of candidates) {
    const normalized = normalizeKitsuTitleCandidate(candidate);
    if (normalized) return normalized;
  }

  return null;
};

const pickPosterTitleFromMedia = (
  media: any,
  mediaType: 'movie' | 'tv' | null,
  fallbackTitle?: string | null,
  preferredLang?: string | null,
  fallbackLang: string = FALLBACK_IMAGE_LANGUAGE,
  fallbackMedia?: any
) => {
  const pickLocalizedTitleFromTranslations = (source: any, language: string | null | undefined) => {
    const normalizedLanguage = normalizeTmdbLanguageCode(language);
    if (!normalizedLanguage) return null;
    const normalizedLanguageBase = getTmdbLanguageBase(normalizedLanguage);

    const translations = Array.isArray(source?.translations?.translations)
      ? source.translations.translations
      : [];
    const exactMatch = translations.find(
      (entry: any) => normalizeTmdbLanguageCode(entry?.iso_639_1 && entry?.iso_3166_1
        ? `${entry.iso_639_1}-${entry.iso_3166_1}`
        : entry?.iso_639_1) === normalizedLanguage
    );
    const baseMatch = !exactMatch
      ? translations.find(
        (entry: any) => getTmdbLanguageBase(entry?.iso_639_1) === normalizedLanguageBase
      )
      : null;
    const selected = exactMatch || baseMatch;
    if (!selected) return null;

    const data = selected.data || {};
    const candidate =
      mediaType === 'movie'
        ? data.title || data.name || data.original_title || data.original_name
        : data.name || data.title || data.original_name || data.original_title;
    if (typeof candidate !== 'string') return null;
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    return normalized || null;
  };

  const candidates = [
    pickLocalizedTitleFromTranslations(media, preferredLang),
    mediaType === 'movie' ? media?.title : mediaType === 'tv' ? media?.name : null,
    pickLocalizedTitleFromTranslations(fallbackMedia, preferredLang),
    mediaType === 'movie' ? fallbackMedia?.title : mediaType === 'tv' ? fallbackMedia?.name : null,
    pickLocalizedTitleFromTranslations(media, fallbackLang),
    pickLocalizedTitleFromTranslations(fallbackMedia, fallbackLang),
    mediaType === 'movie' ? media?.original_title : mediaType === 'tv' ? media?.original_name : null,
    media?.title,
    media?.name,
    fallbackMedia?.title,
    fallbackMedia?.name,
    media?.original_title,
    media?.original_name,
    fallbackMedia?.original_title,
    fallbackMedia?.original_name,
    fallbackTitle,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }
  return null;
};

const fetchKitsuFallbackAsset = async (
  kitsuId: string,
  imageType: RenderImageType,
  logoMode: LogoMode,
  logoFontVariant: LogoFontVariant,
  logoPrimary: string,
  logoSecondary: string,
  logoOutline: string,
  phases: PhaseDurations
) => {
  const normalizedKitsuId = String(kitsuId || '').trim();
  if (!normalizedKitsuId) return null;

  const attributes = await fetchKitsuAnimeAttributes(normalizedKitsuId, phases);
  if (!attributes) return null;

  const posterUrl = pickKitsuImageUrl(attributes?.posterImage);
  const coverUrl = pickKitsuImageUrl(attributes?.coverImage);
  const rating = normalizeRatingValue(attributes?.averageRating);
  const originalTitle = pickKitsuOriginalTitle(attributes);

  if (imageType === 'logo' && originalTitle) {
    const generatedLogo =
      logoMode === 'custom-logo'
        ? await buildGeneratedLogoVariantDataUrl(originalTitle, logoFontVariant, logoPrimary, logoSecondary, logoOutline)
        : logoMode === 'ratings-only'
          ? { dataUrl: buildTransparentLogoDataUrl(), aspectRatio: 2.4 }
          : buildGeneratedLogoDataUrl(originalTitle);
    return {
      imageUrl: generatedLogo.dataUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: generatedLogo.aspectRatio,
    };
  }

  if (imageType === 'poster') {
    return {
      imageUrl: posterUrl || coverUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  if (imageType === 'backdrop') {
    return {
      imageUrl: coverUrl || posterUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  return {
    imageUrl: posterUrl || coverUrl,
    rating,
    title: originalTitle,
    logoAspectRatio: null,
  };
};

const fetchKitsuRating = async (kitsuId: string, phases: PhaseDurations) => {
  const attributes = await fetchKitsuAnimeAttributes(kitsuId, phases);
  return normalizeRatingValue(attributes?.averageRating);
};

// Older proxy URLs may still include a placeholder season: `kitsu:id:season:episode`.
const parseKitsuInputParts = (parts: string[]) => {
  const mediaId = parts[1] || '';
  if (parts.length >= 4) {
    return {
      mediaId,
      season: null,
      episode: parts[3] || null,
    };
  }
  return {
    mediaId,
    season: null,
    episode: parts.length > 2 ? parts[2] : null,
  };
};

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

const fetchAnilistRating = async (anilistId: string, phases: PhaseDurations) => {
  const normalized = normalizeNumericAnimeSiteId(anilistId);
  if (!normalized) return null;
  const numericId = Number(normalized);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  const cacheKey = `anilist:media:${normalized}:mean`;
  try {
    const response = await fetchJsonCached(
      cacheKey,
      ANILIST_GRAPHQL_URL,
      KITSU_CACHE_TTL_MS,
      phases,
      'mdb',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: 'query ($id: Int) { Media(id: $id) { averageScore } }',
          variables: { id: Math.trunc(numericId) },
        }),
      }
    );
    if (!response.ok) return null;
    const score = response.data?.data?.Media?.averageScore;
    if (score == null || typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return null;
    return normalizeRatingValue(score);
  } catch {
    return null;
  }
};

const fetchMyAnimeListRating = async (malId: string, phases: PhaseDurations) => {
  const normalized = normalizeNumericAnimeSiteId(malId);
  if (!normalized) return null;

  try {
    const response = await fetchJsonCached(
      `jikan:anime:${normalized}:score`,
      `https://api.jikan.moe/v4/anime/${encodeURIComponent(normalized)}`,
      KITSU_CACHE_TTL_MS,
      phases,
      'mdb'
    );
    if (!response.ok) return null;
    const score = response.data?.data?.score;
    if (score == null || typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return null;
    return normalizeRatingValue(score);
  } catch {
    return null;
  }
};

const fetchJsonCached = async (
  key: string,
  url: string,
  ttlMs: number,
  phases: PhaseDurations,
  phase: keyof PhaseDurations,
  init?: RequestInit,
  observer?: CachedJsonNetworkObserver
): Promise<CachedJsonResponse> => {


  const cached = getMetadata<CachedJsonResponse>(key);
  if (cached) {
    return cached;
  }

  return withDedupe(metadataInFlight, key, async () => {

    const fromCache = getMetadata<CachedJsonResponse>(key);
    if (fromCache) return fromCache;



    const fetchStartedAt = Date.now();
    let response: Response;
    try {
      response = await measurePhase(phases, phase, () =>
        fetchWithRetry(url, {
          cache: 'no-store',
          ...init,
        })
      );
    } catch (error) {
      if (observer?.onNetworkError) {
        try {
          await observer.onNetworkError({
            key,
            url,
            errorMessage: error instanceof Error ? error.message : 'Network error',
            durationMs: Date.now() - fetchStartedAt,
          });
        } catch {
          // Ignore observer failures for monitoring hooks.
        }
      }
      throw error;
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const payload: CachedJsonResponse = {
      ok: response.ok,
      status: response.status,
      data,
    };
    if (observer?.onNetworkResponse) {
      try {
        await observer.onNetworkResponse({
          key,
          url,
          status: response.status,
          ok: response.ok,
          data,
          durationMs: Date.now() - fetchStartedAt,
        });
      } catch {
        // Ignore observer failures for monitoring hooks.
      }
    }
    const failureTtlMs = Math.min(ttlMs, 2 * 60 * 1000);
    const targetTtlMs = response.ok ? ttlMs : failureTtlMs;
    setMetadata(key, payload, targetTtlMs);

    return payload;
  });
};

const fetchTextCached = async (
  key: string,
  url: string,
  ttlMs: number,
  phases: PhaseDurations,
  phase: keyof PhaseDurations,
  init?: RequestInit
): Promise<CachedTextResponse> => {
  const cached = getMetadata<CachedTextResponse>(key);
  if (cached) {
    return cached;
  }

  return withDedupe(metadataInFlight, key, async () => {
    const fromCache = getMetadata<CachedTextResponse>(key);
    if (fromCache) return fromCache;

    const response = await measurePhase(phases, phase, () =>
      fetchWithRetry(url, {
        cache: 'no-store',
        redirect: 'follow',
        ...init,
      })
    );

    let data: string | null = null;
    try {
      data = await response.text();
    } catch {
      data = null;
    }

    const payload: CachedTextResponse = {
      ok: response.ok,
      status: response.status,
      data,
    };
    const failureTtlMs = Math.min(ttlMs, 2 * 60 * 1000);
    setMetadata(key, payload, response.ok ? ttlMs : failureTtlMs);
    return payload;
  });
};

const extractTvdbEpisodeIdFromAiredOrderHtml = (
  html: string,
  seriesPageUrl: string,
  season: string,
  episode: string
) => {
  const seasonNumber = parseInt(season, 10);
  const episodeNumber = parseInt(episode, 10);
  if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return null;

  const escapedSeriesSlug = seriesPageUrl
    .replace(/^https?:\/\/thetvdb\.com/i, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const episodeCode = `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`;
  const matcher = new RegExp(
    `${episodeCode}[\\s\\S]{0,1200}?href="${escapedSeriesSlug}/episodes/(\\d+)"`,
    'i'
  );
  return html.match(matcher)?.[1] || null;
};

const resolveTvdbEpisodeToTmdb = async (
  seriesId: string,
  season: string,
  episode: string,
  tmdbKey: string,
  phases: PhaseDurations
) => {
  const seriesUrl = `https://thetvdb.com/dereferrer/series/${encodeURIComponent(seriesId)}`;
  const seriesPageUrl = await measurePhase(phases, 'tmdb', async () => {
    const response = await fetch(seriesUrl, { cache: 'no-store', redirect: 'follow' });
    return response.ok ? response.url : null;
  }).catch(() => null);
  if (!seriesPageUrl) return null;

  const airedOrderUrl = `${seriesPageUrl.replace(/\/+$/, '')}/allseasons/official`;
  const airedOrderResponse = await fetchTextCached(
    `tvdb:series:${seriesId}:aired-order`,
    airedOrderUrl,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  if (!airedOrderResponse.ok || !airedOrderResponse.data) return null;

  const tvdbEpisodeId = extractTvdbEpisodeIdFromAiredOrderHtml(
    airedOrderResponse.data,
    seriesPageUrl,
    season,
    episode
  );
  if (!tvdbEpisodeId) return null;

  const findResponse = await fetchJsonCached(
    `tmdb:find:tvdb-episode:${tvdbEpisodeId}`,
    `https://api.themoviedb.org/3/find/${tvdbEpisodeId}?api_key=${tmdbKey}&external_source=tvdb_id`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  const episodeResult = Array.isArray(findResponse.data?.tv_episode_results)
    ? findResponse.data.tv_episode_results[0]
    : null;
  const showId = Number(episodeResult?.show_id);
  const seasonNumber = Number(episodeResult?.season_number);
  const episodeNumber = Number(episodeResult?.episode_number);
  if (!Number.isFinite(showId)) return null;

  return {
    showId: String(showId),
    season: Number.isFinite(seasonNumber) ? String(seasonNumber) : null,
    episode: Number.isFinite(episodeNumber) ? String(episodeNumber) : null,
  };
};

const resolveImdbEpisodeWithTvdbOrderToTmdb = async (
  imdbSeriesId: string,
  season: string,
  episode: string,
  tmdbKey: string,
  phases: PhaseDurations
) => {
  const findResponse = await fetchJsonCached(
    `tmdb:find:imdb-series:${imdbSeriesId}`,
    `https://api.themoviedb.org/3/find/${imdbSeriesId}?api_key=${tmdbKey}&external_source=imdb_id`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  const tvResult = Array.isArray(findResponse.data?.tv_results) ? findResponse.data.tv_results[0] : null;
  const tmdbShowId = Number(tvResult?.id);
  if (!Number.isFinite(tmdbShowId)) return null;

  const externalIdsResponse = await fetchJsonCached(
    `tmdb:tv:${tmdbShowId}:external_ids`,
    `https://api.themoviedb.org/3/tv/${tmdbShowId}/external_ids?api_key=${tmdbKey}`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  const rawTvdbSeriesId = externalIdsResponse.data?.tvdb_id;
  const tvdbSeriesId =
    typeof rawTvdbSeriesId === 'number' && Number.isFinite(rawTvdbSeriesId)
      ? String(rawTvdbSeriesId)
      : typeof rawTvdbSeriesId === 'string' && rawTvdbSeriesId.trim().length > 0
        ? rawTvdbSeriesId.trim()
        : null;
  if (!tvdbSeriesId) return null;

  const mappedEpisode = await resolveTvdbEpisodeToTmdb(tvdbSeriesId, season, episode, tmdbKey, phases);
  if (!mappedEpisode?.showId) return null;

  return {
    ...mappedEpisode,
    tvdbSeriesId,
  };
};

const resolveTmdbEpisodeByYearBucket = async (
  tmdbShowId: string,
  requestedBucketSeason: string,
  requestedBucketEpisode: string,
  tmdbKey: string,
  phases: PhaseDurations
) => {
  const bucketSeason = parseInt(requestedBucketSeason, 10);
  const bucketEpisode = parseInt(requestedBucketEpisode, 10);
  if (!Number.isFinite(bucketSeason) || !Number.isFinite(bucketEpisode) || bucketSeason < 1 || bucketEpisode < 1) {
    return null;
  }

  const showResponse = await fetchJsonCached(
    `tmdb:tv:${tmdbShowId}`,
    `https://api.themoviedb.org/3/tv/${tmdbShowId}?api_key=${tmdbKey}`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  if (!showResponse.ok) return null;

  const numberOfSeasons = Number(showResponse.data?.number_of_seasons);
  if (!Number.isFinite(numberOfSeasons) || numberOfSeasons < 1) return null;

  const yearBuckets = new Map<number, Array<{ tmdbSeason: number; tmdbEpisode: number }>>();
  for (let seasonIndex = 1; seasonIndex <= numberOfSeasons; seasonIndex += 1) {
    const seasonResponse = await fetchJsonCached(
      `tmdb:tv:${tmdbShowId}:season:${seasonIndex}`,
      `https://api.themoviedb.org/3/tv/${tmdbShowId}/season/${seasonIndex}?api_key=${tmdbKey}`,
      TMDB_CACHE_TTL_MS,
      phases,
      'tmdb'
    );
    if (!seasonResponse.ok || !Array.isArray(seasonResponse.data?.episodes)) continue;

    for (const episodeData of seasonResponse.data.episodes) {
      const airDate = typeof episodeData?.air_date === 'string' ? episodeData.air_date : '';
      const year = parseInt(airDate.slice(0, 4), 10);
      const tmdbEpisode = Number(episodeData?.episode_number);
      if (!Number.isFinite(year) || !Number.isFinite(tmdbEpisode)) continue;
      const bucket = yearBuckets.get(year) || [];
      bucket.push({ tmdbSeason: seasonIndex, tmdbEpisode });
      yearBuckets.set(year, bucket);
    }
  }

  const orderedYears = [...yearBuckets.keys()].sort((a, b) => a - b);
  const targetYear = orderedYears[bucketSeason - 1];
  if (!Number.isFinite(targetYear)) return null;
  const bucketEpisodes = yearBuckets.get(targetYear) || [];
  const targetEpisode = bucketEpisodes[bucketEpisode - 1];
  if (!targetEpisode) return null;

  return {
    showId: tmdbShowId,
    season: String(targetEpisode.tmdbSeason),
    episode: String(targetEpisode.tmdbEpisode),
  };
};

const getImageLanguageTag = (item: any) => {
  if (!item?.iso_639_1) return null;
  if (typeof item?.iso_3166_1 === 'string' && item.iso_3166_1.trim()) {
    return `${item.iso_639_1}-${item.iso_3166_1}`;
  }

  return item.iso_639_1;
};

const pickByLanguageWithFallback = (
  items: any[] = [],
  preferredLang: string,
  fallbackLang: string,
  preferredPath?: string | null
) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  if (preferredPath) {
    const preferredPathItem = items.find((item: any) => item?.file_path === preferredPath);
    if (preferredPathItem) {
      return preferredPathItem;
    }
  }

  const findItemByLanguage = (language: string | null) => {
    if (!language) {
      return null;
    }

    const exactMatch = items.find((item: any) => normalizeTmdbLanguageCode(getImageLanguageTag(item)) === language);
    if (exactMatch) {
      return exactMatch;
    }

    const baseLanguage = getTmdbLanguageBase(language);
    if (!baseLanguage) {
      return null;
    }

    return items.find((item: any) => getTmdbLanguageBase(getImageLanguageTag(item)) === baseLanguage) || null;
  };

  const preferred = normalizeTmdbLanguageCode(preferredLang);
  const fallback = normalizeTmdbLanguageCode(fallbackLang);

  if (preferred) {
    const preferredItem = findItemByLanguage(preferred);
    if (preferredItem) return preferredItem;
  }

  if (fallback) {
    const fallbackItem = findItemByLanguage(fallback);
    if (fallbackItem) return fallbackItem;
  }

  return items[0];
};

const matchesImageLanguage = (item: any, language: string | null | undefined) => {
  const normalizedLanguage = normalizeTmdbLanguageCode(language);
  if (!normalizedLanguage) {
    return false;
  }

  const itemLanguage = normalizeTmdbLanguageCode(getImageLanguageTag(item));
  if (!itemLanguage) {
    return false;
  }

  return (
    itemLanguage === normalizedLanguage ||
    getTmdbLanguageBase(itemLanguage) === getTmdbLanguageBase(normalizedLanguage)
  );
};

const isTextlessPosterSelection = (posters: any[] = [], selectedPoster?: any | null) => {
  if (!Array.isArray(posters) || posters.length === 0 || !selectedPoster?.file_path) return false;

  return posters.some(
    (poster: any) =>
      poster?.file_path === selectedPoster.file_path && normalizeTmdbLanguageCode(getImageLanguageTag(poster)) === null
  );
};

const pickPosterByPreference = (
  posters: any[] = [],
  preference: PosterTextPreference,
  preferredLang: string,
  fallbackLang: string,
  originalPosterPath?: string | null
) => {
  if (!Array.isArray(posters) || posters.length === 0) {
    return originalPosterPath ? { file_path: originalPosterPath } : null;
  }

  const canonicalOriginalPath =
    originalPosterPath ||
    pickByLanguageWithFallback(posters, preferredLang, fallbackLang)?.file_path ||
    posters[0]?.file_path ||
    null;
  const originalPoster = canonicalOriginalPath
    ? posters.find((poster: any) => poster.file_path === canonicalOriginalPath)
    : null;
  const fallbackOriginal = originalPoster || (canonicalOriginalPath ? { file_path: canonicalOriginalPath } : posters[0]);
  const defaultPoster =
    pickByLanguageWithFallback(posters, preferredLang, fallbackLang) ||
    fallbackOriginal;
  const defaultPosterPath = defaultPoster?.file_path || canonicalOriginalPath;
  const alternativePosters = posters.filter(
    (poster: any) => poster.file_path !== defaultPosterPath
  );

  if (preference === 'clean') {
    return (
      posters.find((poster: any) => !poster.iso_639_1) ||
      pickByLanguageWithFallback(posters, preferredLang, fallbackLang, originalPosterPath) ||
      fallbackOriginal
    );
  }

  if (preference === 'default') {
    return defaultPoster;
  }

  return (
    pickByLanguageWithFallback(alternativePosters, preferredLang, '') ||
    pickByLanguageWithFallback(alternativePosters, fallbackLang, '') ||
    alternativePosters[0] ||
    fallbackOriginal
  );
};

const pickBackdropByPreference = (
  backdrops: any[] = [],
  preference: PosterTextPreference,
  preferredLang: string,
  fallbackLang: string,
  originalBackdropPath?: string | null
) => {
  if (!Array.isArray(backdrops) || backdrops.length === 0) {
    return originalBackdropPath ? { file_path: originalBackdropPath } : null;
  }

  const canonicalOriginalPath =
    originalBackdropPath ||
    pickByLanguageWithFallback(backdrops, preferredLang, fallbackLang)?.file_path ||
    backdrops[0]?.file_path ||
    null;
  const originalBackdrop = canonicalOriginalPath
    ? backdrops.find((backdrop: any) => backdrop.file_path === canonicalOriginalPath)
    : null;
  const fallbackOriginal =
    originalBackdrop || (canonicalOriginalPath ? { file_path: canonicalOriginalPath } : backdrops[0]);
  const defaultBackdrop =
    pickByLanguageWithFallback(backdrops, preferredLang, fallbackLang) ||
    fallbackOriginal;
  const defaultBackdropPath = defaultBackdrop?.file_path || canonicalOriginalPath;
  const alternativeBackdrops = backdrops.filter(
    (backdrop: any) => backdrop.file_path !== defaultBackdropPath
  );

  if (preference === 'clean') {
    return (
      backdrops.find((backdrop: any) => !backdrop.iso_639_1) ||
      pickByLanguageWithFallback(backdrops, preferredLang, fallbackLang, originalBackdropPath) ||
      fallbackOriginal
    );
  }

  if (preference === 'default') {
    return defaultBackdrop;
  }

  return (
    pickByLanguageWithFallback(alternativeBackdrops, preferredLang, '') ||
    pickByLanguageWithFallback(alternativeBackdrops, fallbackLang, '') ||
    alternativeBackdrops[0] ||
    fallbackOriginal
  );
};

type FastRenderInput = {
  imageType: RenderImageType;
  outputFormat: OutputFormat;
  imgUrl: string;
  outputWidth: number;
  outputHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  finalOutputHeight: number;
  logoBadgeTopGap: number;
  logoBadgeBandHeight: number;
  logoBadgeMaxWidth: number;
  logoBadgesPerRow: number;
  posterRowHorizontalInset: number;
  posterTitleText?: string | null;
  posterLogoUrl?: string | null;
  posterReferenceBadgeHeight?: number;
  posterReferenceVerticalBadgeHeight?: number;
  posterReferenceBadgeGap?: number;
  thumbnailFallbackEpisodeText?: string | null;
  thumbnailFallbackEpisodeCode?: string | null;
  badgeIconSize: number;
  badgeFontSize: number;
  badgePaddingX: number;
  badgePaddingY: number;
  badgeGap: number;
  badgeTopOffset: number;
  badgeBottomOffset: number;
  badges: RatingBadge[];
  qualityBadges: RatingBadge[];
  qualityBadgesSide: QualityBadgesSide;
  posterQualityBadgesPosition: PosterQualityBadgesPosition;
  qualityBadgesStyle: RatingStyle;
  posterRatingsLayout: PosterRatingLayout;
  posterRatingsMaxPerSide: number | null;
  backdropRatingsLayout: BackdropRatingLayout | ThumbnailRatingLayout;
  backdropRatingsSize: BackdropRatingsSize;
  thumbnailRatingsLayout: ThumbnailRatingLayout;
  thumbnailSize: ThumbnailSize;
  verticalBadgeContent: 'standard' | 'stacked';
  ratingStyle: RatingStyle;
  topBadges: RatingBadge[];
  bottomBadges: RatingBadge[];
  leftBadges: RatingBadge[];
  rightBadges: RatingBadge[];
  backdropColumns?: RatingBadge[][];
  backdropRows?: RatingBadge[][];
  cacheControl: string;
};

let sharpFactoryPromise: Promise<any | null> | null = null;
let sharpConfigured = false;
const configureSharp = (sharp: any) => {
  if (sharpConfigured || !sharp) return;
  sharpConfigured = true;

  const concurrency = parseNonNegativeInt(process.env.ERDB_SHARP_CONCURRENCY, 64);
  if (concurrency && concurrency > 0) {
    sharp.concurrency(concurrency);
  }

  const cacheOptions: { memory?: number; files?: number; items?: number } = {};
  const memory = parseNonNegativeInt(process.env.ERDB_SHARP_CACHE_MEMORY_MB, 8192);
  const files = parseNonNegativeInt(process.env.ERDB_SHARP_CACHE_FILES, 20000);
  const items = parseNonNegativeInt(process.env.ERDB_SHARP_CACHE_ITEMS, 2000);
  if (memory !== null) cacheOptions.memory = memory;
  if (files !== null) cacheOptions.files = files;
  if (items !== null) cacheOptions.items = items;
  if (Object.keys(cacheOptions).length > 0) {
    sharp.cache(cacheOptions);
  }
};
const getSharpFactory = async () => {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .then((mod: any) => {
        const sharp = mod.default || mod;
        configureSharp(sharp);
        return sharp;
      })
      .catch((error) => {
        throw new Error(
          `sharp is required for ERDB image rendering: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      });
  }
  return sharpFactoryPromise;
};

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

const toImageContentType = (value: string | null) => {
  const normalized = (value || '').split(';')[0]?.trim().toLowerCase();
  return normalized?.startsWith('image/') ? normalized : 'image/png';
};

const buildSourceImageFallbackCacheControl = (ttlMs: number) => {
  const ttlSeconds = Math.max(60, Math.floor(ttlMs / 1000));
  return `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=3600`;
};

const isTmdbSourceImageUrl = (value: string) => {
  try {
    return new URL(value).hostname === 'image.tmdb.org';
  } catch {
    return false;
  }
};

const buildProviderIconStorageKey = (iconUrl: string, iconCornerRadius = 0) =>
  `icons/${sha1Hex(`${iconUrl}|r:${iconCornerRadius}`)}.png`;

const buildGeneratedLogoVariantStorageKey = (cacheKey: string) =>
  `customlogos/${sha1Hex(cacheKey)}.svg`;

const readProviderIconFromStorage = async (
  iconUrl: string,
  iconCornerRadius = 0
): Promise<string | null> => {
  if (!isObjectStorageConfigured()) return null;
  try {
    const payload = await getCachedImageFromObjectStorage(
      buildProviderIconStorageKey(iconUrl, iconCornerRadius)
    );
    if (!payload) return null;
    const buffer = Buffer.from(payload.body);
    const contentType = toImageContentType(payload.contentType);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
};

const writeProviderIconToStorage = async (
  iconUrl: string,
  buffer: Buffer,
  iconCornerRadius = 0
) => {
  if (!isObjectStorageConfigured()) return;
  try {
    await putCachedImageToObjectStorage(buildProviderIconStorageKey(iconUrl, iconCornerRadius), {
      body: bufferToArrayBuffer(buffer),
      contentType: 'image/png',
      cacheControl: buildSourceImageFallbackCacheControl(PROVIDER_ICON_CACHE_TTL_MS),
    });
  } catch {
    // Ignore icon cache write failures.
  }
};

const readGeneratedLogoVariantFromStorage = async (cacheKey: string) => {
  if (!isObjectStorageConfigured()) return null;
  try {
    const payload = await getCachedImageFromObjectStorage(buildGeneratedLogoVariantStorageKey(cacheKey));
    if (!payload) return null;
    const svg = Buffer.from(payload.body).toString('utf8');
    return {
      dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      aspectRatio: LOGO_BASE_HEIGHT > 0 ? Math.max(1, extractSvgWidth(svg)) / LOGO_BASE_HEIGHT : 2.5,
    };
  } catch {
    return null;
  }
};

const writeGeneratedLogoVariantToStorage = async (cacheKey: string, svg: string) => {
  if (!isObjectStorageConfigured()) return;
  try {
    await putCachedImageToObjectStorage(buildGeneratedLogoVariantStorageKey(cacheKey), {
      body: bufferToArrayBuffer(Buffer.from(svg, 'utf8')),
      contentType: 'image/svg+xml',
      cacheControl: buildSourceImageFallbackCacheControl(GENERATED_LOGO_VARIANT_CACHE_TTL_MS),
    });
  } catch {
    // Ignore generated logo cache write failures.
  }
};

const extractSvgWidth = (svg: string) => {
  const match = svg.match(/\bwidth="(\d+)"/i);
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 800;
};

const pickTmdbImageSize = (imageType: RenderImageType, outputWidth: number) => {
  if (imageType === 'poster' || imageType === 'backdrop' || imageType === 'thumbnail' || imageType === 'logo') {
    return 'original';
  }
  return 'original';
};

const buildTmdbImageUrl = (
  imageType: RenderImageType,
  imgPath: string,
  outputWidth: number
) => {
  const size = pickTmdbImageSize(imageType, outputWidth);
  return `https://image.tmdb.org/t/p/${size}${imgPath}`;
};

const fetchSourceImageUncached = async (
  imgUrl: string,
  fallbackTtlMs: number
): Promise<RenderedImagePayload> => {
  const sourceResponse = await fetch(imgUrl, { cache: 'no-store' });
  if (!sourceResponse.ok) {
    throw new HttpError('Image not found', sourceResponse.status || 404);
  }

  return {
    body: await sourceResponse.arrayBuffer(),
    contentType: sourceResponse.headers.get('content-type') || 'image/jpeg',
    cacheControl:
      sourceResponse.headers.get('cache-control') || buildSourceImageFallbackCacheControl(fallbackTtlMs),
  };
};

const getSourceImagePayload = async (
  imgUrl: string,
  fallbackTtlMs = TMDB_CACHE_TTL_MS
): Promise<RenderedImagePayload> => {
  const normalizedImgUrl = String(imgUrl || '').trim();
  if (!normalizedImgUrl) {
    throw new HttpError('Image not found', 404);
  }

  const sharedCacheable = isTmdbSourceImageUrl(normalizedImgUrl);
  if (!sharedCacheable) {
    return fetchSourceImageUncached(normalizedImgUrl, fallbackTtlMs);
  }

  // Local image cache removed in favor of objectStorage

  const sourceHash = sha1Hex(normalizedImgUrl);
  const sourceObjectStorageKey = `source/${sourceHash}`;
  const objectStorageEnabled = isObjectStorageConfigured();

  const readSharedSourcePayload = async () => {
    if (!objectStorageEnabled) return null;


    const objectPayload = await getCachedImageFromObjectStorage(sourceObjectStorageKey);
    if (!objectPayload) {
      return null;
    }

    const payload: RenderedImagePayload = {
      body: objectPayload.body,
      contentType: objectPayload.contentType,
      cacheControl: objectPayload.cacheControl,
    };
    return payload;
  };

  if (objectStorageEnabled) {
    try {
      const sharedPayload = await readSharedSourcePayload();
      if (sharedPayload) {
        return sharedPayload;
      }
    } catch {
      // Ignore distributed cache read failures and continue with fetch path.
    }
  }

  return withDedupe(sourceImageInFlight, normalizedImgUrl, async () => {
    // Local warming removed

    if (objectStorageEnabled) {
      try {
        const sharedPayload = await readSharedSourcePayload();
        if (sharedPayload) {
          return sharedPayload;
        }
      } catch {
        // Ignore distributed cache read failures inside in-flight dedupe path.
      }
    }


    const payload = await fetchSourceImageUncached(normalizedImgUrl, fallbackTtlMs);

    if (objectStorageEnabled) {
      try {
        await putCachedImageToObjectStorage(sourceObjectStorageKey, payload);
      } catch {
        // Ignore distributed cache persistence failures for source images.
      }
    }

    return payload;
  });
};

const getProviderIconDataUri = async (
  iconUrl: string,
  iconCornerRadius = 0
): Promise<string | null> => {
  const normalizedIconUrl = iconUrl.trim();
  if (!normalizedIconUrl) return null;
  if (normalizedIconUrl.startsWith('data:')) {
    return normalizedIconUrl;
  }
  const cacheKey = `${normalizedIconUrl}|r:${iconCornerRadius}`;

  const localCached = getMetadata<string>(cacheKey);
  if (localCached) {
    return localCached;
  }

  return withDedupe(providerIconInFlight, cacheKey, async () => {
    const warmLocal = getMetadata<string>(cacheKey);
    if (warmLocal) return warmLocal;

    const storageCached = await readProviderIconFromStorage(normalizedIconUrl, iconCornerRadius);
    if (storageCached) {
      setMetadata(cacheKey, storageCached, PROVIDER_ICON_CACHE_TTL_MS);
      return storageCached;
    }

    try {
      const response = await fetch(normalizedIconUrl, { cache: 'no-store' });
      if (!response.ok) return null;

      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      const sharp = await getSharpFactory();
      let pipeline = sharp(sourceBuffer)
        .trim()
        .resize(96, 96, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      if (iconCornerRadius > 0) {
        const radius = Math.max(1, Math.min(48, Math.round(iconCornerRadius)));
        const roundedMask = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="${radius}" ry="${radius}" fill="white"/></svg>`
        );
        pipeline = pipeline.composite([{ input: roundedMask, blend: 'dest-in' }]);
      }
      const outputBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
      const outputContentType = 'image/png';

      const dataUri = `data:${outputContentType};base64,${outputBuffer.toString('base64')}`;
      setMetadata(cacheKey, dataUri, PROVIDER_ICON_CACHE_TTL_MS);
      await writeProviderIconToStorage(normalizedIconUrl, outputBuffer, iconCornerRadius);

      return dataUri;
    } catch {
      return null;
    }
  });
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const splitTitleForGeneratedLogo = (title: string) => {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) return ['Kitsu'];

  const words = normalized.split(' ').filter(Boolean);
  if (words.length <= 2 && normalized.length <= 24) return [normalized];

  const maxLines = 4;
  const targetLineLength =
    normalized.length >= 56 ? 13 : normalized.length >= 42 ? 15 : normalized.length >= 30 ? 17 : 19;
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const currentLimit = lines.length === 0 ? targetLineLength + 1 : targetLineLength;
    if (currentLine && nextLine.length > currentLimit && lines.length < maxLines - 1) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }
    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    const tail = lines.slice(maxLines - 1).join(' ');
    return [...head, tail];
  }

  return lines;
};

const estimateGeneratedLogoLineWidth = (line: string, fontSize: number) =>
  [...line].reduce((acc, ch) => {
    if (ch === ' ') return acc + fontSize * 0.30;
    if (/[WMwm]/.test(ch)) return acc + fontSize * 0.92;
    if (/[A-Z]/.test(ch)) return acc + fontSize * 0.74;
    if (/[0-9]/.test(ch)) return acc + fontSize * 0.66;
    if (/[\-_:/'".,!?&]/.test(ch)) return acc + fontSize * 0.36;
    return acc + fontSize * 0.60;
  }, 0);

const buildGeneratedLogoDataUrl = (title: string) => {
  const lines = splitTitleForGeneratedLogo(title);
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const width = Math.max(760, Math.round(maxLineLength * 68 + 280));
  const height = LOGO_BASE_HEIGHT;
  const aspectRatio = width / height;
  const baseFontSize = lines.length === 1 ? 172 : lines.length === 2 ? 136 : lines.length === 3 ? 108 : 86;
  const compressedFontSize = Math.max(58, Math.floor((width - 160) / Math.max(maxLineLength, 1) * 1.72));
  const preliminaryFontSize = Math.min(baseFontSize, compressedFontSize);
  const availableLineWidth = Math.max(420, width - 150);
  const longestEstimatedLineWidth = Math.max(
    ...lines.map((line) => estimateGeneratedLogoLineWidth(line, preliminaryFontSize)),
    1
  );
  const widthFitScale = Math.min(1, availableLineWidth / longestEstimatedLineWidth);
  const fontSize = Math.max(54, Math.floor(preliminaryFontSize * widthFitScale));
  const lineHeight = Math.round(fontSize * 0.96);
  const totalTextHeight = lineHeight * (lines.length - 1);
  const startY = Math.round(height / 2 - totalTextHeight / 2 + fontSize * 0.34);
  const strokeWidth = Math.max(4, Math.round(fontSize * 0.07));
  const letterSpacing = Math.max(1, Math.round(fontSize * 0.015));
  const tspans = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, fontSize);
      const textLength =
        estimatedLineWidth > availableLineWidth
          ? ` textLength="${availableLineWidth}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<tspan x="${Math.round(width / 2)}" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.38" />
  </filter>
</defs>
<text x="${Math.round(width / 2)}" y="${startY}" text-anchor="middle" font-family="Arial Narrow, Trebuchet MS, Arial, sans-serif" font-size="${fontSize}" font-weight="800" font-style="italic" letter-spacing="${letterSpacing}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#logo-shadow)">${tspans}</text>
</svg>`;
  return {
    dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    aspectRatio,
  };
};

const buildTransparentLogoDataUrl = () =>
  `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"></svg>')}`;

const GENERATED_LOGO_FONT_VARIANTS: Array<{
  id: LogoFontVariant;
  fontFamily: string;
  fill: string;
  stroke: string;
  strokeOpacity?: number;
  weight: number;
  italic?: boolean;
  letterSpacingFactor: number;
  uppercase?: boolean;
  skewX?: number;
  topPaddingFactor?: number;
  bottomPaddingFactor?: number;
  fillMode?: 'solid' | 'gradient' | 'outline';
  gradientStops?: Array<{ offset: string; color: string }>;
  shadow?: { dy: number; stdDeviation: number; color: string; opacity: number };
}> = [
    {
      id: 'spicy-sale',
      fontFamily: "'Spicy Sale','Rubik Spray Paint','Impact',sans-serif",
      fill: '#fff7ed',
      stroke: 'rgba(190,24,93,0.92)',
      strokeOpacity: 0.92,
      weight: 400,
      letterSpacingFactor: 0.012,
      uppercase: false,
      skewX: -3,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fde68a' },
        { offset: '55%', color: '#fb7185' },
        { offset: '100%', color: '#c084fc' },
      ],
      shadow: { dy: 1, stdDeviation: 7, color: '#ec4899', opacity: 0.4 },
    },
    {
      id: 'somelist',
      fontFamily: "'Somelist','Spicy Sale','Impact',sans-serif",
      fill: '#f0fdf4',
      stroke: 'rgba(8,145,178,0.84)',
      strokeOpacity: 0.8,
      weight: 400,
      letterSpacingFactor: 0.008,
      uppercase: false,
      skewX: -1,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#bbf7d0' },
        { offset: '100%', color: '#67e8f9' },
      ],
      shadow: { dy: 0, stdDeviation: 6, color: '#22d3ee', opacity: 0.28 },
    },
    {
      id: 'rubik-spray-paint',
      fontFamily: "'Rubik Spray Paint','Dokdo','Impact',sans-serif",
      fill: '#fef08a',
      stroke: 'rgba(120,53,15,0.9)',
      weight: 400,
      letterSpacingFactor: 0.01,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fde68a' },
        { offset: '100%', color: '#f97316' },
      ],
      shadow: { dy: 3, stdDeviation: 6, color: '#fb923c', opacity: 0.32 },
    },
    {
      id: 'nabla',
      fontFamily: "'Nabla','Monoton','Impact',sans-serif",
      fill: '#ddd6fe',
      stroke: 'rgba(76,29,149,0.92)',
      weight: 400,
      letterSpacingFactor: 0.02,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#e9d5ff' },
        { offset: '100%', color: '#60a5fa' },
      ],
      shadow: { dy: 0, stdDeviation: 8, color: '#8b5cf6', opacity: 0.34 },
    },
    {
      id: 'honk',
      fontFamily: "'Honk','Nabla','Impact',sans-serif",
      fill: '#ecfccb',
      stroke: 'rgba(63,98,18,0.9)',
      weight: 400,
      letterSpacingFactor: 0.018,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#bef264' },
        { offset: '100%', color: '#22d3ee' },
      ],
      shadow: { dy: 0, stdDeviation: 8, color: '#84cc16', opacity: 0.3 },
    },
    {
      id: 'paper-scratch',
      fontFamily: "'Paper Scratch','Dokdo','Impact',sans-serif",
      fill: '#fef2f2',
      stroke: 'rgba(127,29,29,0.92)',
      weight: 400,
      letterSpacingFactor: 0.012,
      uppercase: false,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fca5a5' },
        { offset: '100%', color: '#f97316' },
      ],
      shadow: { dy: 1, stdDeviation: 5, color: '#7f1d1d', opacity: 0.34 },
    },
    {
      id: 'sludgeborn',
      fontFamily: "'Sludgeborn','Paper Scratch','Impact',sans-serif",
      fill: '#f5f3ff',
      stroke: 'rgba(88,28,135,0.94)',
      weight: 400,
      letterSpacingFactor: 0.014,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#c4b5fd' },
        { offset: '100%', color: '#f472b6' },
      ],
      shadow: { dy: 0, stdDeviation: 7, color: '#a855f7', opacity: 0.36 },
    },
    {
      id: 'playgum',
      fontFamily: "'Playgum','Somelist','Impact',sans-serif",
      fill: '#ecfeff',
      stroke: 'rgba(8,145,178,0.88)',
      weight: 400,
      letterSpacingFactor: 0.01,
      uppercase: false,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#67e8f9' },
        { offset: '100%', color: '#a78bfa' },
      ],
      shadow: { dy: 0, stdDeviation: 6, color: '#22d3ee', opacity: 0.26 },
    },
    {
      id: 'atlasmemo',
      fontFamily: "'Atlas Memo','Paper Scratch','Impact',sans-serif",
      fill: '#fdf2f8',
      stroke: 'rgba(157,23,77,0.88)',
      weight: 400,
      letterSpacingFactor: 0.008,
      uppercase: false,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#f9a8d4' },
        { offset: '100%', color: '#67e8f9' },
      ],
      shadow: { dy: 0, stdDeviation: 6, color: '#ec4899', opacity: 0.24 },
    },
    {
      id: 'dracutaz',
      fontFamily: "'Dracutaz','Sludgeborn','Impact',sans-serif",
      fill: '#f5f3ff',
      stroke: 'rgba(76,29,149,0.94)',
      weight: 400,
      letterSpacingFactor: 0.014,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#c4b5fd' },
        { offset: '100%', color: '#f472b6' },
      ],
      shadow: { dy: 0, stdDeviation: 7, color: '#a855f7', opacity: 0.36 },
    },
    {
      id: 'banana-chips',
      fontFamily: "'Banana Chips','Honk','Impact',sans-serif",
      fill: '#fffbeb',
      stroke: 'rgba(133,77,14,0.9)',
      weight: 400,
      letterSpacingFactor: 0.014,
      uppercase: true,
      skewX: -2,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fde68a' },
        { offset: '100%', color: '#fb7185' },
      ],
      shadow: { dy: 1, stdDeviation: 7, color: '#f59e0b', opacity: 0.34 },
    },
    {
      id: 'holy-star',
      fontFamily: "'Holy Star','Playgum','Impact',sans-serif",
      fill: '#f8fafc',
      stroke: 'rgba(8,47,73,0.9)',
      weight: 400,
      letterSpacingFactor: 0.022,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#67e8f9' },
        { offset: '100%', color: '#c084fc' },
      ],
      shadow: { dy: 0, stdDeviation: 8, color: '#38bdf8', opacity: 0.32 },
    },
    {
      id: 'rocks-serif',
      fontFamily: "'Rocks Serif','Dracutaz','Impact',sans-serif",
      fill: '#faf5ff',
      stroke: 'rgba(88,28,135,0.92)',
      weight: 400,
      letterSpacingFactor: 0.012,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#d8b4fe' },
        { offset: '100%', color: '#f472b6' },
      ],
      shadow: { dy: 1, stdDeviation: 6, color: '#a855f7', opacity: 0.3 },
    },
  ];

const buildGeneratedLogoVariantDataUrl = async (
  title: string,
  logoFontVariant: LogoFontVariant,
  primaryColor: string,
  secondaryColor: string,
  outlineColor: string
) => {
  const cacheKey = getGeneratedLogoVariantCacheKey(
    title,
    logoFontVariant,
    primaryColor,
    secondaryColor,
    outlineColor
  );
  const cached = getCachedGeneratedLogoVariant(cacheKey);
  if (cached) {
    return cached;
  }

  const persisted = await readGeneratedLogoVariantFromStorage(cacheKey);
  if (persisted) {
    setCachedGeneratedLogoVariant(cacheKey, persisted);
    return persisted;
  }

  return withDedupe(generatedLogoVariantInFlight, cacheKey, async () => {
    const dedupedCached = getCachedGeneratedLogoVariant(cacheKey);
    if (dedupedCached) {
      return dedupedCached;
    }

    const dedupedPersisted = await readGeneratedLogoVariantFromStorage(cacheKey);
    if (dedupedPersisted) {
      setCachedGeneratedLogoVariant(cacheKey, dedupedPersisted);
      return dedupedPersisted;
    }

    const hexToRgb = (hex: string) => {
      const normalized = normalizeHexColor(hex, '#ffffff').slice(1);
      return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
      };
    };
    const mixHexColors = (a: string, b: string, weight = 0.5) => {
      const clampedWeight = Math.max(0, Math.min(1, weight));
      const colorA = hexToRgb(a);
      const colorB = hexToRgb(b);
      const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
      return `#${toHex(colorA.r * (1 - clampedWeight) + colorB.r * clampedWeight)}${toHex(colorA.g * (1 - clampedWeight) + colorB.g * clampedWeight)}${toHex(colorA.b * (1 - clampedWeight) + colorB.b * clampedWeight)}`;
    };
    const toRgba = (hex: string, alpha: number) => {
      const { r, g, b } = hexToRgb(hex);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const lines = splitTitleForGeneratedLogo(title);
    const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
    const width = Math.max(760, Math.round(maxLineLength * 68 + 280));
    const height = LOGO_BASE_HEIGHT;
    const aspectRatio = width / height;
    const availableLineWidth = Math.max(420, width - 150);
    const baseFontSize = lines.length === 1 ? 172 : lines.length === 2 ? 136 : lines.length === 3 ? 108 : 86;
    const compressedFontSize = Math.max(58, Math.floor((width - 160) / Math.max(maxLineLength, 1) * 1.72));
    const preliminaryFontSize = Math.min(baseFontSize, compressedFontSize);
    const variant =
      GENERATED_LOGO_FONT_VARIANTS.find((item) => item.id === logoFontVariant) ||
      GENERATED_LOGO_FONT_VARIANTS.find((item) => item.id === DEFAULT_LOGO_FONT_VARIANT) ||
      GENERATED_LOGO_FONT_VARIANTS[0];
    const resolvedPrimaryColor = normalizeHexColor(primaryColor, DEFAULT_LOGO_CUSTOM_PRIMARY);
    const resolvedSecondaryColor = normalizeHexColor(secondaryColor, DEFAULT_LOGO_CUSTOM_SECONDARY);
    const resolvedOutlineColor = normalizeHexColor(outlineColor, DEFAULT_LOGO_CUSTOM_OUTLINE);
    const resolvedShadowColor =
      variant.fillMode === 'outline'
        ? resolvedSecondaryColor
        : mixHexColors(resolvedPrimaryColor, resolvedSecondaryColor, 0.45);
    const longestEstimatedLineWidth = Math.max(
      ...lines.map((line) => estimateGeneratedLogoLineWidth(line, preliminaryFontSize)),
      1
    );
    const widthFitScale = Math.min(1, availableLineWidth / longestEstimatedLineWidth);
    const fontSize = Math.max(54, Math.floor(preliminaryFontSize * widthFitScale));
    const lineHeight = Math.round(fontSize * 0.96);
    const topPadding = Math.round(fontSize * (variant.topPaddingFactor ?? 0.08));
    const bottomPadding = Math.round(fontSize * (variant.bottomPaddingFactor ?? 0.08));
    const contentHeight = Math.max(1, height - topPadding - bottomPadding);
    const totalTextHeight = lineHeight * Math.max(0, lines.length - 1);
    const startY = Math.round(topPadding + contentHeight / 2 - totalTextHeight / 2 + fontSize * 0.34);
    const strokeWidth =
      variant.fillMode === 'outline'
        ? Math.max(5, Math.round(fontSize * 0.09))
        : Math.max(4, Math.round(fontSize * 0.07));
    const letterSpacing = Math.max(1, Math.round(fontSize * variant.letterSpacingFactor));
    const displayLines = variant.uppercase ? lines.map((line) => line.toUpperCase()) : lines;
    const baseShadow = variant.shadow || { dy: 8, stdDeviation: 10, color: '#000000', opacity: 0.3 };
    const shadow = {
      ...baseShadow,
      color: resolvedShadowColor,
    };
    const tspans = lines
      .map((_, index) => {
        const line = displayLines[index] || '';
        const y = startY + index * lineHeight;
        const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, fontSize);
        const textLength =
          estimatedLineWidth > availableLineWidth
            ? ` textLength="${availableLineWidth}" lengthAdjust="spacingAndGlyphs"`
            : '';
        return `<tspan x="${Math.round(width / 2)}" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
      })
      .join('');
    const fillId = `logo-fill-${variant.id}`;
    const fillValue =
      variant.fillMode === 'gradient'
        ? `url(#${fillId})`
        : variant.fillMode === 'outline'
          ? 'rgba(255,255,255,0.02)'
          : resolvedPrimaryColor;
    const defs = [
      `<filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${shadow.dy}" stdDeviation="${shadow.stdDeviation}" flood-color="${shadow.color}" flood-opacity="${shadow.opacity}" /></filter>`,
    ];
    const customGradientStops =
      (variant.gradientStops?.length || 0) <= 2
        ? [
          { offset: '0%', color: resolvedPrimaryColor },
          { offset: '100%', color: resolvedSecondaryColor },
        ]
        : [
          { offset: '0%', color: resolvedPrimaryColor },
          { offset: '50%', color: resolvedSecondaryColor },
          { offset: '100%', color: resolvedSecondaryColor },
        ];
    if (variant.fillMode === 'gradient' && variant.gradientStops?.length) {
      defs.push(
        `<linearGradient id="${fillId}" x1="0%" y1="0%" x2="0%" y2="100%">${customGradientStops
          .map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}" />`)
          .join('')}</linearGradient>`
      );
    }
    const transform = variant.skewX ? ` transform="skewX(${variant.skewX})"` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  ${defs.join('\n  ')}
</defs>
<g${transform}>
  <text x="${Math.round(width / 2)}" y="${startY}" text-anchor="middle" font-family="${variant.fontFamily}" font-size="${fontSize}" font-weight="${variant.weight}"${variant.italic ? ' font-style="italic"' : ''} letter-spacing="${letterSpacing}" fill="${fillValue}" stroke="${toRgba(resolvedOutlineColor, variant.strokeOpacity ?? 0.92)}" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#logo-shadow)">${tspans}</text>
</g>
</svg>`;
    const generatedLogo = {
      dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      aspectRatio,
    };
    setCachedGeneratedLogoVariant(cacheKey, generatedLogo);
    await writeGeneratedLogoVariantToStorage(cacheKey, svg);
    return generatedLogo;
  });
};

const splitTitleForPosterText = (title: string) => {
  const lines = splitTitleForGeneratedLogo(title);
  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(' ')];
};

const buildPosterTitleSvg = (title: string, maxWidth: number) => {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const lines = splitTitleForPosterText(normalized);
  const width = Math.max(260, Math.round(maxWidth));
  const availableLineWidth = Math.max(220, width - 48);
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const baseFontSize = lines.length === 1 ? 64 : 54;
  const compressedFontSize = Math.floor((availableLineWidth / Math.max(1, maxLineLength)) * 1.35);
  const preliminaryFontSize = Math.min(baseFontSize, compressedFontSize);
  const longestEstimatedLineWidth = Math.max(
    ...lines.map((line) => estimateGeneratedLogoLineWidth(line, preliminaryFontSize)),
    1
  );
  const widthFitScale = Math.min(1, availableLineWidth / longestEstimatedLineWidth);
  const fontSize = Math.max(26, Math.floor(preliminaryFontSize * widthFitScale));
  const lineHeight = Math.round(fontSize * 1.08);
  const height = Math.round(lineHeight * lines.length);
  const startY = Math.round(fontSize * 0.9);
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.1));
  const letterSpacing = Math.max(1, Math.round(fontSize * 0.015));
  const tspans = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, fontSize);
      const textLength =
        estimatedLineWidth > availableLineWidth
          ? ` textLength="${availableLineWidth}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<tspan x="${Math.round(width / 2)}" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <filter id="poster-title-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
  </filter>
</defs>
<text x="${Math.round(width / 2)}" y="${startY}" text-anchor="middle" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="${letterSpacing}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#poster-title-shadow)">${tspans}</text>
</svg>`;
  return { svg, width, height };
};

const buildThumbnailFallbackTitleSvg = (
  episodeCode: string,
  title: string,
  maxWidth: number
) => {
  const normalizedCode = episodeCode.replace(/\s+/g, ' ').trim();
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  if (!normalizedCode && !normalizedTitle) return null;

  const titleLines = normalizedTitle ? splitTitleForPosterText(normalizedTitle).slice(0, 2) : [];
  const width = Math.max(320, Math.round(maxWidth));
  const contentWidth = Math.max(260, width - 40);
  const codeFontSize = 22;
  const titleBaseFontSize = titleLines.length <= 1 ? 34 : 30;
  const longestTitleWidth = Math.max(
    ...titleLines.map((line) => estimateGeneratedLogoLineWidth(line, titleBaseFontSize)),
    1
  );
  const titleWidthFitScale = Math.min(1, contentWidth / longestTitleWidth);
  const titleFontSize = Math.max(20, Math.floor(titleBaseFontSize * titleWidthFitScale));
  const titleLineHeight = Math.round(titleFontSize * 1.08);
  const codeY = 32;
  const titleStartY = normalizedCode ? 62 : 36;
  const titleTspans = titleLines
    .map((line, index) => {
      const y = titleStartY + index * titleLineHeight;
      const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, titleFontSize);
      const textLength =
        estimatedLineWidth > contentWidth
          ? ` textLength="${contentWidth}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<tspan x="20" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  const height = Math.max(56, 28 + (normalizedCode ? 24 : 0) + titleLines.length * titleLineHeight + 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <linearGradient id="thumbnail-fallback-bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(15,23,42,0.84)" />
    <stop offset="100%" stop-color="rgba(2,6,23,0.92)" />
  </linearGradient>
  <filter id="thumbnail-fallback-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.42" />
  </filter>
</defs>
<rect x="0.75" y="0.75" width="${Math.max(0, width - 1.5)}" height="${Math.max(0, height - 1.5)}" rx="18" fill="url(#thumbnail-fallback-bg)" stroke="rgba(255,255,255,0.14)" filter="url(#thumbnail-fallback-shadow)" />
${normalizedCode ? `<text x="20" y="${codeY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${codeFontSize}" font-weight="800" letter-spacing="1.4" fill="rgba(255,255,255,0.82)">${escapeXml(normalizedCode)}</text>` : ''}
${titleLines.length > 0 ? `<text x="20" y="${titleStartY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${titleFontSize}" font-weight="800" fill="#ffffff">${titleTspans}</text>` : ''}
</svg>`;
  return { svg, width, height };
};

const chunkBy = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

type BadgeLayoutMetrics = {
  iconSize: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
  gap: number;
};
type PosterBadgeGroups = {
  topBadges: RatingBadge[];
  bottomBadges: RatingBadge[];
  leftBadges: RatingBadge[];
  rightBadges: RatingBadge[];
};
type BackdropBadgeRegion = {
  left: number;
  width: number;
};

type BackdropBadgePlacement = BackdropBadgeRegion & {
  align: 'left' | 'center' | 'right';
  vertical: 'top' | 'center' | 'bottom';
  stack: 'row' | 'column';
};
const DEFAULT_BADGE_MIN_METRICS: BadgeLayoutMetrics = {
  iconSize: 24,
  fontSize: 18,
  paddingX: 8,
  paddingY: 6,
  gap: 6,
};
const normalizeVerticalBadgeContent = (value?: string | null): 'standard' | 'stacked' => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === 'stacked' ? 'stacked' : 'standard';
};
const getBadgeTextRightInset = (
  value: string,
  fontSize: number,
  paddingX: number,
  compactText = false
) => {
  const normalized = value.trim();
  const baseInset = Math.max(
    compactText ? 7 : 12,
    Math.round(fontSize * (compactText ? 0.28 : 0.38)) + Math.round(paddingX * 0.75)
  );
  const trailingPercentInset =
    normalized.endsWith('%')
      ? Math.max(
        compactText ? 9 : 12,
        Math.round(fontSize * (compactText ? 0.3 : 0.28))
      )
      : 0;
  return baseInset + trailingPercentInset;
};

const estimateBadgeTextWidth = (
  value: string,
  fontSize: number,
  compactText = false
) => {
  const normalized = value.trim();
  if (!normalized) {
    return Math.round(fontSize * (compactText ? 1.14 : 1.3));
  }
  const measureChar = (ch: string) => {
    if (/[0-9]/.test(ch)) return fontSize * (compactText ? 0.51 : 0.56);
    if (ch === '%') return fontSize * (compactText ? 0.56 : 0.62);
    if (ch === '/' || ch === '|') return fontSize * (compactText ? 0.34 : 0.40);
    if (ch === '.' || ch === ',' || ch === ':') return fontSize * (compactText ? 0.22 : 0.28);
    if (ch === ' ') return fontSize * (compactText ? 0.24 : 0.30);
    return fontSize * (compactText ? 0.54 : 0.58);
  };
  const measuredTextWidth = [...normalized].reduce((acc, ch) => acc + measureChar(ch), 0);
  const safetyRightPadding = Math.max(
    compactText ? 1 : 2,
    Math.round(
      fontSize *
      (normalized.endsWith('%') || normalized.includes('/')
        ? compactText ? 0.20 : 0.28
        : compactText ? 0.04 : 0.06)
    )
  );
  const structureWidth = Math.round(normalized.length * fontSize * (compactText ? 0.38 : 0.44));
  const isShortDecimalValue = /^\d+(?:[.,]\d)?$/.test(normalized) && !normalized.includes('/');
  const shortDecimalMinWidth = isShortDecimalValue
    ? Math.round(fontSize * (compactText ? 1.52 : 1.68))
    : 0;
  return Math.max(
    shortDecimalMinWidth,
    Math.round(fontSize * (compactText ? 0.92 : 1.00)),
    Math.round(measuredTextWidth + safetyRightPadding),
    structureWidth
  );
};

const estimateBadgeWidth = (
  value: string,
  fontSize: number,
  paddingX: number,
  iconSize: number,
  gap: number,
  compactText = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const textWidth = estimateBadgeTextWidth(value, fontSize, compactText);
  const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
  const innerGap = outerPadding;
  if (contentLayout === 'stacked') {
    return Math.max(
      outerPadding * 2 + iconSize,
      outerPadding * 2 + textWidth,
      outerPadding * 2 + Math.round(fontSize * (compactText ? 1.12 : 1.25))
    );
  }
  return Math.max(
    outerPadding + iconSize + innerGap + textWidth + outerPadding,
    outerPadding + iconSize + innerGap + outerPadding + Math.round(fontSize * (compactText ? 1.12 : 1.25))
  );
};
const estimateBadgeHeight = (
  fontSize: number,
  paddingX: number,
  paddingY: number,
  iconSize: number,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  if (contentLayout === 'stacked') {
    const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
    const innerGap = Math.max(6, Math.round(paddingY));
    const textBlockHeight = Math.max(Math.round(fontSize * 1.24), fontSize + 6);
    const bottomPadding = Math.max(outerPadding + 2, paddingY + 4);
    return outerPadding + iconSize + innerGap + textBlockHeight + bottomPadding;
  }
  return iconSize + paddingY * 2;
};
const getMinimumCompressedBadgeWidth = (
  value: string,
  fontSize: number,
  paddingX: number,
  iconSize: number,
  gap: number,
  compactText = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
  if (contentLayout === 'stacked') {
    return Math.max(outerPadding * 2 + iconSize, outerPadding * 2 + Math.round(fontSize * (compactText ? 0.82 : 0.92)));
  }
  return (
    outerPadding +
    iconSize +
    outerPadding +
    outerPadding +
    Math.round(fontSize * (compactText ? 0.82 : 0.92))
  );
};

const measureBadgeRowWidth = (
  rowBadges: RatingBadge[],
  metrics: BadgeLayoutMetrics,
  compactText = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  if (rowBadges.length === 0) return 0;
  return (
    rowBadges.reduce(
      (acc, badge) =>
        acc +
        estimateBadgeWidth(
          badge.value,
          metrics.fontSize,
          metrics.paddingX,
          metrics.iconSize,
          metrics.gap,
          compactText,
          contentLayout
        ),
      0
    ) +
    Math.max(0, rowBadges.length - 1) * metrics.gap
  );
};

const getLogoCanvasWidth = (aspectRatio?: number | null) => {
  const normalizedAspectRatio = Math.max(
    LOGO_FALLBACK_ASPECT_RATIO,
    aspectRatio || LOGO_FALLBACK_ASPECT_RATIO
  );
  return Math.min(
    LOGO_MAX_WIDTH,
    Math.max(LOGO_MIN_WIDTH, Math.round(LOGO_BASE_HEIGHT * normalizedAspectRatio))
  );
};


const fitPosterBadgeMetricsToWidth = (
  rows: RatingBadge[][],
  outputWidth: number,
  initialMetrics: BadgeLayoutMetrics,
  minMetrics: BadgeLayoutMetrics = DEFAULT_BADGE_MIN_METRICS,
  compactText = false,
  preserveContent = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const maxRowWidth = Math.max(0, outputWidth - 24);
  const metrics: BadgeLayoutMetrics = { ...initialMetrics };

  const measureWidestRow = () =>
    rows.reduce((maxWidth, row) => Math.max(maxWidth, measureBadgeRowWidth(row, metrics, compactText, contentLayout)), 0);

  let widestRow = measureWidestRow();
  let attempts = 0;

  while (widestRow > maxRowWidth && attempts < 20) {
    const ratio = Math.max(0.84, Math.min(0.96, maxRowWidth / widestRow));
    if (preserveContent) {
      const chromeRatio = Math.max(0.68, ratio * ratio);
      const verticalRatio = Math.max(0.76, ratio * ratio);
      const iconRatio = Math.max(0.88, Math.min(0.97, ratio + 0.05));
      const fontRatio = Math.max(0.92, Math.min(0.98, ratio + 0.09));
      metrics.paddingX = Math.max(minMetrics.paddingX, Math.floor(metrics.paddingX * chromeRatio));
      metrics.paddingY = Math.max(minMetrics.paddingY, Math.floor(metrics.paddingY * verticalRatio));
      metrics.gap = Math.max(minMetrics.gap, Math.floor(metrics.gap * chromeRatio));
      metrics.iconSize = Math.max(minMetrics.iconSize, Math.floor(metrics.iconSize * iconRatio));
      metrics.fontSize = Math.max(minMetrics.fontSize, Math.floor(metrics.fontSize * fontRatio));
    } else {
      metrics.iconSize = Math.max(minMetrics.iconSize, Math.floor(metrics.iconSize * ratio));
      metrics.fontSize = Math.max(minMetrics.fontSize, Math.floor(metrics.fontSize * ratio));
      metrics.paddingX = Math.max(minMetrics.paddingX, Math.floor(metrics.paddingX * ratio));
      metrics.paddingY = Math.max(minMetrics.paddingY, Math.floor(metrics.paddingY * ratio));
      metrics.gap = Math.max(minMetrics.gap, Math.floor(metrics.gap * ratio));
    }

    // When the ratio stalls near the minimums, force a small extra shrink.
    if (widestRow > maxRowWidth) {
      if (metrics.paddingX > minMetrics.paddingX) metrics.paddingX -= 1;
      else if (metrics.gap > minMetrics.gap) metrics.gap -= 1;
      else if (metrics.paddingY > minMetrics.paddingY) metrics.paddingY -= 1;
      else if (!preserveContent && metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
      else if (metrics.iconSize > minMetrics.iconSize) metrics.iconSize -= 1;
      else if (metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
      else break;
    }

    widestRow = measureWidestRow();
    attempts += 1;
  }

  while (widestRow > maxRowWidth) {
    if (metrics.gap > minMetrics.gap) metrics.gap -= 1;
    else if (metrics.paddingX > minMetrics.paddingX) metrics.paddingX -= 1;
    else if (metrics.paddingY > minMetrics.paddingY) metrics.paddingY -= 1;
    else if (metrics.iconSize > minMetrics.iconSize) metrics.iconSize -= 1;
    else if (metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
    else break;
    widestRow = measureWidestRow();
  }

  return metrics;
};

const measureBadgeColumnHeight = (
  columnBadges: RatingBadge[],
  metrics: BadgeLayoutMetrics,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  if (columnBadges.length === 0) return 0;
  const badgeHeight = estimateBadgeHeight(
    metrics.fontSize,
    metrics.paddingX,
    metrics.paddingY,
    metrics.iconSize,
    contentLayout
  );
  return columnBadges.length * badgeHeight + Math.max(0, columnBadges.length - 1) * metrics.gap;
};

const getMaxBadgeColumnCount = (
  outputHeight: number,
  metrics: BadgeLayoutMetrics,
  topOffset: number,
  bottomOffset: number,
  reservedTopRows = 0,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const badgeHeight = estimateBadgeHeight(
    metrics.fontSize,
    metrics.paddingX,
    metrics.paddingY,
    metrics.iconSize,
    contentLayout
  );
  const step = badgeHeight + metrics.gap;
  const reservedTopHeight = reservedTopRows > 0 ? reservedTopRows * step : 0;
  const availableHeight = Math.max(0, outputHeight - topOffset - bottomOffset - reservedTopHeight);
  if (badgeHeight <= 0 || step <= 0) return 1;
  return Math.max(1, Math.floor((availableHeight + metrics.gap) / step));
};

const fitPosterBadgeMetricsToHeight = (
  columns: RatingBadge[][],
  outputHeight: number,
  initialMetrics: BadgeLayoutMetrics,
  topOffset: number,
  bottomOffset: number,
  minMetrics: BadgeLayoutMetrics = DEFAULT_BADGE_MIN_METRICS,
  reservedTopRows = 0,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const metrics: BadgeLayoutMetrics = { ...initialMetrics };
  const getMaxColumnHeight = () => {
    const badgeHeight = estimateBadgeHeight(
      metrics.fontSize,
      metrics.paddingX,
      metrics.paddingY,
      metrics.iconSize,
      contentLayout
    );
    const reservedTopHeight =
      reservedTopRows > 0 ? reservedTopRows * (badgeHeight + metrics.gap) : 0;
    return Math.max(0, outputHeight - topOffset - bottomOffset - reservedTopHeight);
  };

  const measureTallestColumn = () =>
    columns.reduce((maxHeight, column) => Math.max(maxHeight, measureBadgeColumnHeight(column, metrics, contentLayout)), 0);

  let tallestColumn = measureTallestColumn();
  let attempts = 0;

  while (tallestColumn > getMaxColumnHeight() && attempts < 12) {
    const maxColumnHeight = getMaxColumnHeight();
    const ratio = Math.max(0.84, Math.min(0.96, maxColumnHeight / tallestColumn));
    metrics.iconSize = Math.max(minMetrics.iconSize, Math.floor(metrics.iconSize * ratio));
    metrics.fontSize = Math.max(minMetrics.fontSize, Math.floor(metrics.fontSize * ratio));
    metrics.paddingX = Math.max(minMetrics.paddingX, Math.floor(metrics.paddingX * ratio));
    metrics.paddingY = Math.max(minMetrics.paddingY, Math.floor(metrics.paddingY * ratio));
    metrics.gap = Math.max(minMetrics.gap, Math.floor(metrics.gap * ratio));

    if (tallestColumn > getMaxColumnHeight()) {
      if (metrics.paddingY > minMetrics.paddingY) metrics.paddingY -= 1;
      else if (metrics.gap > minMetrics.gap) metrics.gap -= 1;
      else if (metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
      else if (metrics.iconSize > minMetrics.iconSize) metrics.iconSize -= 1;
      else if (metrics.paddingX > minMetrics.paddingX) metrics.paddingX -= 1;
      else break;
    }

    tallestColumn = measureTallestColumn();
    attempts += 1;
  }

  return metrics;
};

const splitPosterBadgesByLayout = (
  badges: RatingBadge[],
  layout: PosterRatingLayout,
  maxPerColumn?: number
): PosterBadgeGroups => {
  const totalLimit = getPosterRatingLayoutMaxBadges(layout, maxPerColumn);
  const limitedBadges = typeof totalLimit === 'number' ? badges.slice(0, totalLimit) : badges;
  const columnLimit = typeof maxPerColumn === 'number' ? Math.max(1, maxPerColumn) : null;
  if (layout === 'top') {
    return { topBadges: limitedBadges, bottomBadges: [], leftBadges: [], rightBadges: [] };
  }
  if (layout === 'bottom') {
    return { topBadges: [], bottomBadges: limitedBadges, leftBadges: [], rightBadges: [] };
  }
  if (layout === 'left') {
    return {
      topBadges: [],
      bottomBadges: [],
      leftBadges: columnLimit ? limitedBadges.slice(0, columnLimit) : limitedBadges,
      rightBadges: [],
    };
  }
  if (layout === 'right') {
    return {
      topBadges: [],
      bottomBadges: [],
      leftBadges: [],
      rightBadges: columnLimit ? limitedBadges.slice(0, columnLimit) : limitedBadges,
    };
  }

  if (layout === 'left-right') {
    if (limitedBadges.length % 2 === 1) {
      const topBadges = limitedBadges.slice(0, 1);
      const sideBadges = limitedBadges.slice(1);
      const columnSize = Math.ceil(sideBadges.length / 2);
      return {
        topBadges,
        bottomBadges: [],
        leftBadges: sideBadges.slice(0, columnSize),
        rightBadges: sideBadges.slice(columnSize, columnSize * 2),
      };
    }

    const columnSize = Math.ceil(limitedBadges.length / 2);
    return {
      topBadges: [],
      bottomBadges: [],
      leftBadges: limitedBadges.slice(0, columnSize),
      rightBadges: limitedBadges.slice(columnSize, columnSize * 2),
    };
  }

  const primary = limitedBadges.slice(0, 3);
  const secondary = limitedBadges.slice(3, 6);
  return { topBadges: primary, bottomBadges: secondary, leftBadges: [], rightBadges: [] };
};

const getBackdropBadgePlacement = (
  outputWidth: number,
  layout: BackdropRatingLayout | ThumbnailRatingLayout,
  imageType: 'backdrop' | 'thumbnail' = 'backdrop'
): BackdropBadgePlacement => {
  const isVertical =
    imageType === 'thumbnail'
      ? isVerticalThumbnailRatingLayout(layout as ThumbnailRatingLayout)
      : layout === 'right-vertical';
  const baseLayout =
    imageType === 'thumbnail' && isVertical ? layout.replace(/-vertical$/, '') : layout;
  const isRight = baseLayout.startsWith('right');
  const isLeft = baseLayout.startsWith('left');
  const isTop = baseLayout.endsWith('-top');
  const isBottom = baseLayout.endsWith('-bottom');
  const vertical =
    imageType === 'backdrop' ? 'top' : isTop ? 'top' : isBottom ? 'bottom' : 'center';

  if (!isRight && !isLeft) {
    return {
      left: 0,
      width: outputWidth,
      align: 'center',
      vertical,
      stack: isVertical ? 'column' : 'row',
    };
  }

  if (imageType === 'thumbnail' && !isVertical) {
    return {
      left: 12,
      width: Math.max(0, outputWidth - 24),
      align: isRight ? 'right' : 'left',
      vertical,
      stack: 'row',
    };
  }

  const width = Math.min(outputWidth - 24, Math.max(280, Math.floor(outputWidth * 0.46)));
  return {
    left: isRight ? Math.max(12, outputWidth - width - 12) : 12,
    width,
    align: isRight ? 'right' : 'left',
    vertical,
    stack: isVertical ? 'column' : 'row',
  };
};

const splitBackdropVerticalBadgesIntoColumns = (
  badges: RatingBadge[],
  placement: BackdropBadgePlacement,
  metrics: BadgeLayoutMetrics,
  maxPerColumn: number,
  contentLayout: 'standard' | 'stacked' = 'standard',
  maxColumns = 3
) => {
  if (badges.length === 0 || maxPerColumn <= 0) return [];
  const effectiveMaxColumns = Math.max(1, maxColumns);
  const columnGap = Math.max(12, metrics.gap);
  const estimateColumnMaxWidth = (columnBadges: RatingBadge[]) =>
    columnBadges.reduce(
      (maxWidth, badge) =>
        Math.max(
          maxWidth,
          estimateBadgeWidth(
            badge.value,
            metrics.fontSize,
            metrics.paddingX,
            metrics.iconSize,
            metrics.gap,
            false,
            contentLayout
          )
        ),
      0
    );
  const requestedColumnCount = Math.max(1, Math.ceil(badges.length / maxPerColumn));
  const startingColumnCount = Math.min(effectiveMaxColumns, requestedColumnCount);

  for (let columnCount = startingColumnCount; columnCount >= 1; columnCount -= 1) {
    const visibleBadges = badges.slice(0, columnCount * maxPerColumn);
    const orderedColumns = Array.from({ length: columnCount }, (_, index) =>
      visibleBadges.slice(index * maxPerColumn, (index + 1) * maxPerColumn)
    ).filter((column) => column.length > 0);
    const visualColumns =
      placement.align === 'right' ? [...orderedColumns].reverse() : orderedColumns;
    const totalWidth =
      visualColumns.reduce((sum, column) => sum + estimateColumnMaxWidth(column), 0) +
      Math.max(0, visualColumns.length - 1) * columnGap;
    if (totalWidth <= placement.width) {
      return visualColumns;
    }
  }

  return [badges.slice(0, maxPerColumn)];
};

const getBadgeOuterRadius = (height: number, ratingStyle: RatingStyle) =>
  ratingStyle === 'square' ? Math.max(10, Math.round(height * 0.24)) : Math.round(height / 2);

const getBadgeIconRadius = (iconSize: number, ratingStyle: RatingStyle) =>
  ratingStyle === 'square' ? Math.max(6, Math.round(iconSize * 0.22)) : Math.round(iconSize / 2);

const buildQualityBadgeSvg = (
  key: StreamBadgeKey,
  height: number,
  widthOverride?: number,
  style: RatingStyle = DEFAULT_QUALITY_BADGES_STYLE
) => {
  const h = Math.max(32, Math.round(height * 0.9));
  const radius = style === 'glass' ? Math.round(h / 2) : Math.round(h * 0.18);
  const strokeWidth =
    style === 'glass'
      ? 1
      : style === 'square'
        ? Math.max(1, Math.round(h * 0.05))
        : Math.max(2, Math.round(h * 0.08));
  const innerPadding = Math.max(10, Math.round(h * 0.16));
  const fontFamily = `'Noto Sans','DejaVu Sans',Arial,sans-serif`;
  const baseRect = (width: number, stroke: string, fill: string, extra = '') =>
    `<rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${Math.max(0, width - strokeWidth)}" height="${Math.max(0, h - strokeWidth)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${extra}/>`;
  const resolveChrome = (accentColor: string) => {
    if (style === 'plain') return null;
    if (style === 'glass') {
      return {
        stroke: accentColor,
        strokeOpacity: '0.58',
        fill: 'rgba(17,24,39,0.70)',
      };
    }
    return { stroke: accentColor, strokeOpacity: '1', fill: '#0b0b0b' };
  };
  const buildRect = (width: number, accentColor: string, extra = '') => {
    const chrome = resolveChrome(accentColor);
    if (!chrome) return '';
    const chromeExtra = chrome.strokeOpacity ? `${extra} stroke-opacity="${chrome.strokeOpacity}"` : extra;
    return baseRect(width, chrome.stroke, chrome.fill, chromeExtra);
  };

  if (key === '4k') {
    const width = widthOverride ?? Math.round(h * 1.55);
    const bigSize = Math.round(h * 0.56);
    const smallSize = Math.round(h * 0.2);
    const bigY = Math.round(h * 0.58);
    const smallY = Math.round(h * 0.86);
    const color = '#f7c948';
    const rect = buildRect(width, color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
<text x="${width / 2}" y="${bigY}" font-family="${fontFamily}" font-size="${bigSize}" font-weight="800" text-anchor="middle" fill="${color}">4K</text>
<text x="${width / 2}" y="${smallY}" font-family="${fontFamily}" font-size="${smallSize}" font-weight="700" text-anchor="middle" fill="${color}" letter-spacing="0.06em">ULTRA HD</text>
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'hdr') {
    const width = widthOverride ?? Math.round(h * 1.6);
    const bigSize = Math.round(h * 0.5);
    const smallSize = Math.round(h * 0.2);
    const bigY = Math.round(h * 0.57);
    const smallY = Math.round(h * 0.86);
    const rect =
      style === 'square'
        ? baseRect(width, 'url(#hdrBorder)', '#0b0b0b')
        : buildRect(width, '#e5e7eb');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
<defs>
  <linearGradient id="hdrBorder" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#22c55e"/>
    <stop offset="50%" stop-color="#22d3ee"/>
    <stop offset="100%" stop-color="#facc15"/>
  </linearGradient>
</defs>
${rect}
<text x="${width / 2}" y="${bigY}" font-family="${fontFamily}" font-size="${bigSize}" font-weight="800" text-anchor="middle" fill="white">HDR</text>
<text x="${width / 2}" y="${smallY}" font-family="${fontFamily}" font-size="${smallSize}" font-weight="700" text-anchor="middle" fill="#a7f3d0" letter-spacing="0.05em">TRUE COLOR</text>
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'dolbyvision') {
    const width = widthOverride ?? Math.round(h * 1.95);
    const topSize = Math.round(h * 0.22);
    const bottomSize = Math.round(h * 0.42);
    const topY = Math.round(h * 0.36);
    const bottomY = Math.round(h * 0.73);
    const textLength = Math.max(40, Math.floor(width - innerPadding * 2));
    const rect = buildRect(width, '#e5e7eb');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
<text x="${width / 2}" y="${topY}" font-family="${fontFamily}" font-size="${topSize}" font-weight="700" text-anchor="middle" fill="#e5e7eb" letter-spacing="0.18em" textLength="${textLength}" lengthAdjust="spacingAndGlyphs">DOLBY</text>
<text x="${width / 2}" y="${bottomY}" font-family="${fontFamily}" font-size="${bottomSize}" font-weight="800" text-anchor="middle" fill="#e5e7eb" textLength="${textLength}" lengthAdjust="spacingAndGlyphs">VISION</text>
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'dolbyatmos') {
    const width = widthOverride ?? Math.round(h * 1.95);
    const topSize = Math.round(h * 0.22);
    const bottomSize = Math.round(h * 0.42);
    const topY = Math.round(h * 0.36);
    const bottomY = Math.round(h * 0.73);
    const textLength = Math.max(40, Math.floor(width - innerPadding * 2));
    const rect = buildRect(width, '#e5e7eb');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
<text x="${width / 2}" y="${topY}" font-family="${fontFamily}" font-size="${topSize}" font-weight="700" text-anchor="middle" fill="#e5e7eb" letter-spacing="0.18em" textLength="${textLength}" lengthAdjust="spacingAndGlyphs">DOLBY</text>
<text x="${width / 2}" y="${bottomY}" font-family="${fontFamily}" font-size="${bottomSize}" font-weight="800" text-anchor="middle" fill="#e5e7eb" textLength="${textLength}" lengthAdjust="spacingAndGlyphs">ATMOS</text>
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'remux') {
    const width = widthOverride ?? Math.round(h * 1.55);
    const textSize = Math.round(h * 0.42);
    const textY = Math.round(h * 0.63);
    const color = '#ef4444';
    const rect = buildRect(width, color);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
<text x="${width / 2}" y="${textY}" font-family="${fontFamily}" font-size="${textSize}" font-weight="800" text-anchor="middle" fill="${color}" letter-spacing="0.08em">REMUX</text>
</svg>`;
    return { svg, width, height: h };
  }

  return null;
};

const buildBadgeSvg = ({
  width,
  height,
  iconSize,
  fontSize,
  paddingX,
  gap,
  accentColor,
  monogram,
  iconDataUri,
  iconCornerRadius = 0,
  iconScale,
  value,
  ratingStyle,
  compactText = false,
  contentLayout = 'standard',
}: {
  width: number;
  height: number;
  iconSize: number;
  fontSize: number;
  paddingX: number;
  gap: number;
  accentColor: string;
  monogram: string;
  iconDataUri?: string | null;
  iconCornerRadius?: number;
  iconScale?: number;
  value: string;
  ratingStyle: RatingStyle;
  compactText?: boolean;
  contentLayout?: 'standard' | 'stacked';
}) => {
  const radius = getBadgeOuterRadius(height, ratingStyle);
  const outerRadius =
    contentLayout === 'stacked' && ratingStyle === 'glass'
      ? Math.max(16, Math.round(iconSize * 0.78))
      : radius;
  const iconRadius = getBadgeIconRadius(iconSize, ratingStyle);
  const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
  const innerGap = contentLayout === 'stacked' ? Math.max(4, Math.round(outerPadding * 0.65)) : outerPadding;
  const iconX =
    contentLayout === 'stacked'
      ? Math.max(outerPadding, Math.round((width - iconSize) / 2))
      : outerPadding;
  const iconY =
    contentLayout === 'stacked'
      ? outerPadding
      : Math.round((height - iconSize) / 2);
  const iconCx = iconX + Math.round(iconSize / 2);
  const iconCy = iconY + Math.round(iconSize / 2);
  const iconFontSize = Math.max(12, Math.round(iconSize * 0.42));
  const resolvedIconScale =
    typeof iconScale === 'number' && Number.isFinite(iconScale)
      ? Math.max(0.5, Math.min(1.15, iconScale))
      : 1;
  const baseRenderedIconSize = ratingStyle === 'plain' ? iconSize - 2 : iconSize - 3;
  const renderedIconSize = Math.max(1, Math.round(baseRenderedIconSize * resolvedIconScale));
  const iconImageOffset = (baseRenderedIconSize - renderedIconSize) / 2;
  const iconImageX = (ratingStyle === 'plain' ? iconX + 1 : iconX + 1.5) + iconImageOffset;
  const iconImageY = (ratingStyle === 'plain' ? iconY + 1 : iconY + 1.5) + iconImageOffset;
  const valueX = contentLayout === 'stacked' ? Math.round(width / 2) : iconX + iconSize + innerGap;
  const valueY =
    contentLayout === 'stacked'
      ? iconY + iconSize + innerGap + fontSize
      : Math.round(height / 2 + fontSize * 0.36);
  const valueTextWidth = estimateBadgeTextWidth(value, fontSize, compactText);
  const valueRightInset = outerPadding;
  const valueAvailableWidth =
    contentLayout === 'stacked'
      ? Math.max(0, width - outerPadding * 2)
      : Math.max(0, width - valueX - valueRightInset);
  const valueTextLength =
    compactText && valueTextWidth > valueAvailableWidth
      ? ` textLength="${valueAvailableWidth}" lengthAdjust="spacingAndGlyphs"`
      : '';
  const valueFontFamily = compactText
    ? `'Noto Sans','DejaVu Sans','Arial Narrow','Liberation Sans Narrow','Nimbus Sans Narrow','Roboto Condensed',Arial,sans-serif`
    : `'Noto Sans','DejaVu Sans',Arial,sans-serif`;
  const valueLetterSpacing = compactText ? ' letter-spacing="-0.04em"' : '';
  const iconShape =
    ratingStyle === 'plain' || iconDataUri
      ? ''
      : ratingStyle === 'square'
        ? `<rect x="${iconX + 0.75}" y="${iconY + 0.75}" width="${Math.max(0, iconSize - 1.5)}" height="${Math.max(0, iconSize - 1.5)}" rx="${Math.max(4, iconCornerRadius || iconRadius)}" fill="rgb(10,10,10)" />`
        : `<circle cx="${iconCx}" cy="${iconCy}" r="${iconRadius}" fill="${accentColor}" stroke="rgba(255,255,255,0.45)" />`;
  const iconClipPath =
    ratingStyle === 'plain'
      ? ''
      : ratingStyle === 'square'
        ? `<rect x="${iconX + 1.5}" y="${iconY + 1.5}" width="${Math.max(0, iconSize - 3)}" height="${Math.max(0, iconSize - 3)}" rx="${Math.max(4, iconCornerRadius || iconRadius - 1)}" />`
        : `<circle cx="${iconCx}" cy="${iconCy}" r="${Math.max(1, iconRadius - 1)}" />`;
  const iconBorder =
    ratingStyle === 'plain' || iconDataUri
      ? ''
      : ratingStyle === 'square'
        ? iconCornerRadius > 0
          ? `<rect x="${iconX + 1.5}" y="${iconY + 1.5}" width="${Math.max(0, iconSize - 3)}" height="${Math.max(0, iconSize - 3)}" rx="${Math.max(4, iconCornerRadius || iconRadius - 1)}" fill="none" stroke="rgba(255,255,255,0.18)" />`
          : ''
        : `<circle cx="${iconCx}" cy="${iconCy}" r="${iconRadius}" fill="none" stroke="rgba(255,255,255,0.45)" />`;
  const outerRect =
    ratingStyle === 'plain'
      ? ''
      : `<rect x="0.75" y="0.75" width="${Math.max(0, width - 1.5)}" height="${Math.max(0, height - 1.5)}" rx="${outerRadius}" fill="${ratingStyle === 'square' ? 'rgb(5,5,5)' : 'rgb(17,24,39)'}" fill-opacity="${ratingStyle === 'square' ? '0.94' : '0.70'}" stroke="${ratingStyle === 'square' ? accentColor : accentColor}" stroke-opacity="${ratingStyle === 'square' ? '1' : '0.58'}" stroke-width="${ratingStyle === 'square' ? '1.5' : '1'}" />`;
  const monogramFill = ratingStyle === 'glass' ? 'white' : accentColor;
  const textShadowFilter =
    ratingStyle === 'plain'
      ? `<defs><filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="2.4" flood-color="#000000" flood-opacity="0.55" /></filter></defs>`
      : '';
  const iconImage =
    !iconDataUri
      ? ''
      : ratingStyle === 'plain'
        ? `<image href="${iconDataUri}" x="${iconImageX}" y="${iconImageY}" width="${renderedIconSize}" height="${renderedIconSize}" preserveAspectRatio="xMidYMid meet" />`
        : `<defs><clipPath id="icon-clip">${iconClipPath}</clipPath></defs><image href="${iconDataUri}" x="${iconImageX}" y="${iconImageY}" width="${renderedIconSize}" height="${renderedIconSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#icon-clip)" />${iconBorder}`;
  const monogramText =
    iconDataUri
      ? ''
      : `<text x="${iconCx}" y="${Math.round(iconCy + iconFontSize * 0.34)}" font-family="Arial, sans-serif" font-size="${iconFontSize}" font-weight="700" text-anchor="middle" fill="${monogramFill}">${escapeXml(monogram)}</text>${iconBorder}`;
  const valueFilter = ratingStyle === 'plain' ? ' filter="url(#text-shadow)"' : '';
  const valueNumericStyle =
    ' style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: \'tnum\' 1, \'lnum\' 1;"';
  const valueTextAnchor = contentLayout === 'stacked' ? ' text-anchor="middle"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${textShadowFilter}
${outerRect}
${iconShape}
${iconImage}
${monogramText}
<text x="${valueX}" y="${valueY}" font-family="${valueFontFamily}" font-size="${fontSize}" font-weight="800" fill="white"${valueFilter}${valueLetterSpacing}${valueTextLength}${valueNumericStyle}${valueTextAnchor}>${escapeXml(value)}</text>
</svg>`;
};

const renderWithSharp = async (
  input: FastRenderInput,
  phases: PhaseDurations
): Promise<RenderedImagePayload> => {
  const sharp = await getSharpFactory();

  return await measurePhase(phases, 'render', async () => {
    const imageWidth = input.imageWidth ?? input.outputWidth;
    const imageHeight = input.imageHeight ?? input.outputHeight;
    const sourcePayload = await getSourceImagePayload(input.imgUrl);
    const sourceBuffer = Buffer.from(sourcePayload.body);
    const overlays: Array<{ input: Buffer; top: number; left: number }> = [];
    const transparentBackground = { r: 0, g: 0, b: 0, alpha: 0 };
    let imageLeft = Math.max(0, Math.floor((input.outputWidth - imageWidth) / 2));
    let imageTop = 0;
    let renderedImageHeight = imageHeight;
    const resizedImageBuffer: Buffer =
      input.imageType === 'logo'
        ? await (async () => {
          const trimmedLogo = await sharp(sourceBuffer)
            .trim({ background: transparentBackground })
            .png({ compressionLevel: 1 })
            .toBuffer({ resolveWithObject: true });
          const trimmedLogoWidth = Math.max(1, trimmedLogo.info.width || imageWidth);
          const trimmedLogoHeight = Math.max(1, trimmedLogo.info.height || imageHeight);
          const logoScale = Math.min(imageWidth / trimmedLogoWidth, imageHeight / trimmedLogoHeight);
          const renderedImageWidth = Math.max(1, Math.round(trimmedLogoWidth * logoScale));
          renderedImageHeight = Math.max(1, Math.round(trimmedLogoHeight * logoScale));
          imageLeft = Math.max(0, Math.floor((input.outputWidth - renderedImageWidth) / 2));
          imageTop = Math.max(0, Math.floor((input.outputHeight - renderedImageHeight) / 2));
          return sharp(trimmedLogo.data)
            .resize(renderedImageWidth, renderedImageHeight)
            .png({ compressionLevel: 1 })
            .toBuffer();
        })()
        : await sharp(sourceBuffer)
          .resize(imageWidth, imageHeight, {
            fit: 'cover',
            position: 'center',
            background: transparentBackground,
          })
          .png({ compressionLevel: 1 })
          .toBuffer();
    overlays.push({ input: resizedImageBuffer, top: imageTop, left: imageLeft });

    const iconByProvider = new Map<BadgeKey, string | null>();
    if (input.badges.length > 0) {
      const iconEntries = await Promise.all(
        input.badges.map(async (badge) => {
          const iconDataUri = await getProviderIconDataUri(
            badge.iconUrl,
            badge.iconCornerRadius || 0
          );
          return [badge.key, iconDataUri] as const;
        })
      );
      for (const [providerKey, iconDataUri] of iconEntries) {
        iconByProvider.set(providerKey, iconDataUri);
      }
    }

    const badgeHeight = estimateBadgeHeight(
      input.badgeFontSize,
      input.badgePaddingX,
      input.badgePaddingY,
      input.badgeIconSize,
      'standard'
    );
    const verticalBadgeHeight = estimateBadgeHeight(
      input.badgeFontSize,
      input.badgePaddingX,
      input.badgePaddingY,
      input.badgeIconSize,
      input.verticalBadgeContent
    );
    const posterReferenceBadgeHeight =
      input.imageType === 'poster' ? input.posterReferenceBadgeHeight ?? badgeHeight : badgeHeight;
    const posterReferenceVerticalBadgeHeight =
      input.imageType === 'poster'
        ? input.posterReferenceVerticalBadgeHeight ?? verticalBadgeHeight
        : verticalBadgeHeight;
    const posterReferenceBadgeGap =
      input.imageType === 'poster' ? input.posterReferenceBadgeGap ?? input.badgeGap : input.badgeGap;
    const compactPosterRowText =
      input.imageType === 'poster' &&
      input.posterRatingsLayout !== 'left' &&
      input.posterRatingsLayout !== 'right' &&
      input.posterRatingsLayout !== 'left-right';
    const posterQualityBadgePlacement =
      input.imageType === 'poster'
        ? resolvePosterQualityBadgePlacement(
          input.posterRatingsLayout,
          input.qualityBadgesSide,
          input.posterQualityBadgesPosition
        )
        : null;
    const posterQualityBadgeSidePlacement =
      posterQualityBadgePlacement === 'left' || posterQualityBadgePlacement === 'right'
        ? posterQualityBadgePlacement
        : null;
    const posterRowRegionWidth = Math.max(0, input.outputWidth - input.posterRowHorizontalInset * 2);
    const alignPosterRowWithQuality =
      input.imageType === 'poster' && input.qualityBadges.length > 0 && posterQualityBadgeSidePlacement !== null;
    const posterRowAlign: 'left' | 'center' | 'right' = alignPosterRowWithQuality
      ? posterQualityBadgeSidePlacement === 'right'
        ? 'right'
        : 'left'
      : 'center';
    const posterTitleSpec =
      input.imageType === 'poster' && input.posterTitleText
        ? buildPosterTitleSvg(input.posterTitleText, posterRowRegionWidth)
        : null;
    const thumbnailFallbackTitleSpec =
      input.imageType === 'thumbnail' &&
        (input.thumbnailFallbackEpisodeCode || input.thumbnailFallbackEpisodeText)
        ? buildThumbnailFallbackTitleSvg(
          input.thumbnailFallbackEpisodeCode || '',
          input.thumbnailFallbackEpisodeText || '',
          Math.min(Math.round(input.outputWidth * 0.62), input.outputWidth - 32)
        )
        : null;
    let posterLogoSpec: { buffer: Buffer; width: number; height: number } | null = null;
    if (input.imageType === 'poster' && input.posterLogoUrl) {
      try {
        const logoPayload = await getSourceImagePayload(input.posterLogoUrl);
        const logoBuffer = Buffer.from(logoPayload.body);
        const logoMeta = await sharp(logoBuffer).metadata();
        if (logoMeta.width && logoMeta.height) {
          const maxLogoWidth = Math.min(posterRowRegionWidth, Math.round(input.outputWidth * 0.78));
          const maxLogoHeight = Math.max(48, Math.round(input.outputHeight * 0.16));
          const scale = Math.min(
            1,
            maxLogoWidth / logoMeta.width,
            maxLogoHeight / logoMeta.height
          );
          const logoWidth = Math.max(1, Math.round(logoMeta.width * scale));
          const logoHeight = Math.max(1, Math.round(logoMeta.height * scale));
          const resizedLogoBuffer = await sharp(logoBuffer)
            .resize(logoWidth, logoHeight, { fit: 'fill' })
            .png()
            .toBuffer();
          posterLogoSpec = { buffer: resizedLogoBuffer, width: logoWidth, height: logoHeight };
        }
      } catch {
        posterLogoSpec = null;
      }
    }
    const composeBadgeRow = (
      rowBadges: RatingBadge[],
      rowY: number,
      options?: {
        maxRowWidth?: number;
        regionLeft?: number;
        regionWidth?: number;
        align?: 'left' | 'center' | 'right';
        splitAcrossHalves?: boolean;
        spreadAcrossThirds?: boolean;
        preserveBadgeSize?: boolean;
        contentLayoutOverride?: 'standard' | 'stacked';
        compactTextOverride?: boolean;
      }
    ) => {
      if (rowBadges.length === 0) return;
      const rowContentLayout = options?.contentLayoutOverride ?? input.verticalBadgeContent;
      const rowCompactText = options?.compactTextOverride ?? compactPosterRowText;
      const rowBadgeHeight = estimateBadgeHeight(
        input.badgeFontSize,
        input.badgePaddingX,
        input.badgePaddingY,
        input.badgeIconSize,
        rowContentLayout
      );
      const rowEntries = rowBadges.map((badge) => {
        const badgeWidth = estimateBadgeWidth(
          badge.value,
          input.badgeFontSize,
          input.badgePaddingX,
          input.badgeIconSize,
          input.badgeGap,
          rowCompactText,
          rowContentLayout
        );
        const minBadgeWidth = getMinimumCompressedBadgeWidth(
          badge.value,
          input.badgeFontSize,
          input.badgePaddingX,
          input.badgeIconSize,
          input.badgeGap,
          rowCompactText,
          rowContentLayout
        );
        return { badge, badgeWidth, minBadgeWidth };
      });
      const regionLeft = Math.max(0, Math.floor(options?.regionLeft ?? 0));
      const regionWidth = Math.max(0, Math.floor(options?.regionWidth ?? input.outputWidth));
      const regionRight = Math.min(input.outputWidth, regionLeft + regionWidth);
      const effectiveMaxWidth =
        typeof options?.maxRowWidth === 'number'
          ? Math.min(options.maxRowWidth, Math.max(0, regionWidth - 24))
          : Math.max(0, regionWidth - 24);
      let rowGap = input.badgeGap;
      const measureCurrentRowWidth = () =>
        rowEntries.reduce((acc, entry) => acc + entry.badgeWidth, 0) +
        Math.max(0, rowEntries.length - 1) * rowGap;
      let rowWidth = measureCurrentRowWidth();
      if (!options?.preserveBadgeSize && rowWidth > effectiveMaxWidth && rowEntries.length > 1 && rowGap > 0) {
        const shrinkPerGap = Math.min(
          rowGap,
          Math.max(1, Math.ceil((rowWidth - effectiveMaxWidth) / (rowEntries.length - 1)))
        );
        rowGap = Math.max(0, rowGap - shrinkPerGap);
        rowWidth = measureCurrentRowWidth();
      }
      if (!options?.preserveBadgeSize && rowWidth > effectiveMaxWidth) {
        let overflow = rowWidth - effectiveMaxWidth;
        let guard = 0;
        while (overflow > 0 && guard < rowEntries.length * 8) {
          let changed = false;
          for (const entry of rowEntries) {
            if (overflow <= 0) break;
            const shrinkable = Math.max(0, entry.badgeWidth - entry.minBadgeWidth);
            if (shrinkable <= 0) continue;
            const shrink = Math.min(shrinkable, Math.max(1, Math.ceil(overflow / rowEntries.length)));
            entry.badgeWidth -= shrink;
            overflow -= shrink;
            changed = true;
          }
          if (!changed) break;
          rowWidth = measureCurrentRowWidth();
          overflow = Math.max(0, rowWidth - effectiveMaxWidth);
          guard += 1;
        }
        rowWidth = measureCurrentRowWidth();
      }
      const isPosterRowLayout =
        input.imageType === 'poster' &&
        (input.posterRatingsLayout === 'top' ||
          input.posterRatingsLayout === 'bottom' ||
          input.posterRatingsLayout === 'top-bottom');
      const shouldCenterSingle = isPosterRowLayout && rowEntries.length === 1;
      const shouldSplitRow =
        (isPosterRowLayout || options?.splitAcrossHalves === true) && rowEntries.length === 2;
      const shouldSpreadRow =
        (isPosterRowLayout || options?.spreadAcrossThirds === true) && rowEntries.length === 3;
      if (shouldCenterSingle) {
        const centerX =
          regionLeft + Math.floor(regionWidth / 2) - Math.floor(rowEntries[0].badgeWidth / 2);
        const clampedX = Math.max(
          regionLeft,
          Math.min(centerX, Math.max(regionLeft, regionRight - rowEntries[0].badgeWidth))
        );
        const entry = rowEntries[0];
        const monogram = buildProviderMonogram(
          entry.badge.label || String(entry.badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: entry.badgeWidth,
          height: rowBadgeHeight,
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          gap: input.badgeGap,
          accentColor: entry.badge.accentColor,
          monogram,
          iconDataUri: iconByProvider.get(entry.badge.key) || null,
          iconCornerRadius: entry.badge.iconCornerRadius,
          iconScale: entry.badge.iconScale,
          value: entry.badge.value,
          ratingStyle: input.ratingStyle,
          compactText: rowCompactText,
          contentLayout: rowContentLayout,
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: clampedX });
        return;
      }
      if (shouldSplitRow) {
        const edgeInset = 12;
        const leftHalfWidth = Math.floor(regionWidth / 2);
        const rightHalfWidth = Math.max(0, regionWidth - leftHalfWidth);
        const leftMin = regionLeft + edgeInset;
        const leftMax = regionLeft + leftHalfWidth - edgeInset - rowEntries[0].badgeWidth;
        const rightMin = regionLeft + leftHalfWidth + edgeInset;
        const rightMax = regionRight - edgeInset - rowEntries[1].badgeWidth;
        if (leftMin <= leftMax && rightMin <= rightMax) {
          const leftCenterX =
            regionLeft + Math.floor(leftHalfWidth / 2) - Math.floor(rowEntries[0].badgeWidth / 2);
          const rightCenterX =
            regionLeft +
            leftHalfWidth +
            Math.floor(rightHalfWidth / 2) -
            Math.floor(rowEntries[1].badgeWidth / 2);
          const leftX = Math.max(leftMin, Math.min(leftCenterX, leftMax));
          const rightX = Math.max(rightMin, Math.min(rightCenterX, rightMax));
          const overlaps = leftX + rowEntries[0].badgeWidth + rowGap > rightX;
          if (!overlaps) {
            const positions = [leftX, rightX];
            for (let index = 0; index < rowEntries.length; index += 1) {
              const entry = rowEntries[index];
              const monogram = buildProviderMonogram(
                entry.badge.label || String(entry.badge.key).toUpperCase()
              );
              const badgeSvg = buildBadgeSvg({
                width: entry.badgeWidth,
                height: rowBadgeHeight,
                iconSize: input.badgeIconSize,
                fontSize: input.badgeFontSize,
                paddingX: input.badgePaddingX,
                gap: input.badgeGap,
                accentColor: entry.badge.accentColor,
                monogram,
                iconDataUri: iconByProvider.get(entry.badge.key) || null,
                iconCornerRadius: entry.badge.iconCornerRadius,
                iconScale: entry.badge.iconScale,
                value: entry.badge.value,
                ratingStyle: input.ratingStyle,
                compactText: rowCompactText,
                contentLayout: rowContentLayout,
              });
              overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: positions[index] });
            }
            return;
          }
        }
      }
      if (shouldSpreadRow) {
        const edgeInset = 12;
        const leftX = regionLeft + edgeInset;
        const centerX = regionLeft + Math.floor(regionWidth / 2) - Math.floor(rowEntries[1].badgeWidth / 2);
        const rightX = Math.max(regionLeft, regionRight - rowEntries[2].badgeWidth - edgeInset);
        const overlaps =
          leftX + rowEntries[0].badgeWidth + rowGap > centerX ||
          centerX + rowEntries[1].badgeWidth + rowGap > rightX;
        if (!overlaps) {
          const positions = [leftX, centerX, rightX];
          for (let index = 0; index < rowEntries.length; index += 1) {
            const entry = rowEntries[index];
            const monogram = buildProviderMonogram(
              entry.badge.label || String(entry.badge.key).toUpperCase()
            );
            const badgeSvg = buildBadgeSvg({
              width: entry.badgeWidth,
              height: rowBadgeHeight,
              iconSize: input.badgeIconSize,
              fontSize: input.badgeFontSize,
              paddingX: input.badgePaddingX,
              gap: input.badgeGap,
              accentColor: entry.badge.accentColor,
              monogram,
              iconDataUri: iconByProvider.get(entry.badge.key) || null,
              iconCornerRadius: entry.badge.iconCornerRadius,
              iconScale: entry.badge.iconScale,
              value: entry.badge.value,
              ratingStyle: input.ratingStyle,
              compactText: rowCompactText,
              contentLayout: rowContentLayout,
            });
            overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: positions[index] });
          }
          return;
        }
      }
      const align = options?.align || 'center';
      const preferredEdgeInset = 12;
      const dynamicEdgeInset =
        rowWidth > effectiveMaxWidth
          ? Math.max(0, Math.min(preferredEdgeInset, Math.floor((regionWidth - rowWidth) / 2)))
          : preferredEdgeInset;
      const minRowX = regionLeft + dynamicEdgeInset;
      const maxRowX = Math.max(regionLeft, regionRight - rowWidth - dynamicEdgeInset);
      let rowX =
        align === 'left'
          ? minRowX
          : align === 'right'
            ? maxRowX
            : regionLeft + Math.floor((regionWidth - rowWidth) / 2);
      if (rowWidth > effectiveMaxWidth) {
        rowX =
          align === 'right'
            ? Math.max(regionLeft, regionRight - rowWidth)
            : align === 'left'
              ? regionLeft
              : regionLeft + Math.floor((regionWidth - rowWidth) / 2);
      }
      rowX = Math.max(regionLeft, Math.min(rowX, Math.max(regionLeft, regionRight - rowWidth)));

      for (const entry of rowEntries) {
        const monogram = buildProviderMonogram(
          entry.badge.label || String(entry.badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: entry.badgeWidth,
          height: rowBadgeHeight,
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          gap: input.badgeGap,
          accentColor: entry.badge.accentColor,
          monogram,
          iconDataUri: iconByProvider.get(entry.badge.key) || null,
          iconCornerRadius: entry.badge.iconCornerRadius,
          iconScale: entry.badge.iconScale,
          value: entry.badge.value,
          ratingStyle: input.ratingStyle,
          compactText: rowCompactText,
          contentLayout: rowContentLayout,
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: rowX });
        rowX += entry.badgeWidth + rowGap;
      }
    };
    const composePosterCleanOverlayAboveBottom = (bottomRowY: number) => {
      if (input.imageType !== 'poster') return;
      const overlay = posterLogoSpec
        ? {
          buffer: posterLogoSpec.buffer,
          width: posterLogoSpec.width,
          height: posterLogoSpec.height,
        }
        : posterTitleSpec
          ? {
            buffer: Buffer.from(posterTitleSpec.svg),
            width: posterTitleSpec.width,
            height: posterTitleSpec.height,
          }
          : null;
      if (!overlay) return;
      const overlayGap = Math.max(8, Math.round(posterReferenceBadgeGap * 0.9));
      const stableBottomAnchorY = Math.max(
        input.badgeTopOffset,
        input.outputHeight - input.badgeBottomOffset - posterReferenceBadgeHeight
      );
      const overlayAnchorY = input.bottomBadges.length > 0 ? bottomRowY : stableBottomAnchorY;
      let overlayY = Math.round(overlayAnchorY - overlayGap - overlay.height);
      const topRowBottom =
        input.topBadges.length > 0
          ? input.badgeTopOffset + Math.max(badgeHeight, posterReferenceBadgeHeight) + posterReferenceBadgeGap
          : input.badgeTopOffset;
      if (overlayY < topRowBottom) {
        overlayY = topRowBottom;
      }
      if (overlayY + overlay.height + overlayGap > overlayAnchorY) {
        return;
      }
      const overlayX = Math.max(
        input.posterRowHorizontalInset,
        Math.round((input.outputWidth - overlay.width) / 2)
      );
      overlays.push({ input: overlay.buffer, top: overlayY, left: overlayX });
    };
    const composeThumbnailFallbackOverlay = () => {
      if (input.imageType !== 'thumbnail' || !thumbnailFallbackTitleSpec) return;
      const bottomInset = Math.max(16, input.badgeBottomOffset);
      const leftInset = 16;
      const overlayX = Math.max(
        leftInset,
        Math.min(leftInset, Math.max(leftInset, input.outputWidth - thumbnailFallbackTitleSpec.width - leftInset))
      );
      const overlayY = Math.max(
        16,
        input.outputHeight - thumbnailFallbackTitleSpec.height - bottomInset
      );
      overlays.push({
        input: Buffer.from(thumbnailFallbackTitleSpec.svg),
        top: overlayY,
        left: overlayX,
      });
    };
    const composePosterBadgeAt = (
      badge: RatingBadge,
      left: number,
      top: number,
      maxBadgeWidth: number,
      contentLayout: 'standard' | 'stacked' = input.verticalBadgeContent
    ) => {
      const badgeHeightForLayout = estimateBadgeHeight(
        input.badgeFontSize,
        input.badgePaddingX,
        input.badgePaddingY,
        input.badgeIconSize,
        contentLayout
      );
      const estimatedWidth = estimateBadgeWidth(
        badge.value,
        input.badgeFontSize,
        input.badgePaddingX,
        input.badgeIconSize,
        input.badgeGap,
        false,
        contentLayout
      );
      const badgeWidth = Math.min(estimatedWidth, maxBadgeWidth);
      const monogram = buildProviderMonogram(
        badge.label || String(badge.key).toUpperCase()
      );
      const badgeSvg = buildBadgeSvg({
        width: badgeWidth,
        height: badgeHeightForLayout,
        iconSize: input.badgeIconSize,
        fontSize: input.badgeFontSize,
        paddingX: input.badgePaddingX,
        gap: input.badgeGap,
        accentColor: badge.accentColor,
        monogram,
        iconDataUri: iconByProvider.get(badge.key) || null,
        iconCornerRadius: badge.iconCornerRadius,
        iconScale: badge.iconScale,
        value: badge.value,
        ratingStyle: input.ratingStyle,
        contentLayout,
      });
      overlays.push({ input: Buffer.from(badgeSvg), top, left });
      return { width: badgeWidth, height: badgeHeightForLayout };
    };
    const composePosterCenteredTopBadge = (
      badge: RatingBadge,
      sizeMode: 'default' | 'top' = 'default'
    ) => {
      if (sizeMode === 'top') {
        const topIconSize = 46;
        const topFontSize = 35;
        const topPaddingX = 13;
        const topPaddingY = 8;
        const topGap = 9;
        const topBadgeHeight = estimateBadgeHeight(
          topFontSize,
          topPaddingX,
          topPaddingY,
          topIconSize,
          'standard'
        );
        const estimatedWidth = estimateBadgeWidth(
          badge.value,
          topFontSize,
          topPaddingX,
          topIconSize,
          topGap,
          true,
          'standard'
        );
        const badgeWidth = Math.min(estimatedWidth, Math.max(0, posterRowRegionWidth - 24));
        const rowX = Math.max(
          input.posterRowHorizontalInset,
          input.posterRowHorizontalInset + Math.floor((posterRowRegionWidth - badgeWidth) / 2)
        );
        const monogram = buildProviderMonogram(
          badge.label || String(badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: badgeWidth,
          height: topBadgeHeight,
          iconSize: topIconSize,
          fontSize: topFontSize,
          paddingX: topPaddingX,
          gap: topGap,
          accentColor: badge.accentColor,
          monogram,
          iconDataUri: iconByProvider.get(badge.key) || null,
          iconCornerRadius: badge.iconCornerRadius,
          iconScale: badge.iconScale,
          value: badge.value,
          ratingStyle: input.ratingStyle,
          compactText: true,
          contentLayout: 'standard',
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: input.badgeTopOffset, left: rowX });
        return;
      }

      composeBadgeRow([badge], input.badgeTopOffset, {
        regionLeft: input.posterRowHorizontalInset,
        regionWidth: posterRowRegionWidth,
        align: 'center',
        preserveBadgeSize: true,
        contentLayoutOverride: 'standard',
        compactTextOverride: true,
      });
    };
    const composeEdgeAlignedPosterBadge = (
      badge: RatingBadge,
      rowY: number,
      side: 'left' | 'right',
      maxBadgeWidth: number
    ) => {
      const estimatedWidth = estimateBadgeWidth(
        badge.value,
        input.badgeFontSize,
        input.badgePaddingX,
        input.badgeIconSize,
        input.badgeGap,
        false,
        input.verticalBadgeContent
      );
      const badgeWidth = Math.min(estimatedWidth, maxBadgeWidth);
      const rowX =
        side === 'left'
          ? 12
          : Math.max(12, input.outputWidth - badgeWidth - 12);
      composePosterBadgeAt(badge, rowX, rowY, maxBadgeWidth, input.verticalBadgeContent);
    };
    const composeBadgeColumn = (
      columnBadges: RatingBadge[],
      side: 'left' | 'right',
      maxBadgeWidth: number,
      origin: 'top' | 'bottom' = 'top',
      startY?: number
    ) => {
      if (columnBadges.length === 0) return;
      let rowY =
        typeof startY === 'number'
          ? Math.max(input.badgeTopOffset, startY)
          : origin === 'bottom'
            ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - verticalBadgeHeight)
            : input.badgeTopOffset;
      for (let index = 0; index < columnBadges.length; index += 1) {
        const badge = columnBadges[index];
        composeEdgeAlignedPosterBadge(badge, rowY, side, maxBadgeWidth);
        rowY += origin === 'bottom' ? -(verticalBadgeHeight + input.badgeGap) : verticalBadgeHeight + input.badgeGap;
      }
    };
    const composeBackdropBadgeColumn = (
      columnBadges: RatingBadge[],
      placement: BackdropBadgePlacement,
      maxBadgeWidth: number,
      startY?: number
    ) => {
      if (columnBadges.length === 0) return;
      const columnHeight =
        columnBadges.length * verticalBadgeHeight + Math.max(0, columnBadges.length - 1) * input.badgeGap;
      let rowY =
        typeof startY === 'number'
          ? Math.max(input.badgeTopOffset, startY)
          : placement.vertical === 'bottom'
            ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - columnHeight)
            : placement.vertical === 'center'
              ? Math.max(
                input.badgeTopOffset,
                Math.round((input.outputHeight - columnHeight) / 2)
              )
              : input.badgeTopOffset;
      const regionLeft = placement.left;
      const regionRight = placement.left + placement.width;
      for (const badge of columnBadges) {
        const estimatedWidth = estimateBadgeWidth(
          badge.value,
          input.badgeFontSize,
          input.badgePaddingX,
          input.badgeIconSize,
          input.badgeGap,
          false,
          input.verticalBadgeContent
        );
        const badgeWidth = Math.min(estimatedWidth, maxBadgeWidth);
        const rowX =
          placement.align === 'left'
            ? regionLeft
            : placement.align === 'right'
              ? Math.max(regionLeft, regionRight - badgeWidth)
              : Math.max(regionLeft, Math.round(regionLeft + (placement.width - badgeWidth) / 2));
        const monogram = buildProviderMonogram(
          badge.label || String(badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: badgeWidth,
          height: verticalBadgeHeight,
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          gap: input.badgeGap,
          accentColor: badge.accentColor,
          monogram,
          iconDataUri: iconByProvider.get(badge.key) || null,
          iconCornerRadius: badge.iconCornerRadius,
          iconScale: badge.iconScale,
          value: badge.value,
          ratingStyle: input.ratingStyle,
          contentLayout: input.verticalBadgeContent,
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: rowX });
        rowY += verticalBadgeHeight + input.badgeGap;
      }
    };
    const composeBackdropBadgeColumns = (
      columns: RatingBadge[][],
      placement: BackdropBadgePlacement
    ) => {
      const usableColumns = columns.filter((column) => column.length > 0);
      if (usableColumns.length === 0) return false;
      const estimatedColumns = usableColumns.map((columnBadges) => {
        const widths = columnBadges.map((badge) =>
          estimateBadgeWidth(
            badge.value,
            input.badgeFontSize,
            input.badgePaddingX,
            input.badgeIconSize,
            input.badgeGap,
            false,
            input.verticalBadgeContent
          )
        );
        return {
          badges: columnBadges,
          badgeWidths: widths,
          maxWidth: Math.max(0, ...widths),
          height:
            columnBadges.length * verticalBadgeHeight +
            Math.max(0, columnBadges.length - 1) * input.badgeGap,
        };
      });
      const columnGap = Math.max(12, input.badgeGap);
      const totalWidth =
        estimatedColumns.reduce((sum, column) => sum + column.maxWidth, 0) +
        Math.max(0, estimatedColumns.length - 1) * columnGap;
      const regionLeft = placement.left;
      const regionRight = placement.left + placement.width;
      if (totalWidth > placement.width) return false;

      const startX =
        placement.align === 'right'
          ? regionRight - totalWidth
          : placement.align === 'center'
            ? regionLeft + Math.floor((placement.width - totalWidth) / 2)
            : regionLeft;
      if (startX < regionLeft || startX + totalWidth > regionRight) return false;

      const tallestHeight = estimatedColumns.reduce(
        (maxHeight, column) => Math.max(maxHeight, column.height),
        0
      );
      const startY =
        placement.vertical === 'bottom'
          ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - tallestHeight)
          : placement.vertical === 'center'
            ? Math.max(input.badgeTopOffset, Math.round((input.outputHeight - tallestHeight) / 2))
            : input.badgeTopOffset;

      let columnX = startX;
      for (const column of estimatedColumns) {
        let rowY = startY;
        for (let index = 0; index < column.badges.length; index += 1) {
          const badge = column.badges[index];
          const badgeWidth = column.badgeWidths[index];
          const rowX = columnX + Math.floor((column.maxWidth - badgeWidth) / 2);
          const monogram = buildProviderMonogram(
            badge.label || String(badge.key).toUpperCase()
          );
          const badgeSvg = buildBadgeSvg({
            width: badgeWidth,
            height: verticalBadgeHeight,
            iconSize: input.badgeIconSize,
            fontSize: input.badgeFontSize,
            paddingX: input.badgePaddingX,
            gap: input.badgeGap,
            accentColor: badge.accentColor,
            monogram,
            iconDataUri: iconByProvider.get(badge.key) || null,
            iconCornerRadius: badge.iconCornerRadius,
            iconScale: badge.iconScale,
            value: badge.value,
            ratingStyle: input.ratingStyle,
            contentLayout: input.verticalBadgeContent,
          });
          overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: rowX });
          rowY += verticalBadgeHeight + input.badgeGap;
        }
        columnX += column.maxWidth + columnGap;
      }

      return true;
    };
    const composeQualityBadgeColumn = (
      columnBadges: RatingBadge[],
      startY: number,
      side: QualityBadgesSide
    ) => {
      if (columnBadges.length === 0) return;
      const qualityBaseHeight =
        input.imageType === 'poster' ? posterReferenceBadgeHeight : badgeHeight;
      const qualityGap = input.imageType === 'poster' ? posterReferenceBadgeGap : input.badgeGap;
      const qualityHeight = Math.max(44, Math.round(qualityBaseHeight * 1.25));
      const uniformBadgeWidth = Math.min(
        Math.max(72, Math.round(qualityHeight * 1.75)),
        Math.max(72, input.outputWidth - 24)
      );
      let rowY = Math.max(input.badgeTopOffset, startY);
      for (let index = 0; index < columnBadges.length; index += 1) {
        const badge = columnBadges[index];
        if (!STREAM_BADGE_META.has(badge.key as StreamBadgeKey)) continue;
        const spec = buildQualityBadgeSvg(
          badge.key as StreamBadgeKey,
          qualityHeight,
          uniformBadgeWidth,
          input.qualityBadgesStyle
        );
        if (!spec) continue;
        const badgeWidth = Math.min(spec.width, uniformBadgeWidth);
        const badgeHeightForRow = spec.height;
        const rowX =
          side === 'right'
            ? Math.max(12, input.outputWidth - badgeWidth - 12)
            : 12;
        overlays.push({ input: Buffer.from(spec.svg), top: rowY, left: rowX });
        rowY += badgeHeightForRow + qualityGap;
      }
    };
    const composeQualityBadgeRow = (
      rowBadges: RatingBadge[],
      rowY: number,
      baseHeight?: number
    ) => {
      if (rowBadges.length === 0) return;
      const maxRowWidth = Math.max(0, input.outputWidth - 24);
      const qualityBaseHeight =
        input.imageType === 'poster' ? posterReferenceBadgeHeight : badgeHeight;
      const qualityBaseGap = input.imageType === 'poster' ? posterReferenceBadgeGap : input.badgeGap;
      let qualityHeight = Math.max(36, Math.round(baseHeight ?? qualityBaseHeight * 1.05));
      let badgeWidth = Math.min(
        Math.max(64, Math.round(qualityHeight * 1.75)),
        Math.max(64, input.outputWidth - 24)
      );
      let rowGap = qualityBaseGap;
      let rowWidth = rowBadges.length * badgeWidth + Math.max(0, rowBadges.length - 1) * rowGap;
      if (rowWidth > maxRowWidth && rowBadges.length > 1) {
        const ratio = Math.max(0.45, maxRowWidth / rowWidth);
        const heightRatio = Math.max(0.75, Math.min(1, ratio));
        qualityHeight = Math.max(32, Math.floor(qualityHeight * heightRatio));
        badgeWidth = Math.min(
          Math.max(60, Math.floor(badgeWidth * ratio)),
          Math.max(60, input.outputWidth - 24)
        );
        rowWidth = rowBadges.length * badgeWidth + Math.max(0, rowBadges.length - 1) * rowGap;
        if (rowWidth > maxRowWidth) {
          const availableForGaps = Math.max(0, maxRowWidth - rowBadges.length * badgeWidth);
          rowGap = Math.max(0, Math.floor(availableForGaps / (rowBadges.length - 1)));
          rowWidth = rowBadges.length * badgeWidth + Math.max(0, rowBadges.length - 1) * rowGap;
        }
      }
      let rowX = Math.floor((input.outputWidth - rowWidth) / 2);
      rowX = Math.max(12, Math.min(rowX, Math.max(12, input.outputWidth - rowWidth - 12)));
      for (const badge of rowBadges) {
        if (!STREAM_BADGE_META.has(badge.key as StreamBadgeKey)) continue;
        const spec = buildQualityBadgeSvg(
          badge.key as StreamBadgeKey,
          qualityHeight,
          badgeWidth,
          input.qualityBadgesStyle
        );
        if (!spec) continue;
        overlays.push({ input: Buffer.from(spec.svg), top: rowY, left: rowX });
        rowX += badgeWidth + rowGap;
      }
    };
    const renderQualityBadgeColumnAt = (
      columnBadges: RatingBadge[],
      startY: number,
      x: number,
      qualityHeight: number,
      uniformBadgeWidth: number
    ) => {
      if (columnBadges.length === 0) return;
      let rowY = Math.max(input.badgeTopOffset, startY);
      const clampedX = Math.max(
        12,
        Math.min(Math.round(x), Math.max(12, input.outputWidth - uniformBadgeWidth - 12))
      );
      for (let index = 0; index < columnBadges.length; index += 1) {
        const badge = columnBadges[index];
        if (!STREAM_BADGE_META.has(badge.key as StreamBadgeKey)) continue;
        const spec = buildQualityBadgeSvg(
          badge.key as StreamBadgeKey,
          qualityHeight,
          uniformBadgeWidth,
          input.qualityBadgesStyle
        );
        if (!spec) continue;
        overlays.push({ input: Buffer.from(spec.svg), top: rowY, left: clampedX });
        rowY += spec.height + input.badgeGap;
      }
    };

    if (input.imageType === 'logo') {
      if (input.badges.length > 0 && input.logoBadgeBandHeight > 0 && input.logoBadgesPerRow > 0) {
        const rows = chunkBy(input.badges, input.logoBadgesPerRow);
        let rowY = imageTop + renderedImageHeight + input.logoBadgeTopGap;
        for (const row of rows) {
          composeBadgeRow(row, rowY, {
            maxRowWidth: input.logoBadgeMaxWidth,
            preserveBadgeSize: true,
          });
          rowY += badgeHeight + input.badgeGap;
        }
      }
    } else if (
      input.badges.length > 0 ||
      (input.imageType === 'poster' && (posterTitleSpec || posterLogoSpec))
    ) {
      if (input.imageType === 'backdrop' || input.imageType === 'thumbnail') {
        const backdropPlacement = getBackdropBadgePlacement(
          input.outputWidth,
          input.backdropRatingsLayout,
          input.imageType
        );
        if (backdropPlacement.stack === 'column') {
          const maxBadgeWidth = Math.max(180, Math.floor(backdropPlacement.width - 24));
          const backdropColumns =
            input.backdropColumns && input.backdropColumns.length > 0
              ? input.backdropColumns.filter((column) => column.length > 0)
              : [];
          const hasMultipleColumns = backdropColumns.length > 1;
          if (
            hasMultipleColumns &&
            !composeBackdropBadgeColumns(backdropColumns, backdropPlacement)
          ) {
            const fallbackColumnBadges =
              backdropColumns[0]?.length
                ? backdropColumns[0]
                : input.rightBadges.length > 0
                  ? input.rightBadges
                  : input.leftBadges.length > 0
                    ? input.leftBadges
                    : input.badges;
            composeBackdropBadgeColumn(fallbackColumnBadges, backdropPlacement, maxBadgeWidth);
          } else if (!hasMultipleColumns) {
            const columnBadges =
              backdropColumns[0]?.length
                ? backdropColumns[0]
                : input.rightBadges.length > 0
                  ? input.rightBadges
                  : input.leftBadges.length > 0
                    ? input.leftBadges
                    : input.badges;
            composeBackdropBadgeColumn(columnBadges, backdropPlacement, maxBadgeWidth);
          }
        } else {
          const backdropRows =
            input.backdropRows && input.backdropRows.length > 0
              ? input.backdropRows
              : [input.topBadges, input.bottomBadges].filter((row) => row.length > 0);
          const totalRowsHeight =
            backdropRows.length * badgeHeight + Math.max(0, backdropRows.length - 1) * input.badgeGap;
          let rowY =
            backdropPlacement.vertical === 'top'
              ? input.badgeTopOffset
              : backdropPlacement.vertical === 'bottom'
                ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - totalRowsHeight)
                : Math.max(input.badgeTopOffset, Math.round((input.outputHeight - totalRowsHeight) / 2));
          for (const row of backdropRows) {
            composeBadgeRow(row, rowY, {
              regionLeft: backdropPlacement.left,
              regionWidth: backdropPlacement.width,
              align: backdropPlacement.align,
            });
            rowY += badgeHeight + input.badgeGap;
          }
        }
        composeThumbnailFallbackOverlay();
      } else if (input.imageType === 'poster') {
        const bottomRowY = Math.max(
          input.badgeTopOffset,
          input.outputHeight - input.badgeBottomOffset - badgeHeight
        );
        if (input.posterRatingsLayout === 'left' || input.posterRatingsLayout === 'right') {
          const maxBadgeWidth = Math.max(180, Math.floor(input.outputWidth * 0.46));
          composeBadgeColumn(
            input.posterRatingsLayout === 'left' ? input.leftBadges : input.rightBadges,
            input.posterRatingsLayout,
            maxBadgeWidth
          );
        } else if (input.posterRatingsLayout === 'left-right') {
          const maxBadgeWidth = Math.max(160, Math.floor((input.outputWidth - 36) / 2));
          const hasThreeBadgeTopRow =
            input.topBadges.length === 1 &&
            input.leftBadges.length > 0 &&
            input.rightBadges.length > 0;
          const remainingLeftBadges = hasThreeBadgeTopRow ? input.leftBadges.slice(1) : input.leftBadges;
          const remainingRightBadges = hasThreeBadgeTopRow ? input.rightBadges.slice(1) : input.rightBadges;

          if (hasThreeBadgeTopRow) {
            if (input.verticalBadgeContent === 'stacked') {
              const edgeInset = 12;
              const leftBadge = input.leftBadges[0];
              const centerBadge = input.topBadges[0];
              const rightBadge = input.rightBadges[0];
              const leftEstimate = Math.min(
                estimateBadgeWidth(
                  leftBadge.value,
                  input.badgeFontSize,
                  input.badgePaddingX,
                  input.badgeIconSize,
                  input.badgeGap,
                  false,
                  'stacked'
                ),
                maxBadgeWidth
              );
              const rightEstimate = Math.min(
                estimateBadgeWidth(
                  rightBadge.value,
                  input.badgeFontSize,
                  input.badgePaddingX,
                  input.badgeIconSize,
                  input.badgeGap,
                  false,
                  'stacked'
                ),
                maxBadgeWidth
              );
              const leftX = edgeInset;
              const topCenterIconSize = 46;
              const topCenterFontSize = 35;
              const topCenterPaddingX = 13;
              const topCenterGap = 9;
              const centerMaxWidth = Math.max(0, posterRowRegionWidth - 24);
              const centeredHorizontalWidth = Math.min(
                estimateBadgeWidth(
                  centerBadge.value,
                  topCenterFontSize,
                  topCenterPaddingX,
                  topCenterIconSize,
                  topCenterGap,
                  true,
                  'standard'
                ),
                centerMaxWidth
              );
              const centerIdealX =
                input.posterRowHorizontalInset +
                Math.floor((posterRowRegionWidth - centeredHorizontalWidth) / 2);
              const centerX = Math.max(
                input.posterRowHorizontalInset,
                Math.min(
                  centerIdealX,
                  input.posterRowHorizontalInset + posterRowRegionWidth - centeredHorizontalWidth
                )
              );
              const rightX = Math.max(edgeInset, input.outputWidth - rightEstimate - edgeInset);
              const overlaps =
                leftX + leftEstimate + input.badgeGap > centerX ||
                centerX + centeredHorizontalWidth + input.badgeGap > rightX;
              if (!overlaps) {
                composePosterBadgeAt(leftBadge, leftX, input.badgeTopOffset, maxBadgeWidth, 'stacked');
                composePosterCenteredTopBadge(centerBadge, 'top');
                composePosterBadgeAt(rightBadge, rightX, input.badgeTopOffset, maxBadgeWidth, 'stacked');
              } else {
                composeBadgeRow(
                  [leftBadge, centerBadge, rightBadge],
                  input.badgeTopOffset,
                  {
                    regionLeft: 0,
                    regionWidth: input.outputWidth,
                    spreadAcrossThirds: true,
                    preserveBadgeSize: true,
                  }
                );
              }
            } else {
              composeBadgeRow(
                [input.leftBadges[0], input.topBadges[0], input.rightBadges[0]],
                input.badgeTopOffset,
                {
                  regionLeft: 0,
                  regionWidth: input.outputWidth,
                  spreadAcrossThirds: true,
                  preserveBadgeSize: true,
                }
              );
            }
          } else if (input.topBadges.length > 0) {
            for (const badge of input.topBadges) {
              composePosterCenteredTopBadge(badge);
            }
          }

          const sideStartY =
            input.topBadges.length > 0
              ? input.badgeTopOffset + verticalBadgeHeight + input.badgeGap
              : input.badgeTopOffset;
          if (remainingLeftBadges.length === remainingRightBadges.length) {
            for (let index = 0; index < remainingLeftBadges.length; index += 1) {
              const rowY = sideStartY + index * (verticalBadgeHeight + input.badgeGap);
              composeEdgeAlignedPosterBadge(remainingLeftBadges[index], rowY, 'left', maxBadgeWidth);
              composeEdgeAlignedPosterBadge(remainingRightBadges[index], rowY, 'right', maxBadgeWidth);
            }
          } else {
            composeBadgeColumn(remainingLeftBadges, 'left', maxBadgeWidth, 'top', sideStartY);
            composeBadgeColumn(remainingRightBadges, 'right', maxBadgeWidth, 'top', sideStartY);
          }
        } else {
          if (input.topBadges.length > 0) {
            composeBadgeRow(input.topBadges, input.badgeTopOffset, {
              regionLeft: input.posterRowHorizontalInset,
              regionWidth: posterRowRegionWidth,
              align: posterRowAlign,
            });
          }
          if (input.bottomBadges.length > 0) {
            composeBadgeRow(input.bottomBadges, bottomRowY, {
              regionLeft: input.posterRowHorizontalInset,
              regionWidth: posterRowRegionWidth,
              align: posterRowAlign,
            });
          }
        }
        composePosterCleanOverlayAboveBottom(bottomRowY);
      }
    }

    if (input.imageType === 'poster' && input.qualityBadges.length > 0) {
      const qualityPlacement = resolvePosterQualityBadgePlacement(
        input.posterRatingsLayout,
        input.qualityBadgesSide,
        input.posterQualityBadgesPosition
      );
      const metrics: BadgeLayoutMetrics = {
        iconSize: input.badgeIconSize,
        fontSize: input.badgeFontSize,
        paddingX: input.badgePaddingX,
        paddingY: input.badgePaddingY,
        gap: input.badgeGap,
      };
      const qualityBadgeHeight = Math.max(44, Math.round(badgeHeight * 1.25));
      if (qualityPlacement === 'bottom') {
        const bottomQualityHeight = Math.max(36, Math.round(badgeHeight * 1.05));
        const bottomY = Math.max(
          input.badgeTopOffset,
          input.outputHeight - input.badgeBottomOffset - bottomQualityHeight
        );
        composeQualityBadgeRow(input.qualityBadges, bottomY, bottomQualityHeight);
      } else if (qualityPlacement === 'top') {
        const topQualityHeight = Math.max(36, Math.round(badgeHeight * 1.05));
        const topY = input.badgeTopOffset;
        composeQualityBadgeRow(input.qualityBadges, topY, topQualityHeight);
      } else {
        const qualityTotalHeight =
          input.qualityBadges.length * qualityBadgeHeight +
          Math.max(0, input.qualityBadges.length - 1) * input.badgeGap;
        const centeredStartY = Math.max(
          input.badgeTopOffset,
          Math.round((input.outputHeight - qualityTotalHeight) / 2)
        );
        let qualityStartY = centeredStartY;
        const shouldTopAlignQuality =
          (input.posterRatingsLayout === 'left' || input.posterRatingsLayout === 'right') &&
          (qualityPlacement === 'left' || qualityPlacement === 'right');
        if (shouldTopAlignQuality) {
          qualityStartY = input.badgeTopOffset;
        } else if (input.topBadges.length > 0) {
          const belowTop =
            input.badgeTopOffset +
            Math.max(verticalBadgeHeight, posterReferenceVerticalBadgeHeight) +
            Math.max(input.badgeGap, posterReferenceBadgeGap);
          qualityStartY = Math.max(qualityStartY, belowTop);
        } else {
          const sideBadges = qualityPlacement === 'right' ? input.rightBadges : input.leftBadges;
          if (sideBadges.length > 0) {
            const sideColumnHeight = measureBadgeColumnHeight(sideBadges, metrics, input.verticalBadgeContent);
            if (sideColumnHeight > 0) {
              const belowSide = input.badgeTopOffset + sideColumnHeight + input.badgeGap;
              qualityStartY = Math.max(qualityStartY, belowSide);
            }
          }
        }
        composeQualityBadgeColumn(input.qualityBadges, qualityStartY, qualityPlacement);
      }
    }

    if (input.imageType === 'backdrop' && input.qualityBadges.length > 0) {
      const qualityHeight = Math.max(44, Math.round(badgeHeight * 1.25));
      const uniformBadgeWidth = Math.min(
        Math.max(72, Math.round(qualityHeight * 1.75)),
        Math.max(72, input.outputWidth - 24)
      );
      const usableQualityBadges = input.qualityBadges.filter((badge) =>
        STREAM_BADGE_META.has(badge.key as StreamBadgeKey)
      );
      if (usableQualityBadges.length > 0) {
        const leftColumn: RatingBadge[] = [];
        const rightColumn: RatingBadge[] = [];
        if (input.backdropRatingsLayout === 'center' && usableQualityBadges.length === 2) {
          leftColumn.push(usableQualityBadges[0]);
          rightColumn.push(usableQualityBadges[1]);
        } else {
          for (const badge of usableQualityBadges) {
            if (leftColumn.length < 2) {
              leftColumn.push(badge);
            } else if (rightColumn.length < 2) {
              rightColumn.push(badge);
            } else if (leftColumn.length <= rightColumn.length) {
              leftColumn.push(badge);
            } else {
              rightColumn.push(badge);
            }
          }
        }
        const startY = input.badgeTopOffset;
        const columnGap = Math.max(8, Math.round(input.badgeGap * 0.8));
        const metrics: BadgeLayoutMetrics = {
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          paddingY: input.badgePaddingY,
          gap: input.badgeGap,
        };
        const backdropPlacement = getBackdropBadgePlacement(
          input.outputWidth,
          input.backdropRatingsLayout,
          input.imageType
        );
        const effectiveMaxWidth = Math.max(0, backdropPlacement.width - 24);
        const backdropRows =
          input.backdropRows && input.backdropRows.length > 0
            ? input.backdropRows
            : [input.topBadges, input.bottomBadges].filter((row) => row.length > 0);
        const verticalBackdropColumns =
          backdropPlacement.stack === 'column'
            ? (input.backdropColumns && input.backdropColumns.length > 0
              ? input.backdropColumns
              : [input.leftBadges, input.rightBadges].filter((column) => column.length > 0))
            : [];
        const ratingCenterX = backdropPlacement.left + backdropPlacement.width / 2;
        let ratingLeft = ratingCenterX;
        let ratingRight = ratingCenterX;
        let ratingBlockTop = startY;
        let ratingBlockBottom = startY;
        let ratingRows = 0;
        if (backdropPlacement.stack === 'column' && verticalBackdropColumns.length > 0) {
          const estimatedColumns = verticalBackdropColumns.map((columnBadges) => {
            const maxWidth = columnBadges.reduce(
              (columnMaxWidth, badge) =>
                Math.max(
                  columnMaxWidth,
                  estimateBadgeWidth(
                    badge.value,
                    input.badgeFontSize,
                    input.badgePaddingX,
                    input.badgeIconSize,
                    input.badgeGap,
                    false,
                    input.verticalBadgeContent
                  )
                ),
              0
            );
            return {
              maxWidth,
              height: measureBadgeColumnHeight(columnBadges, metrics, input.verticalBadgeContent),
            };
          });
          const ratingBlockWidth =
            estimatedColumns.reduce((sum, column) => sum + column.maxWidth, 0) +
            Math.max(0, estimatedColumns.length - 1) * Math.max(12, input.badgeGap);
          const columnStartX =
            backdropPlacement.align === 'right'
              ? backdropPlacement.left + backdropPlacement.width - ratingBlockWidth
              : backdropPlacement.align === 'center'
                ? backdropPlacement.left + Math.floor((backdropPlacement.width - ratingBlockWidth) / 2)
                : backdropPlacement.left;
          const tallestHeight = estimatedColumns.reduce(
            (maxHeight, column) => Math.max(maxHeight, column.height),
            0
          );
          ratingLeft = columnStartX;
          ratingRight = columnStartX + ratingBlockWidth;
          ratingBlockTop =
            backdropPlacement.vertical === 'bottom'
              ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - tallestHeight)
              : backdropPlacement.vertical === 'center'
                ? Math.max(input.badgeTopOffset, Math.round((input.outputHeight - tallestHeight) / 2))
                : startY;
          ratingBlockBottom = ratingBlockTop + tallestHeight;
        } else {
          const ratingBlockWidth = backdropRows.reduce((maxWidth, row) => {
            const rowWidth = Math.min(measureBadgeRowWidth(row, metrics), effectiveMaxWidth);
            return Math.max(maxWidth, rowWidth);
          }, 0);
          const totalRowsHeight =
            backdropRows.length * badgeHeight + Math.max(0, backdropRows.length - 1) * input.badgeGap;
          if (backdropPlacement.align === 'right') {
            ratingRight = backdropPlacement.left + backdropPlacement.width;
            ratingLeft = ratingRight - ratingBlockWidth;
          } else if (backdropPlacement.align === 'left') {
            ratingLeft = backdropPlacement.left;
            ratingRight = ratingLeft + ratingBlockWidth;
          } else {
            ratingLeft = ratingCenterX - ratingBlockWidth / 2;
            ratingRight = ratingCenterX + ratingBlockWidth / 2;
          }
          ratingRows =
            input.backdropRows && input.backdropRows.length > 0
              ? input.backdropRows.length
              : (input.topBadges.length > 0 ? 1 : 0) + (input.bottomBadges.length > 0 ? 1 : 0);
          ratingBlockTop =
            backdropPlacement.vertical === 'bottom'
              ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - totalRowsHeight)
              : backdropPlacement.vertical === 'center'
                ? Math.max(input.badgeTopOffset, Math.round((input.outputHeight - totalRowsHeight) / 2))
                : startY;
          ratingBlockBottom =
            ratingRows > 0
              ? ratingBlockTop + totalRowsHeight
              : startY;
        }
        const stackedQualityStartY =
          input.backdropRatingsLayout === 'center' || input.backdropRatingsLayout === 'right-vertical'
            ? startY
            : ratingBlockBottom + Math.max(input.badgeGap, Math.round(columnGap * 1.2));
        const placeQualityLeftOfRatings = backdropPlacement.align === 'right';
        let qualityStartY = placeQualityLeftOfRatings ? ratingBlockTop : stackedQualityStartY;

        if (rightColumn.length === 0) {
          let singleX = Math.max(
            12,
            Math.round(
              input.backdropRatingsLayout === 'center'
                ? ratingCenterX - uniformBadgeWidth / 2
                : placeQualityLeftOfRatings
                  ? ratingLeft - columnGap - uniformBadgeWidth
                  : input.backdropRatingsLayout.startsWith('right')
                    ? ratingRight + columnGap
                    : ratingLeft - columnGap - uniformBadgeWidth
            )
          );
          if (backdropPlacement.stack === 'column') {
            qualityStartY = ratingBlockTop;
            singleX = Math.max(12, Math.round(ratingLeft - columnGap - uniformBadgeWidth));
          }
          const singleStartY =
            backdropPlacement.stack !== 'column' &&
              input.backdropRatingsLayout === 'center' &&
              ratingRows > 0
              ? startY + ratingRows * (badgeHeight + input.badgeGap)
              : qualityStartY;
          renderQualityBadgeColumnAt(
            leftColumn,
            singleStartY,
            singleX,
            qualityHeight,
            uniformBadgeWidth
          );
        } else {
          let leftX = 12;
          let rightX = Math.max(12, input.outputWidth - uniformBadgeWidth - 12);
          if (backdropPlacement.stack === 'column') {
            qualityStartY = ratingBlockTop;
            rightX = Math.max(12, Math.round(ratingLeft - columnGap - uniformBadgeWidth));
            leftX = Math.max(12, rightX - columnGap - uniformBadgeWidth);
          } else if (placeQualityLeftOfRatings) {
            rightX = ratingLeft - columnGap - uniformBadgeWidth;
            leftX = rightX - columnGap - uniformBadgeWidth;
          } else {
            leftX = ratingLeft - columnGap - uniformBadgeWidth;
            rightX = ratingRight + columnGap;
          }

          renderQualityBadgeColumnAt(
            leftColumn,
            qualityStartY,
            leftX,
            qualityHeight,
            uniformBadgeWidth
          );
          renderQualityBadgeColumnAt(
            rightColumn,
            qualityStartY,
            rightX,
            qualityHeight,
            uniformBadgeWidth
          );
        }
      }
    }

    const background =
      input.imageType === 'logo'
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 17, g: 17, b: 17, alpha: 1 };

    let pipeline = sharp({
      create: {
        width: input.outputWidth,
        height: input.finalOutputHeight,
        channels: 4,
        background,
      },
    }).composite(overlays);
    if (input.imageType === 'logo') {
      pipeline = pipeline.trim({ background: transparentBackground });
    }

    let finalBuffer: Buffer;
    let outputContentType = outputFormatToContentType(input.outputFormat);
    if (input.outputFormat === 'webp') {
      finalBuffer = await pipeline.webp({ quality: 80, effort: 3 }).toBuffer();
    } else if (input.outputFormat === 'jpeg') {
      finalBuffer = await pipeline.jpeg({ quality: 82 }).toBuffer();
    } else {
      finalBuffer = await pipeline.png({ compressionLevel: 1 }).toBuffer();
    }

    return {
      body: bufferToArrayBuffer(finalBuffer),
      contentType: outputContentType,
      cacheControl: input.cacheControl,
    };
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const requestStartedAt = performance.now();
  const phases: PhaseDurations = {
    auth: 0,
    tmdb: 0,
    mdb: 0,
    stream: 0,
    render: 0,
  };
  const responseHeadersCacheControl = 'no-store, max-age=0';

  const respond = (body: string | Buffer | ArrayBuffer, status: number, headers?: HeadersInit) => {
    const finalHeaders = new Headers(headers);
    const totalMs = performance.now() - requestStartedAt;
    finalHeaders.set('Server-Timing', buildServerTimingHeader(phases, totalMs));
    return new Response(body as any, { status, headers: finalHeaders });
  };

  const { type, id } = await params;
  if (!isRenderImageType(type)) {
    return respond('Invalid image type', 400);
  }
  scheduleImdbDatasetSync();
  const imageType = type;
  const outputFormat = pickOutputFormat(imageType, request.headers.get('accept'));
  const cleanId = id.replace('.jpg', '');

  // Extract configuration from token or query parameters
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-erdb-token');
  const tokenData = token ? getTokenConfig(token) : null;
  const tokenConfig = (tokenData?.config || {}) as any;
  const tokenUpdatedAt = tokenData?.updatedAt || 0;

  const lang = tokenConfig.lang || request.nextUrl.searchParams.get('lang') || FALLBACK_IMAGE_LANGUAGE;
  const posterLang =
    tokenConfig.posterLang || request.nextUrl.searchParams.get('posterLang') || null;
  const posterAnimeLang =
    tokenConfig.posterAnimeLang || request.nextUrl.searchParams.get('posterAnimeLang') || null;
  const backdropLang =
    tokenConfig.backdropLang || request.nextUrl.searchParams.get('backdropLang') || null;
  const backdropAnimeLang =
    tokenConfig.backdropAnimeLang || request.nextUrl.searchParams.get('backdropAnimeLang') || null;
  const logoLang =
    tokenConfig.logoLang || request.nextUrl.searchParams.get('logoLang') || null;
  const logoAnimeLang =
    tokenConfig.logoAnimeLang || request.nextUrl.searchParams.get('logoAnimeLang') || null;
  const globalRatings = tokenConfig.ratings || request.nextUrl.searchParams.get('ratings');

  const getRatings = (configKey: string, queryKey: string) => {
    const fromConfig = tokenConfig[configKey];
    if (Array.isArray(fromConfig)) return fromConfig.join(',');
    if (typeof fromConfig === 'string') return fromConfig;
    return request.nextUrl.searchParams.get(queryKey);
  };

  const posterRatings = getRatings('posterRatingPreferences', 'posterRatings') ?? globalRatings;
  const backdropRatings = getRatings('backdropRatingPreferences', 'backdropRatings') ?? globalRatings;
  const thumbnailRatings =
    getRatings('thumbnailRatingPreferences', 'thumbnailRatings') ??
    getRatings('backdropRatingPreferences', 'backdropRatings') ??
    globalRatings;
  const logoRatings = getRatings('logoRatingPreferences', 'logoRatings') ?? globalRatings;

  const imageTextParam =
    tokenConfig.posterImageText ||
    request.nextUrl.searchParams.get('imageText') ||
    request.nextUrl.searchParams.get('posterText');
  const posterAnimeImageTextParam =
    tokenConfig.posterAnimeImageText ||
    request.nextUrl.searchParams.get('posterAnimeImageText');
  const backdropAnimeImageTextParam =
    tokenConfig.backdropAnimeImageText ||
    request.nextUrl.searchParams.get('backdropAnimeImageText');
  const backdropImageTextParam =
    tokenConfig.backdropImageText ||
    request.nextUrl.searchParams.get('backdropText') ||
    request.nextUrl.searchParams.get('imageText');
  
  const imageText = type === 'backdrop' || type === 'thumbnail'
    ? (backdropImageTextParam || 'clean')
    : (imageTextParam || 'default');

  const posterRatingsLayout = normalizePosterRatingLayout(tokenConfig.posterRatingsLayout || request.nextUrl.searchParams.get('posterRatingsLayout'));
  const posterRatingsMaxPerSide = normalizePosterRatingsMaxPerSide(tokenConfig.posterRatingsMaxPerSide ?? request.nextUrl.searchParams.get('posterRatingsMaxPerSide'));
  const logoRatingsMax = normalizeLogoRatingsMax(tokenConfig.logoRatingsMax ?? request.nextUrl.searchParams.get('logoRatingsMax'));
  const logoMode = normalizeLogoMode(tokenConfig.logoMode || request.nextUrl.searchParams.get('logoMode'));
  const logoFontVariant = normalizeLogoFontVariant(tokenConfig.logoFontVariant || request.nextUrl.searchParams.get('logoFontVariant'));
  
  const logoPrimary = normalizeHexColor(
    tokenConfig.logoCustomPrimary || request.nextUrl.searchParams.get('logoPrimary'),
    DEFAULT_LOGO_CUSTOM_PRIMARY
  );
  const logoSecondary = normalizeHexColor(
    tokenConfig.logoCustomSecondary || request.nextUrl.searchParams.get('logoSecondary'),
    DEFAULT_LOGO_CUSTOM_SECONDARY
  );
  const logoOutline = normalizeHexColor(
    tokenConfig.logoCustomOutline || request.nextUrl.searchParams.get('logoOutline'),
    DEFAULT_LOGO_CUSTOM_OUTLINE
  );
  
  const backdropRatingsLayout = normalizeBackdropRatingLayout(tokenConfig.backdropRatingsLayout || request.nextUrl.searchParams.get('backdropRatingsLayout'));
  const thumbnailRatingsLayout = normalizeThumbnailRatingLayout(
    tokenConfig.thumbnailRatingsLayout || request.nextUrl.searchParams.get('thumbnailRatingsLayout')
  );
  
  const posterVerticalBadgeContent = normalizeVerticalBadgeContent(
    tokenConfig.posterVerticalBadgeContent ||
    tokenConfig.verticalBadgeContent ||
    request.nextUrl.searchParams.get('posterVerticalBadgeContent') ||
    request.nextUrl.searchParams.get('verticalBadgeContent')
  );
  const backdropVerticalBadgeContent = normalizeVerticalBadgeContent(
    tokenConfig.backdropVerticalBadgeContent ||
    tokenConfig.verticalBadgeContent ||
    request.nextUrl.searchParams.get('backdropVerticalBadgeContent') ||
    request.nextUrl.searchParams.get('verticalBadgeContent')
  );
  const thumbnailVerticalBadgeContent = normalizeVerticalBadgeContent(
    tokenConfig.thumbnailVerticalBadgeContent ||
    tokenConfig.backdropVerticalBadgeContent ||
    tokenConfig.verticalBadgeContent ||
    request.nextUrl.searchParams.get('thumbnailVerticalBadgeContent') ||
    request.nextUrl.searchParams.get('backdropVerticalBadgeContent') ||
    request.nextUrl.searchParams.get('verticalBadgeContent')
  );
  
  const verticalBadgeContent =
    imageType === 'poster'
      ? isVerticalPosterRatingLayout(posterRatingsLayout)
        ? posterVerticalBadgeContent
        : 'standard'
      : imageType === 'thumbnail'
        ? isVerticalThumbnailRatingLayout(thumbnailRatingsLayout)
          ? thumbnailVerticalBadgeContent
          : 'standard'
        : imageType === 'backdrop'
          ? isVerticalBackdropRatingLayout(backdropRatingsLayout)
            ? backdropVerticalBadgeContent
            : 'standard'
          : 'standard';
          
  const thumbnailSize = normalizeThumbnailSize(tokenConfig.thumbnailSize || request.nextUrl.searchParams.get('thumbnailSize'));
  const backdropRatingsSize = normalizeBackdropRatingsSize(
    tokenConfig.backdropRatingsSize || request.nextUrl.searchParams.get('backdropRatingsSize')
  );
  
  const globalStreamBadgesSetting = normalizeStreamBadgesSetting(tokenConfig.streamBadges || request.nextUrl.searchParams.get('streamBadges'));
  const posterStreamBadgesSetting = normalizeStreamBadgesSetting(
    tokenConfig.posterStreamBadges || tokenConfig.streamBadges || request.nextUrl.searchParams.get('posterStreamBadges') || request.nextUrl.searchParams.get('streamBadges')
  );
  const backdropStreamBadgesSetting = normalizeStreamBadgesSetting(
    tokenConfig.backdropStreamBadges || tokenConfig.streamBadges || request.nextUrl.searchParams.get('backdropStreamBadges') || request.nextUrl.searchParams.get('streamBadges')
  );
  
  const streamBadgesSetting =
    imageType === 'poster'
      ? posterStreamBadgesSetting
      : imageType === 'backdrop'
        ? backdropStreamBadgesSetting
        : globalStreamBadgesSetting;
        
  const qualityBadgesSide = normalizeQualityBadgesSide(
    tokenConfig.qualityBadgesSide ||
    request.nextUrl.searchParams.get('qualityBadgesSide') ||
    request.nextUrl.searchParams.get('qualityBadgesPosition')
  );
  const posterQualityBadgesPosition = normalizePosterQualityBadgesPosition(
    tokenConfig.posterQualityBadgesPosition || request.nextUrl.searchParams.get('posterQualityBadgesPosition')
  );
  
  const globalQualityBadgesStyle = normalizeQualityBadgesStyle(
    tokenConfig.qualityBadgesStyle || request.nextUrl.searchParams.get('qualityBadgesStyle')
  );
  const posterQualityBadgesStyle = normalizeQualityBadgesStyle(
    tokenConfig.posterQualityBadgesStyle ||
    tokenConfig.qualityBadgesStyle ||
    request.nextUrl.searchParams.get('posterQualityBadgesStyle') ||
    request.nextUrl.searchParams.get('qualityBadgesStyle')
  );
  const backdropQualityBadgesStyle = normalizeQualityBadgesStyle(
    tokenConfig.backdropQualityBadgesStyle ||
    tokenConfig.qualityBadgesStyle ||
    request.nextUrl.searchParams.get('backdropQualityBadgesStyle') ||
    request.nextUrl.searchParams.get('qualityBadgesStyle')
  );
  
  const qualityBadgesStyle =
    imageType === 'poster'
      ? posterQualityBadgesStyle
      : imageType === 'backdrop'
        ? backdropQualityBadgesStyle
        : globalQualityBadgesStyle;
        
  const globalRatingStyleParam =
    tokenConfig.ratingStyle || request.nextUrl.searchParams.get('ratingStyle') || request.nextUrl.searchParams.get('style');
    
  const posterRatingStyle = normalizeRatingStyle(
    tokenConfig.posterRatingStyle || globalRatingStyleParam || request.nextUrl.searchParams.get('posterRatingStyle')
  );
  const backdropRatingStyle = normalizeRatingStyle(
    tokenConfig.backdropRatingStyle || globalRatingStyleParam || request.nextUrl.searchParams.get('backdropRatingStyle')
  );
  const thumbnailRatingStyle = normalizeRatingStyle(
    tokenConfig.thumbnailRatingStyle || globalRatingStyleParam || request.nextUrl.searchParams.get('thumbnailRatingStyle')
  );
  const logoRatingStyle = normalizeRatingStyle(
    tokenConfig.logoRatingStyle || globalRatingStyleParam || request.nextUrl.searchParams.get('logoRatingStyle')
  );
  
  const ratingStyle =
    imageType === 'poster'
      ? posterRatingStyle
      : imageType === 'backdrop'
        ? backdropRatingStyle
        : imageType === 'thumbnail'
          ? thumbnailRatingStyle
          : imageType === 'logo'
            ? logoRatingStyle
            : normalizeRatingStyle(globalRatingStyleParam);
            
  const mdblistKey = tokenConfig.mdblistKey || request.nextUrl.searchParams.get('mdblistKey') || request.nextUrl.searchParams.get('mdblist_key');
  const tmdbKey = tokenConfig.tmdbKey || request.nextUrl.searchParams.get('tmdbKey') || request.nextUrl.searchParams.get('tmdb_key');
  const simklClientId =
    tokenConfig.simklClientId ||
    request.nextUrl.searchParams.get('simklClientId') ||
    request.nextUrl.searchParams.get('simkl_client_id') ||
    SIMKL_CLIENT_ID;

  const parts = cleanId.split(':');
  const idPrefix = (parts[0] || '').trim().toLowerCase();
  const inputAnimeMappingProvider = toAnimeMappingProvider(idPrefix);
  let inputAnimeMappingExternalId =
    inputAnimeMappingProvider && typeof parts[1] === 'string' && parts[1].trim().length > 0
      ? parts[1].trim()
      : null;
  let mediaId = parts[0];
  let season: string | null = null;
  let episode: string | null = null;
  let isTmdb = false;
  let isTvdb = false;
  let isRealImdb = false;
  let tvdbSeriesId: string | null = null;
  let isKitsu = false;
  let explicitTmdbMediaType: 'movie' | 'tv' | null = null;
  const hasNativeAnimeInput = ANIME_NATIVE_INPUT_ID_PREFIX_SET.has(idPrefix);
  let hasConfirmedAnimeMapping = hasNativeAnimeInput;
  let allowAnimeOnlyRatings = hasNativeAnimeInput;

  if (idPrefix === 'tmdb') {
    isTmdb = true;
    const explicitTypeCandidate = (parts[1] || '').trim().toLowerCase();
    if (explicitTypeCandidate === 'movie' || explicitTypeCandidate === 'tv' || explicitTypeCandidate === 'series') {
      explicitTmdbMediaType = explicitTypeCandidate === 'series' ? 'tv' : (explicitTypeCandidate as 'movie' | 'tv');
      mediaId = parts[2];
      season = parts.length > 3 ? parts[3] : null;
      episode = parts.length > 4 ? parts[4] : null;
      if (mediaId) {
        inputAnimeMappingExternalId = mediaId;
      }
    } else {
      mediaId = parts[1];
      season = parts.length > 2 ? parts[2] : null;
      episode = parts.length > 3 ? parts[3] : null;
    }
  } else if (idPrefix === 'tvdb') {
    isTvdb = true;
    mediaId = parts[1];
    tvdbSeriesId = parts[1] || null;
    season = parts.length > 2 ? parts[2] : null;
    episode = parts.length > 3 ? parts[3] : null;
  } else if (idPrefix === 'realimdb') {
    isRealImdb = true;
    mediaId = parts[1];
    season = parts.length > 2 ? parts[2] : null;
    episode = parts.length > 3 ? parts[3] : null;
  } else if (idPrefix === 'kitsu') {
    isKitsu = true;
    const parsedKitsu = parseKitsuInputParts(parts);
    mediaId = parsedKitsu.mediaId;
    season = parsedKitsu.season;
    episode = parsedKitsu.episode;
  } else if (idPrefix === 'imdb' && inputAnimeMappingExternalId) {
    mediaId = inputAnimeMappingExternalId;
    season = parts.length > 2 ? parts[2] : null;
    episode = parts.length > 3 ? parts[3] : null;
  } else if (inputAnimeMappingProvider && inputAnimeMappingExternalId) {
    mediaId = inputAnimeMappingExternalId;
    season = parts.length > 2 ? parts[2] : null;
    episode = parts.length > 3 ? parts[3] : null;
  } else {
    season = parts.length > 1 ? parts[1] : null;
    episode = parts.length > 2 ? parts[2] : null;
  }

  const activeImageLang =
    imageType === 'poster'
      ? String(posterLang || '').trim().toLowerCase() === 'original'
        ? lang
        : posterLang || lang
      : imageType === 'backdrop'
        ? String(backdropLang || '').trim().toLowerCase() === 'original'
          ? lang
          : backdropLang || lang
        : imageType === 'logo'
          ? String(logoLang || '').trim().toLowerCase() === 'original'
            ? lang
            : logoLang || lang
          : lang;
  const requestedImageLang = normalizeTmdbLanguageCode(activeImageLang) || FALLBACK_IMAGE_LANGUAGE;
  const includeImageLanguage = buildIncludeImageLanguage(
    requestedImageLang,
    FALLBACK_IMAGE_LANGUAGE
  );
  const aiometadataEpisodeProvider = normalizeAiometadataEpisodeProvider(
    request.nextUrl.searchParams.get('aiometadataProvider')
  );
  const normalizedPosterImageText =
    imageText === 'original' ? 'default' : imageText;
  const normalizedPosterAnimeImageText =
    posterAnimeImageTextParam === 'original' ? 'default' : posterAnimeImageTextParam;
  const posterTextPreference: PosterTextPreference =
    normalizedPosterImageText === 'clean' ||
    normalizedPosterImageText === 'alternative' ||
    normalizedPosterImageText === 'default'
      ? normalizedPosterImageText
      : 'default';
  const posterAnimeTextPreference: PosterTextPreference =
    normalizedPosterAnimeImageText === 'clean' ||
    normalizedPosterAnimeImageText === 'alternative' ||
    normalizedPosterAnimeImageText === 'default'
      ? normalizedPosterAnimeImageText
      : 'clean';
  const normalizedBackdropAnimeImageText =
    backdropAnimeImageTextParam === 'original' ? 'default' : backdropAnimeImageTextParam;
  const backdropAnimeTextPreference: PosterTextPreference =
    normalizedBackdropAnimeImageText === 'clean' ||
    normalizedBackdropAnimeImageText === 'alternative' ||
    normalizedBackdropAnimeImageText === 'default'
      ? normalizedBackdropAnimeImageText
      : 'clean';
  const ratingsForType =
    imageType === 'poster'
      ? posterRatings
      : imageType === 'backdrop'
        ? backdropRatings
        : imageType === 'thumbnail'
          ? thumbnailRatings
          : logoRatings;
  const thumbnailSupportedRatings = new Set<RatingPreference>(['tmdb', 'imdb']);
  const requestedRatingPreferences =
    imageType === 'thumbnail'
      ? (ratingsForType === null || ratingsForType === undefined
        ? (['tmdb', 'imdb'] as RatingPreference[])
        : parseRatingPreferencesAllowEmpty(ratingsForType).filter((rating) =>
          thumbnailSupportedRatings.has(rating)
        ))
      : ratingsForType === null || ratingsForType === undefined
        ? [...ALL_RATING_PREFERENCES]
        : parseRatingPreferencesAllowEmpty(ratingsForType);
  const ratingPreferences =
    requestedRatingPreferences;
  const shouldApplyRatings = ratingPreferences.length > 0;
  const shouldApplyStreamBadges =
    imageType !== 'logo' &&
    imageType !== 'thumbnail' &&
    (streamBadgesSetting === 'on' || streamBadgesSetting === 'auto') &&
    !hasNativeAnimeInput;
  const streamBadgesSeedTtlMs = shouldApplyStreamBadges
    ? getDeterministicTtlMs(STREAM_BADGES_CACHE_TTL_MS, cleanId)
    : null;
  const streamBadgesSeedWindow =
    shouldApplyStreamBadges && streamBadgesSeedTtlMs
      ? Math.floor(Date.now() / streamBadgesSeedTtlMs)
      : null;
  const streamBadgesCacheKeySeed = shouldApplyStreamBadges
    ? `streambadges:${streamBadgesSeedWindow ?? 0}`
    : 'off';
  const shouldCacheFinalImage = isObjectStorageConfigured();
  const effectiveRatingPreferences = shouldApplyRatings ? Array.from(new Set<RatingPreference>(ratingPreferences)) : [];
  const selectedRatings = new Set<RatingPreference>(effectiveRatingPreferences);
  const mdblistCacheSeed = buildMdbListCacheSeed(mdblistKey);
  const simklCacheSeed = buildSecretCacheSeed('simkl', simklClientId);
  const renderSeedKey = [
    FINAL_IMAGE_RENDERER_CACHE_VERSION,
    imageType,
    outputFormat,
    cleanId,
    requestedImageLang,
    imageType === 'poster'
      ? `${posterTextPreference}:${posterAnimeTextPreference}`
      : imageType === 'backdrop'
        ? `${posterTextPreference}:${backdropAnimeTextPreference}`
        : posterTextPreference,
    imageType === 'poster' ? posterRatingsLayout : '-',
    imageType === 'poster' ? String(posterRatingsMaxPerSide ?? 'auto') : '-',
    imageType === 'poster' ? String(posterLang || '-') : '-',
    imageType === 'poster' ? String(posterAnimeLang || '-') : '-',
    imageType === 'backdrop' ? String(backdropLang || '-') : '-',
    imageType === 'backdrop' ? String(backdropAnimeLang || '-') : '-',
    imageType === 'logo' ? String(logoLang || '-') : '-',
    imageType === 'logo' ? String(logoAnimeLang || '-') : '-',
    imageType === 'poster' ? String(posterAnimeImageTextParam || '-') : '-',
    imageType === 'backdrop' ? String(backdropAnimeImageTextParam || '-') : '-',
    imageType === 'logo' ? String(logoRatingsMax ?? 'auto') : '-',
    imageType === 'logo' ? logoMode : DEFAULT_LOGO_MODE,
    imageType === 'logo' ? logoFontVariant : DEFAULT_LOGO_FONT_VARIANT,
    imageType === 'logo' ? logoPrimary : DEFAULT_LOGO_CUSTOM_PRIMARY,
    imageType === 'logo' ? logoSecondary : DEFAULT_LOGO_CUSTOM_SECONDARY,
    imageType === 'logo' ? logoOutline : DEFAULT_LOGO_CUSTOM_OUTLINE,
    imageType === 'poster' ? qualityBadgesSide : '-',
    imageType === 'poster' && (posterRatingsLayout === 'top' || posterRatingsLayout === 'bottom')
      ? posterQualityBadgesPosition
      : '-',
    imageType !== 'logo' ? qualityBadgesStyle : '-',
    imageType === 'backdrop' ? backdropRatingsLayout : imageType === 'thumbnail' ? thumbnailRatingsLayout : '-',
    imageType === 'backdrop' ? backdropRatingsSize : '-',
    imageType === 'thumbnail' ? thumbnailSize : '-',
    imageType === 'thumbnail' ? aiometadataEpisodeProvider || '-' : '-',
    ratingStyle,
    effectiveRatingPreferences.join(',') || 'none',
    mdblistCacheSeed,
    simklCacheSeed,
    tokenUpdatedAt.toString(),
  ].join('|');
  const objectStorageEnabled = isObjectStorageConfigured();

  if (!tmdbKey) {
    return respond('TMDB API Key (tmdbKey) is required', 400);
  }

  const hadSharedRender = shouldCacheFinalImage && finalImageInFlight.has(renderSeedKey);
  let objectStorageHit = false;

  try {
    const renderedImage = await withDedupe(finalImageInFlight, renderSeedKey, async () => {
      let media = null;
      let mediaType: 'movie' | 'tv' | null = null;
      let useRawKitsuFallback = false;
      let rawFallbackImageUrl: string | null = null;
      let rawFallbackKitsuRating: string | null = null;
      let rawFallbackTitle: string | null = null;
      let rawFallbackLogoAspectRatio: number | null = null;
      let mappedImdbId: string | null = null;

      if (isTmdb) {
        if (explicitTmdbMediaType) {
          const tmdbResponse = await fetchJsonCached(
            `tmdb:${explicitTmdbMediaType}:${mediaId}`,
            `https://api.themoviedb.org/3/${explicitTmdbMediaType}/${mediaId}?api_key=${tmdbKey}`,
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          if (tmdbResponse.ok) {
            media = tmdbResponse.data;
            mediaType = explicitTmdbMediaType;
          }
        } else {
          // Try to fetch as movie
          const movieResponse = await fetchJsonCached(
            `tmdb:movie:${mediaId}`,
            `https://api.themoviedb.org/3/movie/${mediaId}?api_key=${tmdbKey}`,
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          if (movieResponse.ok) {
            media = movieResponse.data;
            mediaType = 'movie';
          } else {
            // Try as TV
            const tvResponse = await fetchJsonCached(
              `tmdb:tv:${mediaId}`,
              `https://api.themoviedb.org/3/tv/${mediaId}?api_key=${tmdbKey}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            if (tvResponse.ok) {
              media = tvResponse.data;
              mediaType = 'tv';
            }
          }
        }
      } else if (isTvdb) {
        if (!mediaId) {
          throw new HttpError('TVDB series ID is required', 400);
        }

        if (season && episode) {
          const mappedEpisode = await resolveTvdbEpisodeToTmdb(mediaId, season, episode, tmdbKey, phases);
          if (!mappedEpisode?.showId) {
            throw new HttpError('TVDB aired-order episode not found on TMDB', 404);
          }
          mediaId = mappedEpisode.showId;
          season = mappedEpisode.season;
          episode = mappedEpisode.episode;
        }

        const tvFindResponse = await fetchJsonCached(
          `tmdb:find:tvdb-series:${tvdbSeriesId}`,
          `https://api.themoviedb.org/3/find/${tvdbSeriesId}?api_key=${tmdbKey}&external_source=tvdb_id`,
          TMDB_CACHE_TTL_MS,
          phases,
          'tmdb'
        );
        const tvFindData = tvFindResponse.data || {};
        const tvResult = tvFindData.tv_results?.[0] || null;
        if (tvResult) {
          media = tvResult;
          mediaType = 'tv';
        }
      } else if (isRealImdb) {
        if (!mediaId) {
          throw new HttpError('IMDb ID is required', 400);
        }

        const imdbEpisode =
          season && episode
            ? findImdbEpisodeBySeriesSeasonEpisode(mediaId, Number(season), Number(episode))
            : getImdbEpisodeFromDataset(mediaId);
        const imdbLookupId = imdbEpisode?.imdbId || mediaId;

        const findResponse = await fetchJsonCached(
          `tmdb:find:realimdb:${imdbLookupId}`,
          `https://api.themoviedb.org/3/find/${imdbLookupId}?api_key=${tmdbKey}&external_source=imdb_id`,
          TMDB_CACHE_TTL_MS,
          phases,
          'tmdb'
        );
        const findData = findResponse.data || {};
        const episodeResult = findData.tv_episode_results?.[0] || null;
        if (episodeResult?.show_id) {
          mediaId = String(episodeResult.show_id);
          season = Number.isFinite(Number(episodeResult.season_number)) ? String(episodeResult.season_number) : season;
          episode = Number.isFinite(Number(episodeResult.episode_number)) ? String(episodeResult.episode_number) : episode;
          mappedImdbId = imdbEpisode?.seriesImdbId || mediaId;

          const showResponse = await fetchJsonCached(
            `tmdb:tv:${mediaId}`,
            `https://api.themoviedb.org/3/tv/${mediaId}?api_key=${tmdbKey}`,
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          if (showResponse.ok) {
            media = showResponse.data;
            mediaType = 'tv';
          }
        } else {
          const tvResult = findData.tv_results?.[0] || null;
          if (tvResult) {
            media = tvResult;
            mediaType = 'tv';
            if (season && episode) {
              const yearBucketMapping = await resolveTmdbEpisodeByYearBucket(
                String(tvResult.id),
                season,
                episode,
                tmdbKey,
                phases
              );
              if (yearBucketMapping) {
                mediaId = yearBucketMapping.showId;
                season = yearBucketMapping.season;
                episode = yearBucketMapping.episode;
              }
            }
          }
        }
      } else if (isKitsu) {
        let mappingUrl = `https://animemapping.realbestia.com/kitsu/${mediaId}`;
        if (episode) {
          mappingUrl += `?ep=${episode}`;
        }
        const mappingResponse = await fetchJsonCached(
          `kitsu:mapping:${mediaId}:${episode || '-'}`,
          mappingUrl,
          KITSU_CACHE_TTL_MS,
          phases,
          'tmdb'
        );
        const mappingData = mappingResponse.data || {};
        const mappingSubtype = extractAnimeSubtypeFromAnimemapping(mappingData);
        const mappingImdbCandidates = [
          mappingData.mappings?.ids?.imdb,
          mappingData.mappings?.ids?.imdb_id,
          mappingData.mappings?.imdb,
          mappingData.imdb_id,
          mappingData.imdb,
        ];
        for (const candidate of mappingImdbCandidates) {
          const normalized = typeof candidate === 'string' ? candidate.trim() : '';
          if (isImdbId(normalized)) {
            mappedImdbId = normalized;
            break;
          }
        }

        let tmdbId = '';
        const tmdbEpisode = mappingData.mappings?.tmdb_episode || mappingData.tmdb_episode;
        if (episode && tmdbEpisode) {
          tmdbId = tmdbEpisode.id;
          season = tmdbEpisode.season;
          episode = tmdbEpisode.episode;
        } else if (mappingData.mappings?.ids?.tmdb) {
          tmdbId = mappingData.mappings.ids.tmdb;
        }

        // For season-level Kitsu IDs (no explicit season), infer season from ep=1 mapping.
        if (mappingSubtype !== 'movie' && !season) {
          const seasonProbeResponse = await fetchJsonCached(
            `kitsu:mapping:${mediaId}:1`,
            `https://animemapping.realbestia.com/kitsu/${mediaId}?ep=1`,
            KITSU_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          const seasonProbeData = seasonProbeResponse.data;
          const seasonProbeEpisode = seasonProbeData?.mappings?.tmdb_episode || seasonProbeData?.tmdb_episode;
          if (seasonProbeEpisode?.season) {
            season = seasonProbeEpisode.season;
          }
        }

        if (!tmdbId) {
          const kitsuFallbackAsset = await fetchKitsuFallbackAsset(mediaId, imageType, logoMode, logoFontVariant, logoPrimary, logoSecondary, logoOutline, phases);
          rawFallbackImageUrl = kitsuFallbackAsset?.imageUrl || null;
          rawFallbackKitsuRating = kitsuFallbackAsset?.rating || null;
          rawFallbackTitle = kitsuFallbackAsset?.title || null;
          rawFallbackLogoAspectRatio = kitsuFallbackAsset?.logoAspectRatio ?? null;
          if (!rawFallbackImageUrl) {
            throw new HttpError('TMDB ID not found for Kitsu ID', 404);
          }
          useRawKitsuFallback = true;
          allowAnimeOnlyRatings = false;
          hasConfirmedAnimeMapping = false;
        } else {
          const mappedMediaTypeCandidates: Array<'movie' | 'tv'> =
            mappingSubtype === 'movie' ? ['movie', 'tv'] : ['tv', 'movie'];

          for (const mappedMediaType of mappedMediaTypeCandidates) {
            const mappedMediaResponse = await fetchJsonCached(
              `tmdb:${mappedMediaType}:${tmdbId}`,
              `https://api.themoviedb.org/3/${mappedMediaType}/${tmdbId}?api_key=${tmdbKey}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            if (!mappedMediaResponse.ok) continue;
            media = mappedMediaResponse.data;
            mediaType = mappedMediaType;
            break;
          }

          if (!media || !mediaType) {
            const kitsuFallbackAsset = await fetchKitsuFallbackAsset(mediaId, imageType, logoMode, logoFontVariant, logoPrimary, logoSecondary, logoOutline, phases);
            rawFallbackImageUrl = kitsuFallbackAsset?.imageUrl || null;
            rawFallbackKitsuRating = kitsuFallbackAsset?.rating || null;
            rawFallbackTitle = kitsuFallbackAsset?.title || null;
            rawFallbackLogoAspectRatio = kitsuFallbackAsset?.logoAspectRatio ?? null;
            if (!rawFallbackImageUrl) {
              throw new HttpError('Movie/Show not found on TMDB', 404);
            }
            useRawKitsuFallback = true;
            allowAnimeOnlyRatings = false;
            hasConfirmedAnimeMapping = false;
          }
        }
      } else if (
        inputAnimeMappingProvider &&
        inputAnimeMappingExternalId &&
        inputAnimeMappingProvider !== 'imdb' &&
        inputAnimeMappingProvider !== 'tmdb'
      ) {
        const mappedTmdbId = await fetchTmdbIdFromReverseMapping({
          provider: inputAnimeMappingProvider,
          externalId: inputAnimeMappingExternalId,
          season,
          phases,
        });
        if (!mappedTmdbId) {
          const kitsuId = await fetchKitsuIdFromReverseMapping({
            provider: inputAnimeMappingProvider,
            externalId: inputAnimeMappingExternalId,
            season,
            phases,
          });
          if (!kitsuId) {
            throw new HttpError('TMDB ID not found for anime mapping ID', 404);
          }

          const kitsuFallbackAsset = await fetchKitsuFallbackAsset(kitsuId, imageType, logoMode, logoFontVariant, logoPrimary, logoSecondary, logoOutline, phases);
          rawFallbackImageUrl = kitsuFallbackAsset?.imageUrl || null;
          rawFallbackKitsuRating = kitsuFallbackAsset?.rating || null;
          rawFallbackTitle = kitsuFallbackAsset?.title || null;
          rawFallbackLogoAspectRatio = kitsuFallbackAsset?.logoAspectRatio ?? null;
          if (!rawFallbackImageUrl) {
            throw new HttpError('TMDB ID not found for anime mapping ID', 404);
          }
          useRawKitsuFallback = true;
          allowAnimeOnlyRatings = false;
          hasConfirmedAnimeMapping = false;
        } else {
          const tvResponse = await fetchJsonCached(
            `tmdb:tv:${mappedTmdbId}`,
            `https://api.themoviedb.org/3/tv/${mappedTmdbId}?api_key=${tmdbKey}`,
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          if (tvResponse.ok) {
            media = tvResponse.data;
            mediaType = 'tv';
          } else {
            const movieResponse = await fetchJsonCached(
              `tmdb:movie:${mappedTmdbId}`,
              `https://api.themoviedb.org/3/movie/${mappedTmdbId}?api_key=${tmdbKey}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            if (movieResponse.ok) {
              media = movieResponse.data;
              mediaType = 'movie';
            }
          }

          if (!media) {
            const kitsuId = await fetchKitsuIdFromReverseMapping({
              provider: inputAnimeMappingProvider,
              externalId: inputAnimeMappingExternalId,
              season,
              phases,
            });
            if (kitsuId) {
              const kitsuFallbackAsset = await fetchKitsuFallbackAsset(kitsuId, imageType, logoMode, logoFontVariant, logoPrimary, logoSecondary, logoOutline, phases);
              rawFallbackImageUrl = kitsuFallbackAsset?.imageUrl || null;
              rawFallbackKitsuRating = kitsuFallbackAsset?.rating || null;
              rawFallbackTitle = kitsuFallbackAsset?.title || null;
              rawFallbackLogoAspectRatio = kitsuFallbackAsset?.logoAspectRatio ?? null;
              if (rawFallbackImageUrl) {
                useRawKitsuFallback = true;
                allowAnimeOnlyRatings = false;
                hasConfirmedAnimeMapping = false;
              }
            }
          }
        }
      } else {
        // Aiometadata can emit IMDb series IDs paired with TVDB season/episode numbering.
        // In that mode, bridge IMDb -> TMDB -> TVDB aired order before rendering thumbnails.
        if (isImdbId(mediaId)) {
          const rawImdbSeriesId = mediaId;
          const shouldResolveTvdbAiredOrder =
            imageType === 'thumbnail' &&
            aiometadataEpisodeProvider === 'tvdb' &&
            typeof season === 'string' &&
            season.length > 0 &&
            typeof episode === 'string' &&
            episode.length > 0;

          if (shouldResolveTvdbAiredOrder) {
            if (typeof season !== 'string' || typeof episode !== 'string') {
              throw new HttpError('TVDB season and episode are required for Aiometadata TVDB thumbnails', 400);
            }
            const requestedTvdbSeason = season;
            const requestedTvdbEpisode = episode;
            const mappedEpisode = await resolveImdbEpisodeWithTvdbOrderToTmdb(
              rawImdbSeriesId,
              requestedTvdbSeason,
              requestedTvdbEpisode,
              tmdbKey,
              phases
            );
            if (mappedEpisode?.showId) {
              mediaId = mappedEpisode.showId;
              season = mappedEpisode.season;
              episode = mappedEpisode.episode;
              tvdbSeriesId = mappedEpisode.tvdbSeriesId;
              mappedImdbId = rawImdbSeriesId;

              const showResponse = await fetchJsonCached(
                `tmdb:tv:${mediaId}`,
                `https://api.themoviedb.org/3/tv/${mediaId}?api_key=${tmdbKey}`,
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              );
              if (showResponse.ok) {
                media = showResponse.data;
                mediaType = 'tv';
              }
            }
          }

          if (!media) {
          const findResponse = await fetchJsonCached(
            `tmdb:find:${rawImdbSeriesId}`,
            `https://api.themoviedb.org/3/find/${rawImdbSeriesId}?api_key=${tmdbKey}&external_source=imdb_id`,
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          const findData = findResponse.data || {};
          const episodeResult = findData.tv_episode_results?.[0] || null;
          const prefersTvResult =
            imageType === 'thumbnail' ||
            (typeof season === 'string' && season.length > 0) ||
            (typeof episode === 'string' && episode.length > 0);
          if (episodeResult?.show_id) {
            mediaId = String(episodeResult.show_id);
            season = Number.isFinite(Number(episodeResult.season_number)) ? String(episodeResult.season_number) : season;
            episode = Number.isFinite(Number(episodeResult.episode_number)) ? String(episodeResult.episode_number) : episode;

            const showResponse = await fetchJsonCached(
              `tmdb:tv:${mediaId}`,
              `https://api.themoviedb.org/3/tv/${mediaId}?api_key=${tmdbKey}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            if (showResponse.ok) {
              media = showResponse.data;
              mediaType = 'tv';
            }
          }

          if (!media) {
            media = prefersTvResult
              ? findData.tv_results?.[0] || findData.movie_results?.[0]
              : findData.movie_results?.[0] || findData.tv_results?.[0];
            mediaType = media
              ? findData.tv_results?.[0] && media === findData.tv_results[0]
                ? 'tv'
                : 'movie'
              : null;
          }
        }
      }
      }

      if (!media && !useRawKitsuFallback) {
        throw new HttpError('Movie/Show not found on TMDB', 404);
      }

      const mediaLooksAnimated = media ? isTmdbAnimationTitle(media) : false;
      if (!hasNativeAnimeInput) {
        allowAnimeOnlyRatings = hasConfirmedAnimeMapping && mediaLooksAnimated;
      }
      const isAnimeContent = hasNativeAnimeInput || hasConfirmedAnimeMapping || mediaLooksAnimated;
      const effectivePosterTextPreference =
        type === 'poster' && isAnimeContent ? posterAnimeTextPreference : posterTextPreference;
      const effectiveBackdropTextPreference =
        type === 'backdrop' && isAnimeContent ? backdropAnimeTextPreference : (imageText as PosterTextPreference);
      const activePosterLanguageSetting =
        imageType === 'poster'
          ? isAnimeContent && posterAnimeLang
            ? posterAnimeLang
            : posterLang
          : null;
      const activeBackdropLanguageSetting =
        imageType === 'backdrop'
          ? isAnimeContent && backdropAnimeLang
            ? backdropAnimeLang
            : backdropLang
          : null;
      const activeLogoLanguageSetting =
        imageType === 'logo'
          ? isAnimeContent && logoAnimeLang
            ? logoAnimeLang
            : logoLang
          : null;
      const isEffectiveOriginalPosterLang =
        imageType === 'poster' && isOriginalLanguageSetting(activePosterLanguageSetting);
      const isEffectiveOriginalBackdropLang =
        imageType === 'backdrop' && isOriginalLanguageSetting(activeBackdropLanguageSetting);
      const isEffectiveOriginalLogoLang =
        imageType === 'logo' && isOriginalLanguageSetting(activeLogoLanguageSetting);
      const effectivePosterRequestedImageLang = resolveRequestedImageLanguage({
        configuredLanguage: activePosterLanguageSetting,
        requestLanguage: lang,
        fallbackLanguage: FALLBACK_IMAGE_LANGUAGE,
      });
      const effectiveBackdropRequestedImageLang = resolveRequestedImageLanguage({
        configuredLanguage: activeBackdropLanguageSetting,
        requestLanguage: lang,
        fallbackLanguage: FALLBACK_IMAGE_LANGUAGE,
      });
      const effectiveLogoRequestedImageLang = resolveRequestedImageLanguage({
        configuredLanguage: activeLogoLanguageSetting,
        requestLanguage: lang,
        fallbackLanguage: FALLBACK_IMAGE_LANGUAGE,
      });
      const effectivePosterFallbackImageLang =
        normalizeTmdbLanguageCode(lang) || FALLBACK_IMAGE_LANGUAGE;
      const requestedImageLanguageFallbacks = getTmdbLanguageFallbackChain(
        requestedImageLang,
        FALLBACK_IMAGE_LANGUAGE
      );
      const mediaOriginalLanguage =
        typeof media?.original_language === 'string' && media.original_language.trim().length > 0
          ? media.original_language.trim()
          : null;
      const resolvedIncludeImageLanguage = buildIncludeImageLanguage(
        resolveOriginalAwareImageLanguage({
          configuredLanguage:
            imageType === 'poster'
              ? activePosterLanguageSetting
              : imageType === 'backdrop'
                ? activeBackdropLanguageSetting
                : imageType === 'logo'
                  ? activeLogoLanguageSetting
                  : null,
          requestLanguage: requestedImageLang,
          mediaOriginalLanguage,
          fallbackLanguage: FALLBACK_IMAGE_LANGUAGE,
        }),
        FALLBACK_IMAGE_LANGUAGE
      );

      let imgPath = '';
      let imgUrl = rawFallbackImageUrl;
      let tmdbRating = 'N/A';
      let episodeTmdbRating: string | null = null;
      let thumbnailFallbackEpisodeText: string | null = null;
      let thumbnailFallbackEpisodeCode: string | null = null;
      let usedThumbnailBackdropFallback = false;
      let resolvedTmdbEpisodeNumber: string | null = null;
      let providerRatings = new Map<RatingPreference, string>();
      const renderedRatingTtlByProvider = new Map<BadgeKey, number>();
      let outputWidth = 1280;
      let outputHeight = 720;
      let selectedLogoAspectRatio: number | null = null;
      let selectedPosterLogoPath: string | null = null;
      let selectedPosterIsTextless = false;
      const shouldUsePosterOriginalLanguageForLogo =
        imageType === 'poster' &&
        isEffectiveOriginalPosterLang &&
        effectivePosterTextPreference === 'clean';
      const requestedExternalRatings = new Set([...selectedRatings]);
      const needsAnimeOnlyRatings = [...requestedExternalRatings].some((provider) =>
        ANIME_ONLY_RATING_PROVIDER_SET.has(provider)
      );
      const shouldAttemptAnimeMapping = hasNativeAnimeInput || mediaLooksAnimated;
      const needsExternalRatings = [...requestedExternalRatings].some((provider) => provider !== 'tmdb');
      const needsImdbRating = requestedExternalRatings.has('imdb');
      const needsKitsuRating = requestedExternalRatings.has('kitsu');
      const hasMdbListApiKey = MDBLIST_API_KEYS.length > 0;
      const shouldRenderRawKitsuFallbackRating =
        useRawKitsuFallback && needsKitsuRating && typeof rawFallbackKitsuRating === 'string' && rawFallbackKitsuRating.length > 0;
      const shouldRenderRatings = shouldApplyRatings && (!useRawKitsuFallback || shouldRenderRawKitsuFallbackRating);
      const shouldRenderStreamBadges = shouldApplyStreamBadges && !isAnimeContent;
      const shouldRenderBadges = shouldRenderRatings || shouldRenderStreamBadges;
      if (imageType === 'thumbnail' && (mediaType !== 'tv' || !season || !episode)) {
        throw new HttpError('Thumbnails are only available for TV episodes', 404);
      }
      const releaseDateForCache =
        mediaType === 'movie' ? media?.release_date : mediaType === 'tv' ? media?.first_air_date : null;
      const tmdbIdForCache =
        media?.id != null
          ? String(media.id)
          : isTmdb && mediaId
            ? String(mediaId)
            : null;
      let streamBadgesIdForCache: string | null = isImdbId(mediaId) ? mediaId : null;
      if (!streamBadgesIdForCache) {
        streamBadgesIdForCache = media?.imdb_id || mappedImdbId || null;
      }
      if (!streamBadgesIdForCache && tmdbIdForCache) {
        streamBadgesIdForCache = `tmdb:${tmdbIdForCache}`;
      }
      if (mediaType === 'tv' && streamBadgesIdForCache) {
        const streamSeason = season || '1';
        const streamEpisode = episode || '1';
        streamBadgesIdForCache = `${streamBadgesIdForCache}:${streamSeason}:${streamEpisode}`;
      }
      const seasonDetailsPromise =
        !useRawKitsuFallback && imageType === 'thumbnail' && mediaType === 'tv' && season && episode
          ? (async () => {
            const seasonCacheKeyBase = `tmdb:tv:${media.id}:season:${season}`;
            const primaryResponse = await fetchJsonCached(
              `${seasonCacheKeyBase}:${requestedImageLang}`,
              `https://api.themoviedb.org/3/tv/${media.id}/season/${season}?api_key=${tmdbKey}&language=${requestedImageLang}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            if (primaryResponse.ok && primaryResponse.data) {
              return primaryResponse.data;
            }
            if (requestedImageLang !== FALLBACK_IMAGE_LANGUAGE) {
              const fallbackResponse = await fetchJsonCached(
                `${seasonCacheKeyBase}:${FALLBACK_IMAGE_LANGUAGE}`,
                `https://api.themoviedb.org/3/tv/${media.id}/season/${season}?api_key=${tmdbKey}&language=${FALLBACK_IMAGE_LANGUAGE}`,
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              );
              if (fallbackResponse.ok && fallbackResponse.data) {
                return fallbackResponse.data;
              }
            }
            return null;
          })()
          : null;
      if (seasonDetailsPromise) {
        const seasonDetails = await seasonDetailsPromise;
        const requestedEpisodeIndex = Number(episode);
        const seasonEpisodes = Array.isArray(seasonDetails?.episodes) ? seasonDetails.episodes : [];
        if (Number.isFinite(requestedEpisodeIndex) && requestedEpisodeIndex > 0) {
          const seasonEpisode = seasonEpisodes[requestedEpisodeIndex - 1];
          const mappedEpisodeNumber =
            typeof seasonEpisode?.episode_number === 'number' || typeof seasonEpisode?.episode_number === 'string'
              ? String(seasonEpisode.episode_number).trim()
              : '';
          if (mappedEpisodeNumber) {
            resolvedTmdbEpisodeNumber = mappedEpisodeNumber;
          }
        }
      }
      const streamBadgesWindowTtlMs = shouldRenderStreamBadges
        ? mediaType && streamBadgesIdForCache
          ? getRatingCacheTtlMs({
            id: streamBadgesIdForCache,
            mediaType: mediaType as 'movie' | 'tv',
            releaseDate: releaseDateForCache,
            defaultTtlMs: STREAM_BADGES_CACHE_TTL_MS,
            oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
          })
          : getDeterministicTtlMs(STREAM_BADGES_CACHE_TTL_MS, cleanId)
        : null;
      const streamBadgesCacheWindow =
        shouldRenderStreamBadges && streamBadgesWindowTtlMs
          ? Math.floor(Date.now() / streamBadgesWindowTtlMs)
          : null;
      const streamBadgesCacheKey = shouldRenderStreamBadges
        ? `streambadges:${streamBadgesCacheWindow ?? 0}`
        : 'off';
      const finalImageCacheKey = [
        FINAL_IMAGE_RENDERER_CACHE_VERSION,
        imageType,
        outputFormat,
        cleanId,
        requestedImageLang,
        imageType === 'poster'
          ? `${posterTextPreference}:${posterAnimeTextPreference}`
          : posterTextPreference,
        imageType === 'poster' ? posterRatingsLayout : '-',
        imageType === 'poster' ? String(posterRatingsMaxPerSide ?? 'auto') : '-',
        imageType === 'poster' ? String(posterLang || '-') : '-',
        imageType === 'poster' ? String(posterAnimeLang || '-') : '-',
        imageType === 'backdrop' ? String(backdropLang || '-') : '-',
        imageType === 'backdrop' ? String(backdropAnimeLang || '-') : '-',
        imageType === 'logo' ? String(logoLang || '-') : '-',
        imageType === 'logo' ? String(logoAnimeLang || '-') : '-',
        imageType === 'poster' ? String(posterAnimeImageTextParam || '-') : '-',
        imageType === 'backdrop' ? String(backdropAnimeImageTextParam || '-') : '-',
        imageType === 'logo' ? String(logoRatingsMax ?? 'auto') : '-',
        imageType === 'logo' ? logoMode : DEFAULT_LOGO_MODE,
        imageType === 'logo' ? logoFontVariant : DEFAULT_LOGO_FONT_VARIANT,
        imageType === 'logo' ? logoPrimary : DEFAULT_LOGO_CUSTOM_PRIMARY,
        imageType === 'logo' ? logoSecondary : DEFAULT_LOGO_CUSTOM_SECONDARY,
        imageType === 'logo' ? logoOutline : DEFAULT_LOGO_CUSTOM_OUTLINE,
        imageType === 'poster' ? qualityBadgesSide : '-',
        imageType === 'poster' && (posterRatingsLayout === 'top' || posterRatingsLayout === 'bottom')
          ? posterQualityBadgesPosition
          : '-',
        imageType !== 'logo' ? qualityBadgesStyle : '-',
        imageType === 'backdrop' ? backdropRatingsLayout : imageType === 'thumbnail' ? thumbnailRatingsLayout : '-',
        imageType === 'backdrop' ? backdropRatingsSize : '-',
        imageType === 'thumbnail' ? thumbnailSize : '-',
        imageType === 'thumbnail' ? aiometadataEpisodeProvider || '-' : '-',
        verticalBadgeContent,
        ratingStyle,
        effectiveRatingPreferences.join(',') || 'none',
        mdblistCacheSeed,
        simklCacheSeed,
        streamBadgesCacheKey,
        'v1',
      ].join('|');
      const finalCacheHash = sha1Hex(finalImageCacheKey);
      const finalObjectStorageKey = buildObjectStorageImageKey(
        imageType,
        finalCacheHash,
        outputFormatToExtension(outputFormat)
      );
      if (shouldCacheFinalImage && objectStorageEnabled) {
        const cachedFinalImage = await getCachedImageFromObjectStorage(finalObjectStorageKey);
        if (cachedFinalImage) {
          objectStorageHit = true;
          return {
            body: cachedFinalImage.body,
            contentType: cachedFinalImage.contentType,
            cacheControl: responseHeadersCacheControl,
          };

        }
      }
      const detailsBundlePromise = !useRawKitsuFallback
        ? (async () => {
          const buildDetailsUrl = (language: string) => {
            const url = new URL(`https://api.themoviedb.org/3/${mediaType}/${media.id}`);
            url.searchParams.set('api_key', tmdbKey);
            url.searchParams.set('language', language);
            url.searchParams.set('append_to_response', 'images,external_ids,translations');
            if (resolvedIncludeImageLanguage) {
              url.searchParams.set('include_image_language', resolvedIncludeImageLanguage);
            }
            return url.toString();
          };
          const [primaryLanguage, ...fallbackLanguages] = requestedImageLanguageFallbacks;
          const primaryResponse = await fetchJsonCached(
            `tmdb:${mediaType}:${media.id}:details:${primaryLanguage}:bundle:${resolvedIncludeImageLanguage}`,
            buildDetailsUrl(primaryLanguage),
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          const fallbackResponses = await Promise.all(
            fallbackLanguages.map((language) =>
              fetchJsonCached(
                `tmdb:${mediaType}:${media.id}:details:${language}:bundle:${resolvedIncludeImageLanguage}`,
                buildDetailsUrl(language),
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              )
            )
          );

          const details = primaryResponse.data || {};
          const fallbackDetails =
            fallbackResponses.find((response) => response.ok && response.data)?.data || {};

          return {
            details,
            fallbackDetails,
            bundledImages: details.images || {},
            bundledExternalIds: details.external_ids || {},
            tmdbRating: details.vote_average ? normalizeRatingValue(details.vote_average) || 'N/A' : 'N/A',
          };
        })()
        : null;
      const episodeDetailsPromise =
        !useRawKitsuFallback && imageType === 'thumbnail' && mediaType === 'tv' && season && episode
          ? (async () => {
            const tmdbEpisodeLookupNumber = resolvedTmdbEpisodeNumber || episode;
            const episodeCacheKeyBase = `tmdb:tv:${media.id}:season:${season}:episode:${tmdbEpisodeLookupNumber}`;
            const primaryResponse = await fetchJsonCached(
              `${episodeCacheKeyBase}:${requestedImageLang}`,
              `https://api.themoviedb.org/3/tv/${media.id}/season/${season}/episode/${tmdbEpisodeLookupNumber}?api_key=${tmdbKey}&language=${requestedImageLang}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            if (primaryResponse.ok && primaryResponse.data) {
              return primaryResponse.data;
            }
            if (requestedImageLang !== FALLBACK_IMAGE_LANGUAGE) {
              const fallbackResponse = await fetchJsonCached(
                `${episodeCacheKeyBase}:${FALLBACK_IMAGE_LANGUAGE}`,
                `https://api.themoviedb.org/3/tv/${media.id}/season/${season}/episode/${tmdbEpisodeLookupNumber}?api_key=${tmdbKey}&language=${FALLBACK_IMAGE_LANGUAGE}`,
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              );
              if (fallbackResponse.ok && fallbackResponse.data) {
                return fallbackResponse.data;
              }
            }
            return null;
          })()
          : null;
      const episodeExternalIdsPromise =
        !useRawKitsuFallback && imageType === 'thumbnail' && mediaType === 'tv' && season && episode
          ? (async () => {
            const tmdbEpisodeLookupNumber = resolvedTmdbEpisodeNumber || episode;
            const response = await fetchJsonCached(
              `tmdb:tv:${media.id}:season:${season}:episode:${tmdbEpisodeLookupNumber}:external_ids`,
              `https://api.themoviedb.org/3/tv/${media.id}/season/${season}/episode/${tmdbEpisodeLookupNumber}/external_ids?api_key=${tmdbKey}`,
              TMDB_CACHE_TTL_MS,
              phases,
              'tmdb'
            );
            return response.ok && response.data ? response.data : null;
          })()
          : null;
      const needsAnilistRating = requestedExternalRatings.has('anilist');
      const needsMalRating = requestedExternalRatings.has('myanimelist');
      const providerRatingsPromise =
        shouldRenderRatings &&
          !useRawKitsuFallback &&
          needsExternalRatings &&
          (mdblistKey ||
            hasMdbListApiKey ||
            needsKitsuRating ||
            needsImdbRating ||
            needsAnimeOnlyRatings)
          ? (async () => {
            let imdbId: string | null = null;
            let episodeImdbId: string | null = null;
            let kitsuId: string | null = isKitsu ? mediaId : null;
            let anilistId: string | null = idPrefix === 'anilist' ? mediaId : null;
            let malId: string | null = idPrefix === 'mal' ? mediaId : null;
            if (kitsuId) {
              hasConfirmedAnimeMapping = true;
              allowAnimeOnlyRatings = hasNativeAnimeInput || mediaLooksAnimated;
            }

            if (episodeExternalIdsPromise) {
              const episodeExternalIds = await episodeExternalIdsPromise;
              if (typeof episodeExternalIds?.imdb_id === 'string' && isImdbId(episodeExternalIds.imdb_id)) {
                episodeImdbId = episodeExternalIds.imdb_id;
              }
            }
            imdbId = episodeImdbId || media?.imdb_id || mappedImdbId;
            if (!imdbId && detailsBundlePromise) {
              const bundle = await detailsBundlePromise;
              if (bundle?.bundledExternalIds?.imdb_id) {
                imdbId = bundle.bundledExternalIds.imdb_id;
              }
            }
            if (!imdbId && mappedImdbId) {
              imdbId = mappedImdbId;
            }
            if (!imdbId && !kitsuId && !needsAnimeOnlyRatings && !anilistId && !malId) {
              return new Map<RatingPreference, string>();
            }

            if (needsAnimeOnlyRatings && shouldAttemptAnimeMapping && !kitsuId) {
              if (inputAnimeMappingProvider && inputAnimeMappingExternalId) {
                kitsuId = await fetchKitsuIdFromReverseMapping({
                  provider: inputAnimeMappingProvider,
                  externalId: inputAnimeMappingExternalId,
                  season,
                  phases,
                });
              }
              if (!kitsuId && imdbId) {
                kitsuId = await fetchKitsuIdFromReverseMapping({
                  provider: 'imdb',
                  externalId: imdbId,
                  season,
                  phases,
                });
              }
              if (!kitsuId && media?.id) {
                kitsuId = await fetchKitsuIdFromReverseMapping({
                  provider: 'tmdb',
                  externalId: String(media.id),
                  season,
                  phases,
                });
              }
            }
            if (kitsuId) {
              hasConfirmedAnimeMapping = true;
              allowAnimeOnlyRatings = hasNativeAnimeInput || mediaLooksAnimated;
            }

            if (needsAnimeOnlyRatings && shouldAttemptAnimeMapping) {
              if (needsAnilistRating && !anilistId) {
                if (inputAnimeMappingProvider && inputAnimeMappingExternalId) {
                  anilistId = await fetchAnilistIdFromReverseMapping({
                    provider: inputAnimeMappingProvider,
                    externalId: inputAnimeMappingExternalId,
                    season,
                    phases,
                  });
                }
                if (!anilistId && imdbId) {
                  anilistId = await fetchAnilistIdFromReverseMapping({
                    provider: 'imdb',
                    externalId: imdbId,
                    season,
                    phases,
                  });
                }
                if (!anilistId && media?.id) {
                  anilistId = await fetchAnilistIdFromReverseMapping({
                    provider: 'tmdb',
                    externalId: String(media.id),
                    season,
                    phases,
                  });
                }
              }
              if (needsMalRating && !malId) {
                if (inputAnimeMappingProvider && inputAnimeMappingExternalId) {
                  malId = await fetchMalIdFromReverseMapping({
                    provider: inputAnimeMappingProvider,
                    externalId: inputAnimeMappingExternalId,
                    season,
                    phases,
                  });
                }
                if (!malId && imdbId) {
                  malId = await fetchMalIdFromReverseMapping({
                    provider: 'imdb',
                    externalId: imdbId,
                    season,
                    phases,
                  });
                }
                if (!malId && media?.id) {
                  malId = await fetchMalIdFromReverseMapping({
                    provider: 'tmdb',
                    externalId: String(media.id),
                    season,
                    phases,
                  });
                }
              }
            }
            if (anilistId || malId) {
              hasConfirmedAnimeMapping = true;
              if (!hasNativeAnimeInput) {
                allowAnimeOnlyRatings = hasConfirmedAnimeMapping && mediaLooksAnimated;
              }
            }

            const combinedRatings = new Map<RatingPreference, string>();
            const shortCircuitLimit =
              imageType === 'poster' ? getPosterRatingLayoutLimit(posterRatingsLayout) : null;

            if (shortCircuitLimit) {
              let mdbRatings: Map<RatingPreference, string> | null = null;
              let mdbListCacheTtlMs: number | null = null;
              let hasFetchedMdb = false;
              let hasFetchedKitsu = false;
              let hasFetchedAnilist = false;
              let hasFetchedMal = false;
              let hasFetchedSimkl = false;

              const ensureImdbId = async () => {
                if (imdbId) return imdbId;
                if (episodeExternalIdsPromise) {
                  const episodeExternalIds = await episodeExternalIdsPromise;
                  if (typeof episodeExternalIds?.imdb_id === 'string' && isImdbId(episodeExternalIds.imdb_id)) {
                    imdbId = episodeExternalIds.imdb_id;
                    return imdbId;
                  }
                }
                imdbId = media?.imdb_id || mappedImdbId || null;
                if (!imdbId && detailsBundlePromise) {
                  const bundle = await detailsBundlePromise;
                  if (bundle?.bundledExternalIds?.imdb_id) {
                    imdbId = bundle.bundledExternalIds.imdb_id;
                  }
                }
                if (!imdbId && mappedImdbId) {
                  imdbId = mappedImdbId;
                }
                return imdbId;
              };

              const ensureAnimeMapping = async () => {
                if (allowAnimeOnlyRatings || !needsAnimeOnlyRatings) return;
                if (!shouldAttemptAnimeMapping) return;
                if (kitsuId) {
                  hasConfirmedAnimeMapping = true;
                  allowAnimeOnlyRatings = hasNativeAnimeInput || mediaLooksAnimated;
                  return;
                }
                if (inputAnimeMappingProvider && inputAnimeMappingExternalId) {
                  kitsuId = await fetchKitsuIdFromReverseMapping({
                    provider: inputAnimeMappingProvider,
                    externalId: inputAnimeMappingExternalId,
                    season,
                    phases,
                  });
                }
                const resolvedImdbId = await ensureImdbId();
                if (!kitsuId && resolvedImdbId) {
                  kitsuId = await fetchKitsuIdFromReverseMapping({
                    provider: 'imdb',
                    externalId: resolvedImdbId,
                    season,
                    phases,
                  });
                }
                if (!kitsuId && media?.id) {
                  kitsuId = await fetchKitsuIdFromReverseMapping({
                    provider: 'tmdb',
                    externalId: String(media.id),
                    season,
                    phases,
                  });
                }
                if (kitsuId) {
                  hasConfirmedAnimeMapping = true;
                  allowAnimeOnlyRatings = hasNativeAnimeInput || mediaLooksAnimated;
                }
              };

              const ensureMdbRatings = async () => {
                if (hasFetchedMdb) return mdbRatings;
                hasFetchedMdb = true;
                const resolvedImdbId = await ensureImdbId();
                if (!resolvedImdbId || !(mdblistKey || hasMdbListApiKey)) return null;
                try {
                  mdbListCacheTtlMs = getMdbListCacheTtlMs({
                    imdbId: resolvedImdbId,
                    mediaType: mediaType as 'movie' | 'tv',
                    releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                  });
                  mdbRatings = await fetchMdbListRatings({
                    imdbId: resolvedImdbId,
                    cacheTtlMs: mdbListCacheTtlMs,
                    phases,
                    requestSource: 'addon',
                    imageType,
                    cleanId,
                    manualApiKey: mdblistKey,
                  });
                  if (mdbRatings) {
                    for (const [provider, value] of mdbRatings.entries()) {
                      combinedRatings.set(provider, value);
                      renderedRatingTtlByProvider.set(provider, mdbListCacheTtlMs);
                    }
                  }
                } catch {
                  // Ignore MDBList failures.
                }
                return mdbRatings;
              };

              const ensureImdbDatasetRating = async () => {
                if (combinedRatings.has('imdb')) return combinedRatings.get('imdb') || null;
                const resolvedImdbId = await ensureImdbId();
                if (!resolvedImdbId) return null;
                const datasetRating = getImdbRatingFromDataset(resolvedImdbId);
                if (datasetRating) {
                  const normalized = normalizeRatingValue(datasetRating.rating);
                  if (normalized) {
                    combinedRatings.set('imdb', normalized);
                    renderedRatingTtlByProvider.set('imdb', IMDB_DATASET_CACHE_TTL_MS);
                  }
                }
                return combinedRatings.get('imdb') || null;
              };

              const ensureKitsuRating = async () => {
                if (hasFetchedKitsu || combinedRatings.has('kitsu')) {
                  return combinedRatings.get('kitsu') || null;
                }
                hasFetchedKitsu = true;
                if (!kitsuId) return null;
                try {
                  const kitsuCacheTtlMs = getRatingCacheTtlMs({
                    id: kitsuId,
                    mediaType: mediaType as 'movie' | 'tv',
                    releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                    defaultTtlMs: KITSU_CACHE_TTL_MS,
                    oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                  });
                  const kitsuRating = await fetchKitsuRating(kitsuId, phases);
                  if (kitsuRating) {
                    combinedRatings.set('kitsu', kitsuRating);
                    renderedRatingTtlByProvider.set('kitsu', kitsuCacheTtlMs);
                  }
                } catch {
                  // Ignore
                }
                return combinedRatings.get('kitsu') || null;
              };

              const ensureAnilistRating = async () => {
                if (hasFetchedAnilist || combinedRatings.has('anilist')) {
                  return combinedRatings.get('anilist') || null;
                }
                hasFetchedAnilist = true;
                if (!anilistId) return null;
                try {
                  const anilistCacheTtlMs = getRatingCacheTtlMs({
                    id: anilistId,
                    mediaType: mediaType as 'movie' | 'tv',
                    releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                    defaultTtlMs: KITSU_CACHE_TTL_MS,
                    oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                  });
                  const anilistRating = await fetchAnilistRating(anilistId, phases);
                  if (anilistRating) {
                    combinedRatings.set('anilist', anilistRating);
                    renderedRatingTtlByProvider.set('anilist', anilistCacheTtlMs);
                  }
                } catch {
                  // Ignore
                }
                return combinedRatings.get('anilist') || null;
              };

              const ensureMalRating = async () => {
                if (hasFetchedMal || combinedRatings.has('myanimelist')) {
                  return combinedRatings.get('myanimelist') || null;
                }
                hasFetchedMal = true;
                if (!malId) return null;
                try {
                  const malCacheTtlMs = getRatingCacheTtlMs({
                    id: malId,
                    mediaType: mediaType as 'movie' | 'tv',
                    releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                    defaultTtlMs: KITSU_CACHE_TTL_MS,
                    oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                  });
                  const malRating = await fetchMyAnimeListRating(malId, phases);
                  if (malRating) {
                    combinedRatings.set('myanimelist', malRating);
                    renderedRatingTtlByProvider.set('myanimelist', malCacheTtlMs);
                  }
                } catch {
                  // Ignore
                }
                return combinedRatings.get('myanimelist') || null;
              };

              const ensureSimklRating = async () => {
                if (hasFetchedSimkl || combinedRatings.has('simkl')) {
                  return combinedRatings.get('simkl') || null;
                }
                hasFetchedSimkl = true;
                if (!simklClientId) return null;
                const resolvedImdbId = await ensureImdbId();
                const tmdbId =
                  media?.id != null
                    ? String(media.id)
                    : isTmdb && mediaId
                      ? String(mediaId)
                      : null;
                try {
                  const simklCacheTtlMs = getRatingCacheTtlMs({
                    id:
                      resolvedImdbId ||
                      tmdbId ||
                      anilistId ||
                      malId ||
                      kitsuId ||
                      cleanId,
                    mediaType: mediaType as 'movie' | 'tv',
                    releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                    defaultTtlMs: SIMKL_CACHE_TTL_MS,
                    oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                  });
                  const simklRating = await fetchSimklRating({
                    clientId: simklClientId,
                    imdbId: resolvedImdbId,
                    tmdbId,
                    mediaType: mediaType as 'movie' | 'tv',
                    anilistId,
                    malId,
                    kitsuId,
                    cacheTtlMs: simklCacheTtlMs,
                    phases,
                  });
                  if (simklRating) {
                    combinedRatings.set('simkl', simklRating);
                    renderedRatingTtlByProvider.set('simkl', simklCacheTtlMs);
                  }
                } catch {
                  // Ignore
                }
                return combinedRatings.get('simkl') || null;
              };

              const resolveProvider = async (provider: RatingPreference) => {
                if (provider === 'tmdb') return tmdbRating;

                if (provider === 'imdb') {
                  const datasetRating = await ensureImdbDatasetRating();
                  if (datasetRating) return datasetRating;
                  await ensureMdbRatings();
                  return combinedRatings.get('imdb') || null;
                }

                if (provider === 'kitsu') {
                  if (combinedRatings.has('kitsu')) return combinedRatings.get('kitsu') || null;
                  if (!needsAnimeOnlyRatings) return null;
                  if (!allowAnimeOnlyRatings) {
                    await ensureAnimeMapping();
                  }
                  if (!allowAnimeOnlyRatings) return null;
                  const kitsuRating = await ensureKitsuRating();
                  if (kitsuRating) return kitsuRating;
                  await ensureMdbRatings();
                  return combinedRatings.get('kitsu') || null;
                }

                if (provider === 'anilist') {
                  if (!needsAnimeOnlyRatings) return null;
                  if (!allowAnimeOnlyRatings) {
                    await ensureAnimeMapping();
                  }
                  if (!allowAnimeOnlyRatings) return null;
                  if (combinedRatings.has('anilist')) return combinedRatings.get('anilist') || null;
                  const anilistRating = await ensureAnilistRating();
                  if (anilistRating) return anilistRating;
                  await ensureMdbRatings();
                  return combinedRatings.get('anilist') || null;
                }

                if (provider === 'myanimelist') {
                  if (!needsAnimeOnlyRatings) return null;
                  if (!allowAnimeOnlyRatings) {
                    await ensureAnimeMapping();
                  }
                  if (!allowAnimeOnlyRatings) return null;
                  if (combinedRatings.has('myanimelist')) return combinedRatings.get('myanimelist') || null;
                  const malRating = await ensureMalRating();
                  if (malRating) return malRating;
                  await ensureMdbRatings();
                  return combinedRatings.get('myanimelist') || null;
                }

                if (provider === 'simkl') {
                  return ensureSimklRating();
                }

                await ensureMdbRatings();
                return combinedRatings.get(provider) || null;
              };

              let renderableCount = 0;
              for (const provider of effectiveRatingPreferences) {
                if (renderableCount >= shortCircuitLimit) break;
                const baseValue = await resolveProvider(provider);
                if (!shouldRenderRatingValue(baseValue)) continue;
                const formattedValue = formatDisplayRatingValue(provider, baseValue as string, imageType);
                if (!shouldRenderRatingValue(formattedValue)) continue;
                renderableCount += 1;
              }

              return combinedRatings;
            }

            if (imdbId && (mdblistKey || hasMdbListApiKey)) {
              try {
                const mdbListCacheTtlMs = getMdbListCacheTtlMs({
                  imdbId,
                  mediaType: mediaType as 'movie' | 'tv',
                  releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                });
                const mdbRatings = await fetchMdbListRatings({
                  imdbId,
                  cacheTtlMs: mdbListCacheTtlMs,
                  phases,
                  requestSource: 'addon',
                  imageType,
                  cleanId,
                  manualApiKey: mdblistKey
                });
                if (mdbRatings) {
                  for (const [provider, value] of mdbRatings.entries()) {
                    if (!allowAnimeOnlyRatings && ANIME_ONLY_RATING_PROVIDER_SET.has(provider)) {
                      continue;
                    }
                    combinedRatings.set(provider, value);
                    renderedRatingTtlByProvider.set(provider, mdbListCacheTtlMs);
                  }
                }
              } catch {
                // Ignore
              }
            }

            // IMDb HTML scraping removed: only dataset or MDBList can supply IMDb ratings.
            if (needsImdbRating && imdbId && !combinedRatings.has('imdb')) {
              const datasetRating = getImdbRatingFromDataset(imdbId);
              if (datasetRating) {
                const normalized = normalizeRatingValue(datasetRating.rating);
                if (normalized) {
                  combinedRatings.set('imdb', normalized);
                  renderedRatingTtlByProvider.set('imdb', IMDB_DATASET_CACHE_TTL_MS);
                }
              }
            }

            if (needsKitsuRating && allowAnimeOnlyRatings && kitsuId && !combinedRatings.has('kitsu')) {
              try {
                const kitsuCacheTtlMs = getRatingCacheTtlMs({
                  id: kitsuId,
                  mediaType: mediaType as 'movie' | 'tv',
                  releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                  defaultTtlMs: KITSU_CACHE_TTL_MS,
                  oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                });
                const kitsuRating = await fetchKitsuRating(kitsuId, phases);
                if (kitsuRating) {
                  combinedRatings.set('kitsu', kitsuRating);
                  renderedRatingTtlByProvider.set('kitsu', kitsuCacheTtlMs);
                }
              } catch {
                // Ignore
              }
            }

            if (needsAnilistRating && allowAnimeOnlyRatings && anilistId && !combinedRatings.has('anilist')) {
              try {
                const anilistCacheTtlMs = getRatingCacheTtlMs({
                  id: anilistId,
                  mediaType: mediaType as 'movie' | 'tv',
                  releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                  defaultTtlMs: KITSU_CACHE_TTL_MS,
                  oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                });
                const anilistRating = await fetchAnilistRating(anilistId, phases);
                if (anilistRating) {
                  combinedRatings.set('anilist', anilistRating);
                  renderedRatingTtlByProvider.set('anilist', anilistCacheTtlMs);
                }
              } catch {
                // Ignore
              }
            }

            if (needsMalRating && allowAnimeOnlyRatings && malId && !combinedRatings.has('myanimelist')) {
              try {
                const malCacheTtlMs = getRatingCacheTtlMs({
                  id: malId,
                  mediaType: mediaType as 'movie' | 'tv',
                  releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                  defaultTtlMs: KITSU_CACHE_TTL_MS,
                  oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                });
                const malRating = await fetchMyAnimeListRating(malId, phases);
                if (malRating) {
                  combinedRatings.set('myanimelist', malRating);
                  renderedRatingTtlByProvider.set('myanimelist', malCacheTtlMs);
                }
              } catch {
                // Ignore
              }
            }

            if (requestedExternalRatings.has('simkl') && !combinedRatings.has('simkl') && simklClientId) {
              try {
                const tmdbId =
                  media?.id != null
                    ? String(media.id)
                    : isTmdb && mediaId
                      ? String(mediaId)
                      : null;
                const simklCacheTtlMs = getRatingCacheTtlMs({
                  id: imdbId || tmdbId || anilistId || malId || kitsuId || cleanId,
                  mediaType: mediaType as 'movie' | 'tv',
                  releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
                  defaultTtlMs: SIMKL_CACHE_TTL_MS,
                  oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
                });
                const simklRating = await fetchSimklRating({
                  clientId: simklClientId,
                  imdbId,
                  tmdbId,
                  mediaType: mediaType as 'movie' | 'tv',
                  anilistId,
                  malId,
                  kitsuId,
                  cacheTtlMs: simklCacheTtlMs,
                  phases,
                });
                if (simklRating) {
                  combinedRatings.set('simkl', simklRating);
                  renderedRatingTtlByProvider.set('simkl', simklCacheTtlMs);
                }
              } catch {
                // Ignore
              }
            }

            return combinedRatings;
          })()
          : null;
      const streamBadgesPromise =
        shouldRenderStreamBadges && !useRawKitsuFallback && (mediaType === 'movie' || mediaType === 'tv')
          ? (async () => {
            let imdbId: string | null = isImdbId(mediaId) ? mediaId : null;
            if (!imdbId) {
              imdbId = media?.imdb_id || mappedImdbId || null;
              if (!imdbId && detailsBundlePromise) {
                const bundle = await detailsBundlePromise;
                if (bundle?.bundledExternalIds?.imdb_id) {
                  imdbId = bundle.bundledExternalIds.imdb_id;
                }
              }
              if (!imdbId && mappedImdbId) {
                imdbId = mappedImdbId;
              }
            }

            const tmdbId =
              media?.id != null
                ? String(media.id)
                : isTmdb && mediaId
                  ? String(mediaId)
                  : null;
            let streamBadgesId = imdbId || (tmdbId ? `tmdb:${tmdbId}` : null);
            if (!streamBadgesId) {
              return { badges: [], cacheTtlMs: STREAM_BADGES_CACHE_TTL_MS };
            }
            if (mediaType === 'tv') {
              const streamSeason = season || '1';
              const streamEpisode = episode || '1';
              streamBadgesId = `${streamBadgesId}:${streamSeason}:${streamEpisode}`;
            }
            const torrentioType = mediaType === 'movie' ? 'movie' : 'series';
            const torrentioCacheTtlMs = getRatingCacheTtlMs({
              id: streamBadgesId,
              mediaType: mediaType as 'movie' | 'tv',
              releaseDate: mediaType === 'movie' ? media?.release_date : media?.first_air_date,
              defaultTtlMs: STREAM_BADGES_CACHE_TTL_MS,
              oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
            });
            return fetchStreamBadges({ type: torrentioType, id: streamBadgesId, phases, cacheTtlMs: torrentioCacheTtlMs });
          })()
          : null;

      if (type === 'poster') {
        outputWidth = 500;
        outputHeight = 750;
      } else if (type === 'logo') {
        outputHeight = LOGO_BASE_HEIGHT;
        outputWidth = getLogoCanvasWidth(rawFallbackLogoAspectRatio);
      }

      let localizedMediaDetails: any = null;
      let fallbackMediaDetails: any = null;
      if (!useRawKitsuFallback && detailsBundlePromise) {
        const { details, fallbackDetails, bundledImages, tmdbRating: bundledRating } = await detailsBundlePromise;
        localizedMediaDetails = details;
        fallbackMediaDetails = fallbackDetails;
        tmdbRating = bundledRating;
        if (episodeDetailsPromise) {
          const episodeDetails = await episodeDetailsPromise;
          const normalizedEpisodeRating = normalizeRatingValue(episodeDetails?.vote_average);
          if (normalizedEpisodeRating) {
            tmdbRating = normalizedEpisodeRating;
          }
        }

        const selectImagePath = async (input: {
          posters: any[];
          backdrops: any[];
          logos: any[];
          seasonIncludeImageLanguage?: string;
        }) => {
          let posterCollection = input.posters || [];
          const backdropCollection = input.backdrops || [];
          const logoCollection = input.logos || [];
          const mediaOriginalLanguage =
            typeof media?.original_language === 'string' && media.original_language.trim().length > 0
              ? media.original_language.trim()
              : null;
          const resolvedPosterRequestedImageLang =
            isEffectiveOriginalPosterLang && mediaOriginalLanguage
              ? normalizeTmdbLanguageCode(mediaOriginalLanguage) || effectivePosterRequestedImageLang
              : effectivePosterRequestedImageLang;
          const resolvedBackdropRequestedImageLang =
            isEffectiveOriginalBackdropLang && mediaOriginalLanguage
              ? normalizeTmdbLanguageCode(mediaOriginalLanguage) || effectiveBackdropRequestedImageLang
              : effectiveBackdropRequestedImageLang;
          const preferredPosterPath = isEffectiveOriginalPosterLang
            ? null
            : media?.poster_path || details?.poster_path || null;
          const preferredLogoLanguage =
            shouldUsePosterOriginalLanguageForLogo && mediaOriginalLanguage
              ? mediaOriginalLanguage
              : imageType === 'poster'
                ? resolvedPosterRequestedImageLang
                : imageType === 'logo' && isEffectiveOriginalLogoLang && mediaOriginalLanguage
                  ? mediaOriginalLanguage
                  : imageType === 'logo'
                    ? effectiveLogoRequestedImageLang
                : requestedImageLang;
          const preferredBackdropPath = details?.backdrop_path || media?.backdrop_path || null;
          const selectedLogo = pickByLanguageWithFallback(
            logoCollection,
            preferredLogoLanguage,
            FALLBACK_IMAGE_LANGUAGE
          );
          const logoPath = selectedLogo?.file_path || null;
          const logoLanguageMatch =
            imageType === 'poster'
              ? matchesImageLanguage(selectedLogo, preferredLogoLanguage)
              : false;

          const localizedPosterPath = isEffectiveOriginalPosterLang
            ? null
            : (
                pickByLanguageWithFallback(
                  posterCollection,
                  resolvedPosterRequestedImageLang,
                  effectivePosterFallbackImageLang
                )?.file_path || preferredPosterPath
              );
          let originalPosterPath =
            (isEffectiveOriginalPosterLang
              ? pickByLanguageWithFallback(
                  posterCollection,
                  mediaOriginalLanguage,
                  ''
                )?.file_path ||
                posterCollection.find((poster: any) => !poster?.iso_639_1)?.file_path
              : media?.poster_path) ||
            localizedPosterPath ||
            posterCollection[0]?.file_path;
          const localizedBackdropPath =
            pickByLanguageWithFallback(
              backdropCollection,
              resolvedBackdropRequestedImageLang,
              FALLBACK_IMAGE_LANGUAGE,
              preferredBackdropPath
            )?.file_path || preferredBackdropPath;
          const originalBackdropPath =
            (isEffectiveOriginalBackdropLang
              ? pickByLanguageWithFallback(
                  backdropCollection,
                  mediaOriginalLanguage,
                  ''
                )?.file_path
              : localizedBackdropPath) ||
            preferredBackdropPath ||
            backdropCollection[0]?.file_path;

          // Kitsu IDs usually represent a specific anime season: prefer season posters over unified show posters.
          if (isKitsu && season && !episode && type === 'poster') {
            const seasonImagesQuery = input.seasonIncludeImageLanguage
              ? `&include_image_language=${input.seasonIncludeImageLanguage}`
              : '';
            const seasonImagesCacheKey = input.seasonIncludeImageLanguage
              ? `tmdb:season_images:${media.id}:${season}:${input.seasonIncludeImageLanguage}`
              : `tmdb:season_images:${media.id}:${season}:all`;

            const [seasonDetailsResponse, seasonImagesResponse] = await Promise.all([
              fetchJsonCached(
                `tmdb:season_details:${media.id}:${season}:${resolvedPosterRequestedImageLang}`,
                `https://api.themoviedb.org/3/tv/${media.id}/season/${season}?api_key=${tmdbKey}&language=${resolvedPosterRequestedImageLang}`,
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              ),
              fetchJsonCached(
                seasonImagesCacheKey,
                `https://api.themoviedb.org/3/tv/${media.id}/season/${season}/images?api_key=${tmdbKey}${seasonImagesQuery}`,
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              )
            ]);

            let seasonPosterPath = null;
            if (seasonDetailsResponse.ok) {
              const seasonDetails = seasonDetailsResponse.data;
              if (seasonDetails?.poster_path) {
                seasonPosterPath = seasonDetails.poster_path;
              }
            }

            if (!seasonPosterPath && resolvedPosterRequestedImageLang !== FALLBACK_IMAGE_LANGUAGE) {
              const seasonFallbackDetailsResponse = await fetchJsonCached(
                `tmdb:season_details:${media.id}:${season}:${FALLBACK_IMAGE_LANGUAGE}`,
                `https://api.themoviedb.org/3/tv/${media.id}/season/${season}?api_key=${tmdbKey}&language=${FALLBACK_IMAGE_LANGUAGE}`,
                TMDB_CACHE_TTL_MS,
                phases,
                'tmdb'
              );
              if (seasonFallbackDetailsResponse.ok) {
                const seasonFallbackDetails = seasonFallbackDetailsResponse.data;
                if (seasonFallbackDetails?.poster_path) {
                  seasonPosterPath = seasonFallbackDetails.poster_path;
                }
              }
            }

            if (seasonImagesResponse.ok) {
              const seasonImages = seasonImagesResponse.data;
              if (Array.isArray(seasonImages?.posters) && seasonImages.posters.length > 0) {
                posterCollection = seasonImages.posters;
              }
            }

            originalPosterPath =
              (isEffectiveOriginalPosterLang
                ? pickByLanguageWithFallback(
                    posterCollection,
                    mediaOriginalLanguage,
                    ''
                  )?.file_path || seasonPosterPath
                : seasonPosterPath ||
                  pickByLanguageWithFallback(
                    posterCollection,
                    resolvedPosterRequestedImageLang,
                    effectivePosterFallbackImageLang
                  )?.file_path) ||
              originalPosterPath;
          }

          if (type === 'poster') {
            const selectedPoster = pickPosterByPreference(
              posterCollection,
              effectivePosterTextPreference,
              resolvedPosterRequestedImageLang,
              effectivePosterFallbackImageLang,
              originalPosterPath
            );
            const selectedPosterIsTextless = isTextlessPosterSelection(posterCollection, selectedPoster);
            return {
              imgPath: selectedPoster?.file_path || '',
              logoAspectRatio: null,
              logoPath,
              logoLanguageMatch,
              posterIsTextless: selectedPosterIsTextless,
            };
          }

          if (type === 'backdrop') {
            const selectedBackdrop = pickBackdropByPreference(
              backdropCollection,
              effectiveBackdropTextPreference,
              resolvedBackdropRequestedImageLang,
              FALLBACK_IMAGE_LANGUAGE,
              originalBackdropPath
            );
            usedThumbnailBackdropFallback = Boolean(selectedBackdrop?.file_path);
            return {
              imgPath: selectedBackdrop?.file_path || '',
              logoAspectRatio: null,
              logoPath,
              logoLanguageMatch,
              posterIsTextless: false,
            };
          }

          if (type === 'thumbnail') {
            let stillPath: string | null = null;
            if (episodeDetailsPromise) {
              const episodeDetails = await episodeDetailsPromise;
              stillPath = typeof episodeDetails?.still_path === 'string' ? episodeDetails.still_path : null;
              thumbnailFallbackEpisodeText =
                typeof episodeDetails?.name === 'string' && episodeDetails.name.trim().length > 0
                  ? episodeDetails.name.trim()
                  : null;
              thumbnailFallbackEpisodeCode =
                season && episode
                  ? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
                  : null;
              const normalizedEpisodeRating = normalizeRatingValue(episodeDetails?.vote_average);
              if (normalizedEpisodeRating) {
                episodeTmdbRating = normalizedEpisodeRating;
              }
            }

            if (stillPath) {
              return {
                imgPath: stillPath,
                logoAspectRatio: null,
                logoPath,
                logoLanguageMatch,
                posterIsTextless: false,
              };
            }

            const selectedBackdrop = pickBackdropByPreference(
              backdropCollection,
              effectiveBackdropTextPreference,
              resolvedBackdropRequestedImageLang,
              FALLBACK_IMAGE_LANGUAGE,
              originalBackdropPath
            );
            return {
              imgPath: selectedBackdrop?.file_path || '',
              logoAspectRatio: null,
              logoPath,
              logoLanguageMatch,
              posterIsTextless: false,
            };
          }

          const logoAspectRatio =
            typeof selectedLogo?.aspect_ratio === 'number' && selectedLogo.aspect_ratio > 0
              ? selectedLogo.aspect_ratio
              : null;
          return {
            imgPath: logoPath || '',
            logoAspectRatio,
            logoPath,
            logoLanguageMatch,
            posterIsTextless: false,
          };
        };

        const initialImages = bundledImages || {};
        const initialSelection = await selectImagePath({
          posters: initialImages.posters || [],
          backdrops: initialImages.backdrops || [],
          logos: initialImages.logos || [],
          seasonIncludeImageLanguage: includeImageLanguage || undefined
        });

        imgPath = initialSelection.imgPath;
        if (imageType === 'thumbnail' && episodeTmdbRating) {
          tmdbRating = episodeTmdbRating;
        }
        selectedLogoAspectRatio = initialSelection.logoAspectRatio;
        selectedPosterLogoPath = initialSelection.logoPath || null;
        selectedPosterIsTextless = initialSelection.posterIsTextless;
        const selectedPosterLogoLanguageMatch = Boolean(initialSelection.logoLanguageMatch);
        if (
          imageType === 'poster' &&
          effectivePosterTextPreference === 'clean' &&
          selectedPosterIsTextless &&
          (!selectedPosterLogoPath || !selectedPosterLogoLanguageMatch)
        ) {
          const logoFallbackImagesUrl = new URL(`https://api.themoviedb.org/3/${mediaType}/${media.id}/images`);
          logoFallbackImagesUrl.searchParams.set('api_key', tmdbKey);
          logoFallbackImagesUrl.searchParams.set('include_image_language', resolvedIncludeImageLanguage);
          const logoFallbackImagesResponse = await fetchJsonCached(
            `tmdb:${mediaType}:${media.id}:images:${resolvedIncludeImageLanguage || 'all'}`,
            logoFallbackImagesUrl.toString(),
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          if (logoFallbackImagesResponse.ok) {
            const logoFallbackImages = logoFallbackImagesResponse.data || {};
            const posterLogoOriginalLanguage =
              typeof media?.original_language === 'string' && media.original_language.trim().length > 0
                ? media.original_language.trim()
                : null;
            const resolvedPosterLogoLanguage =
              isEffectiveOriginalPosterLang && posterLogoOriginalLanguage
                ? normalizeTmdbLanguageCode(posterLogoOriginalLanguage) || effectivePosterRequestedImageLang
                : effectivePosterRequestedImageLang;
            const logoFallback = pickByLanguageWithFallback(
              logoFallbackImages.logos || [],
              shouldUsePosterOriginalLanguageForLogo && posterLogoOriginalLanguage
                ? posterLogoOriginalLanguage
                : resolvedPosterLogoLanguage,
              FALLBACK_IMAGE_LANGUAGE
            );
            if (logoFallback?.file_path) {
              selectedPosterLogoPath = logoFallback.file_path;
            }
          }
        }
        if (selectedLogoAspectRatio) {
          outputWidth = getLogoCanvasWidth(selectedLogoAspectRatio);
        }

        // If the filtered languages returned nothing, retry with all languages and pick the first available.
        if (!imgPath && !imgUrl) {
          const fallbackImagesUrl = new URL(`https://api.themoviedb.org/3/${mediaType}/${media.id}/images`);
          fallbackImagesUrl.searchParams.set('api_key', tmdbKey);
          fallbackImagesUrl.searchParams.set('include_image_language', resolvedIncludeImageLanguage);
          const fallbackImagesResponse = await fetchJsonCached(
            `tmdb:${mediaType}:${media.id}:images:${resolvedIncludeImageLanguage || 'all'}`,
            fallbackImagesUrl.toString(),
            TMDB_CACHE_TTL_MS,
            phases,
            'tmdb'
          );
          if (fallbackImagesResponse.ok) {
            const fallbackImages = fallbackImagesResponse.data || {};
            const fallbackSelection = await selectImagePath({
              posters: fallbackImages.posters || [],
              backdrops: fallbackImages.backdrops || [],
              logos: fallbackImages.logos || [],
              seasonIncludeImageLanguage: undefined
            });
            if (fallbackSelection.imgPath) {
              imgPath = fallbackSelection.imgPath;
              selectedLogoAspectRatio = fallbackSelection.logoAspectRatio;
              selectedPosterLogoPath = fallbackSelection.logoPath || selectedPosterLogoPath;
              selectedPosterIsTextless = fallbackSelection.posterIsTextless;
              if (selectedLogoAspectRatio) {
                outputWidth = getLogoCanvasWidth(selectedLogoAspectRatio);
              }
            }
          }
        }
      }

      if (imageType === 'logo') {
        const generatedLogoTitle = pickPosterTitleFromMedia(
          localizedMediaDetails || media,
          mediaType,
          rawFallbackTitle,
          requestedImageLang,
          FALLBACK_IMAGE_LANGUAGE,
          fallbackMediaDetails
        );
        if (logoMode === 'ratings-only') {
          imgUrl = buildTransparentLogoDataUrl();
          outputWidth = 1100;
          outputHeight = 1;
        } else if (logoMode === 'custom-logo' && generatedLogoTitle) {
          const generatedLogo = await buildGeneratedLogoVariantDataUrl(
            generatedLogoTitle,
            logoFontVariant,
            logoPrimary,
            logoSecondary,
            logoOutline
          );
          imgUrl = generatedLogo.dataUrl;
          outputHeight = LOGO_BASE_HEIGHT;
          outputWidth = Math.max(760, Math.round(outputHeight * generatedLogo.aspectRatio));
        }
      }

      if (!imgUrl && !imgPath) {
        if (imageType === 'logo') {
          let fallbackImdbId = mappedImdbId || (media as any)?.imdb_id || null;
          if (!fallbackImdbId && detailsBundlePromise) {
            const bundle = await detailsBundlePromise;
            fallbackImdbId = bundle?.bundledExternalIds?.imdb_id || null;
          }
          if (fallbackImdbId && isImdbId(fallbackImdbId)) {
            imgUrl = `https://live.metahub.space/logo/large/${fallbackImdbId}/img`;
          }
        }
        if (!imgUrl) {
          throw new HttpError('Image not found', 404);
        }
      }
      if (!imgUrl) {
        imgUrl = buildTmdbImageUrl(imageType, imgPath, outputWidth);
      }
      const shouldApplyPosterCleanOverlay =
        imageType === 'poster' && effectivePosterTextPreference === 'clean' && selectedPosterIsTextless;
      const posterTitleText = shouldApplyPosterCleanOverlay
        ? pickPosterTitleFromMedia(
          localizedMediaDetails || media,
          mediaType,
          rawFallbackTitle,
          isEffectiveOriginalPosterLang &&
            typeof media?.original_language === 'string' &&
            media.original_language.trim().length > 0
            ? normalizeTmdbLanguageCode(media.original_language.trim()) || effectivePosterRequestedImageLang
            : effectivePosterRequestedImageLang,
          FALLBACK_IMAGE_LANGUAGE,
          fallbackMediaDetails
        )
        : null;
      let posterLogoUrl =
        shouldApplyPosterCleanOverlay && selectedPosterLogoPath
          ? buildTmdbImageUrl('logo', selectedPosterLogoPath, outputWidth)
          : null;

      if (shouldApplyPosterCleanOverlay && !posterLogoUrl) {
        let fallbackImdbId = mappedImdbId || (media as any)?.imdb_id || null;
        if (!fallbackImdbId && detailsBundlePromise) {
          const bundle = await detailsBundlePromise;
          fallbackImdbId = bundle?.bundledExternalIds?.imdb_id || null;
        }
        if (fallbackImdbId && isImdbId(fallbackImdbId)) {
          posterLogoUrl = `https://live.metahub.space/logo/large/${fallbackImdbId}/img`;
        }
      }
      const shouldRenderThumbnailFallbackOverlay =
        imageType === 'thumbnail' &&
        usedThumbnailBackdropFallback &&
        Boolean(thumbnailFallbackEpisodeCode || thumbnailFallbackEpisodeText);
      const isGeneratedLogo = imageType === 'logo' && String(imgUrl || '').startsWith('data:image/svg+xml');

      if (
        !shouldRenderBadges &&
        !posterTitleText &&
        !posterLogoUrl &&
        !shouldRenderThumbnailFallbackOverlay &&
        !isGeneratedLogo
      ) {
        const payload = await getSourceImagePayload(imgUrl);
        if (shouldCacheFinalImage) {
          try {
            await putCachedImageToObjectStorage(finalObjectStorageKey, payload);
          } catch {
            // Ignore cache persistence failures
          }
        }
        return {
          body: payload.body,
          contentType: payload.contentType,
          cacheControl: responseHeadersCacheControl,
        };
      }
      if (providerRatingsPromise) {
        providerRatings = await providerRatingsPromise;
      }
      let streamBadges: RatingBadge[] = [];
      let streamBadgesCacheTtlMs: number | null = null;
      if (streamBadgesPromise) {
        const streamBadgeResult = await streamBadgesPromise;
        streamBadges = streamBadgeResult.badges;
        streamBadgesCacheTtlMs = streamBadgeResult.cacheTtlMs;
      }
      if (shouldRenderRawKitsuFallbackRating) {
        providerRatings.set('kitsu', rawFallbackKitsuRating as string);
        renderedRatingTtlByProvider.set('kitsu', KITSU_CACHE_TTL_MS);
      }
      const ratingBadges: RatingBadge[] = [];
      const renderableRatingPreferences = useRawKitsuFallback
        ? (shouldRenderRawKitsuFallbackRating ? (['kitsu'] as RatingPreference[]) : [])
        : effectiveRatingPreferences.filter(
          (provider) => allowAnimeOnlyRatings || !ANIME_ONLY_RATING_PROVIDER_SET.has(provider)
        );
      for (const provider of renderableRatingPreferences) {
        const meta = RATING_PROVIDER_META.get(provider);
        if (!meta) continue;

        const baseValue = provider === 'tmdb' ? tmdbRating : providerRatings.get(provider) || null;
        if (!shouldRenderRatingValue(baseValue)) continue;
        const value = formatDisplayRatingValue(provider, baseValue as string, imageType);
        if (!shouldRenderRatingValue(value)) continue;

        const iconUrl = meta.iconUrl;
        ratingBadges.push({
          key: provider,
          label: meta.label,
          value,
          iconUrl,
          accentColor: meta.accentColor,
          iconCornerRadius: 'iconCornerRadius' in meta ? meta.iconCornerRadius : undefined,
          iconScale: 'iconScale' in meta ? meta.iconScale : undefined,
        });
      }
      if (
        ratingBadges.length === 0 &&
        streamBadges.length === 0 &&
        !posterTitleText &&
        !posterLogoUrl &&
        !shouldRenderThumbnailFallbackOverlay &&
        !isGeneratedLogo
      ) {
        const payload = await getSourceImagePayload(imgUrl);
        if (shouldCacheFinalImage) {
          try {
            await putCachedImageToObjectStorage(finalObjectStorageKey, payload);
          } catch {
            // Ignore cache persistence failures
          }
        }
        return {
          body: payload.body,
          contentType: payload.contentType,
          cacheControl: responseHeadersCacheControl,
        };
      }
      const usePosterBadgeLayout = type === 'poster';
      const useBackdropBadgeLayout = type === 'backdrop' || type === 'thumbnail';
      const useLogoBadgeLayout = type === 'logo';
      const logoBadgeScale = 1;
      const usePosterRowLayout =
        usePosterBadgeLayout &&
        (posterRatingsLayout === 'top' ||
          posterRatingsLayout === 'bottom' ||
          posterRatingsLayout === 'top-bottom');
      const usePosterRowLayoutLarge = usePosterBadgeLayout && usePosterRowLayout;
      const backdropLikeImageType: 'backdrop' | 'thumbnail' =
        imageType === 'thumbnail' ? 'thumbnail' : 'backdrop';
      const activeBackdropLikeLayout = imageType === 'thumbnail' ? thumbnailRatingsLayout : backdropRatingsLayout;
      const useBackdropVerticalLayout =
        useBackdropBadgeLayout &&
        (imageType === 'thumbnail'
          ? isVerticalThumbnailRatingLayout(activeBackdropLikeLayout as ThumbnailRatingLayout)
          : activeBackdropLikeLayout === 'right-vertical');
      const posterRatingLimit = usePosterBadgeLayout
        ? getPosterRatingLayoutMaxBadges(posterRatingsLayout, posterRatingsMaxPerSide)
        : null;
      const logoRatingLimit = useLogoBadgeLayout ? logoRatingsMax : null;
      let cappedRatingBadges = usePosterBadgeLayout
        ? (typeof posterRatingLimit === 'number' ? ratingBadges.slice(0, posterRatingLimit) : [...ratingBadges])
        : useBackdropBadgeLayout
          ? [...ratingBadges]
          : useLogoBadgeLayout
            ? (typeof logoRatingLimit === 'number' ? ratingBadges.slice(0, logoRatingLimit) : [...ratingBadges])
            : [...ratingBadges];
      const backdropRows =
        useBackdropBadgeLayout && !useBackdropVerticalLayout ? chunkBy(cappedRatingBadges, 3) : [];
      let backdropColumns: RatingBadge[][] | undefined = undefined;
      let posterBadgeGroups = splitPosterBadgesByLayout(
        cappedRatingBadges,
        posterRatingsLayout,
        posterRatingsMaxPerSide === null ? undefined : posterRatingsMaxPerSide
      );
      let topRatingBadges = usePosterBadgeLayout
        ? posterBadgeGroups.topBadges
        : useBackdropVerticalLayout
          ? []
          : (backdropRows[0] || []);
      let bottomRatingBadges = usePosterBadgeLayout
        ? posterBadgeGroups.bottomBadges
        : useBackdropVerticalLayout
          ? []
          : (backdropRows[1] || []);
      let leftRatingBadges = usePosterBadgeLayout ? posterBadgeGroups.leftBadges : [];
      let rightRatingBadges = usePosterBadgeLayout
        ? posterBadgeGroups.rightBadges
        : useBackdropVerticalLayout
          ? [...cappedRatingBadges]
          : [];

      let badgeIconSize = 34;
      let badgeFontSize = 28;
      let badgePaddingY = 8;
      let badgePaddingX = 14;
      let badgeGap = 10;
      let badgeTopOffset = 16;
      let badgeBottomOffset = 16;
      let posterMinMetrics: BadgeLayoutMetrics = DEFAULT_BADGE_MIN_METRICS;
      let backdropMinMetrics: BadgeLayoutMetrics = DEFAULT_BADGE_MIN_METRICS;
      let posterRowHorizontalInset = 12;
      let posterReferenceBadgeHeight: number | undefined = undefined;
      let posterReferenceVerticalBadgeHeight: number | undefined = undefined;
      let posterReferenceBadgeGap: number | undefined = undefined;

      if (useBackdropBadgeLayout) {
        badgeIconSize = 32;
        badgeFontSize = 24;
        badgePaddingY = 8;
        badgePaddingX = 12;
        badgeGap = 8;
        badgeTopOffset = 20;
        badgeBottomOffset = 20;
        backdropMinMetrics = {
          iconSize: 22,
          fontSize: 16,
          paddingX: 8,
          paddingY: 5,
          gap: 5,
        };
        if (imageType === 'thumbnail') {
          if (thumbnailSize === 'small') {
            badgeIconSize = 46;
            badgeFontSize = 34;
            badgePaddingY = 10;
            badgePaddingX = 16;
            badgeGap = 10;
            backdropMinMetrics = {
              iconSize: 27,
              fontSize: 19,
              paddingX: 10,
              paddingY: 5,
              gap: 5,
            };
          } else if (thumbnailSize === 'large') {
            badgeIconSize = 64;
            badgeFontSize = 46;
            badgePaddingY = 14;
            badgePaddingX = 22;
            badgeGap = 14;
            backdropMinMetrics = {
              iconSize: 34,
              fontSize: 24,
              paddingX: 12,
              paddingY: 7,
              gap: 7,
            };
          } else {
            badgeIconSize = 54;
            badgeFontSize = 39;
            badgePaddingY = 12;
            badgePaddingX = 19;
            badgeGap = 12;
            backdropMinMetrics = {
              iconSize: 30,
              fontSize: 22,
              paddingX: 11,
              paddingY: 6,
              gap: 6,
            };
          }
        } else if (backdropRatingsSize === 'large') {
          badgeIconSize = 44;
          badgeFontSize = 32;
          badgePaddingY = 10;
          badgePaddingX = 16;
          badgeGap = 10;
          backdropMinMetrics = {
            iconSize: 25,
            fontSize: 18,
            paddingX: 9,
            paddingY: 6,
            gap: 6,
          };
        }
      } else if (usePosterBadgeLayout) {
        if (usePosterRowLayoutLarge) {
          badgeIconSize = 46;
          badgeFontSize = 35;
          badgePaddingY = 8;
          badgePaddingX = 13;
          badgeGap = 9;
        } else {
          badgeIconSize = 42;
          badgeFontSize = 32;
          badgePaddingY = 7;
          badgePaddingX = 11;
          badgeGap = 8;
        }
        posterRowHorizontalInset = usePosterRowLayout ? 12 : 12;
        posterMinMetrics = {
          iconSize: 24,
          fontSize: 18,
          paddingX: 8,
          paddingY: 6,
          gap: 6,
        };
        badgeTopOffset = 24;
        badgeBottomOffset = 24;
        posterReferenceBadgeHeight = estimateBadgeHeight(
          badgeFontSize,
          badgePaddingX,
          badgePaddingY,
          badgeIconSize,
          'standard'
        );
        posterReferenceVerticalBadgeHeight = estimateBadgeHeight(
          badgeFontSize,
          badgePaddingX,
          badgePaddingY,
          badgeIconSize,
          verticalBadgeContent
        );
        posterReferenceBadgeGap = badgeGap;
        if ((posterRatingsLayout === 'left' || posterRatingsLayout === 'right' || posterRatingsLayout === 'left-right') && verticalBadgeContent === 'stacked') {
          badgeGap = Math.max(badgeGap, 12);
        }
      } else if (useLogoBadgeLayout) {
        badgeIconSize = 84;
        badgeFontSize = 62;
        badgePaddingY = 8;
        badgePaddingX = 32;
        badgeGap = 20;
      }

      if (usePosterBadgeLayout && cappedRatingBadges.length > 0) {
        let fittedPosterMetrics: BadgeLayoutMetrics;
        if (posterRatingsLayout === 'left' || posterRatingsLayout === 'right' || posterRatingsLayout === 'left-right') {
          const isSingleSideVerticalPoster =
            posterRatingsLayout === 'left' || posterRatingsLayout === 'right';
          const useThreeBadgeTopRow =
            posterRatingsLayout === 'left-right' &&
            topRatingBadges.length === 1 &&
            leftRatingBadges.length > 0 &&
            rightRatingBadges.length > 0;
          const fittedLeftColumn = useThreeBadgeTopRow ? leftRatingBadges.slice(1) : leftRatingBadges;
          const fittedRightColumn = useThreeBadgeTopRow ? rightRatingBadges.slice(1) : rightRatingBadges;
          const posterColumns = [fittedLeftColumn, fittedRightColumn].filter((column) => column.length > 0);
          const widthRows = posterColumns.flatMap((column) => column.map((badge) => [badge]));
          const alignPosterQualityBadges =
            (posterRatingsLayout === 'left' || posterRatingsLayout === 'right') && streamBadges.length > 0;
          const reservedTopRows =
            posterRatingsLayout === 'left-right' && topRatingBadges.length > 0 ? 1 : 0;
          const baseBadgeHeight = estimateBadgeHeight(
            badgeFontSize,
            badgePaddingX,
            badgePaddingY,
            badgeIconSize,
            'standard'
          );
          const posterOverlayPresent = Boolean(posterTitleText || posterLogoUrl);
          const posterOverlayGap = posterOverlayPresent ? Math.max(8, Math.round(badgeGap * 0.9)) : 0;
          const posterQualityPlacement = resolvePosterQualityBadgePlacement(
            posterRatingsLayout,
            qualityBadgesSide,
            posterQualityBadgesPosition
          );
          const bottomQualityReservedHeight =
            posterQualityPlacement === 'bottom' && streamBadges.length > 0
              ? Math.max(36, Math.round(baseBadgeHeight * 1.05)) + badgeGap
              : 0;
          const posterOverlayBodyReservedHeight =
            posterOverlayPresent
              ? Math.max(
                posterLogoUrl ? Math.round(outputHeight * 0.20) : 96,
                Math.round(outputHeight * 0.18)
              )
              : 0;
          const posterOverlayReservedHeight =
            posterOverlayPresent
              ? posterOverlayGap +
              posterOverlayBodyReservedHeight +
              (bottomQualityReservedHeight > 0 ? bottomQualityReservedHeight : baseBadgeHeight)
              : 0;
          const overlayReservedHeight = posterOverlayPresent
            ? posterOverlayReservedHeight
            : bottomQualityReservedHeight;
          const posterBaseMetrics: BadgeLayoutMetrics = {
            iconSize: badgeIconSize,
            fontSize: badgeFontSize,
            paddingX: badgePaddingX,
            paddingY: badgePaddingY,
            gap: badgeGap,
          };
          const posterColumnMaxWidth =
            posterRatingsLayout === 'left-right'
              ? Math.max(160, Math.floor((outputWidth - 36) / 2))
              : alignPosterQualityBadges
                ? Math.max(220, Math.floor(outputWidth * 0.6))
                : Math.max(180, Math.floor(outputWidth * 0.46));
          fittedPosterMetrics = fitPosterBadgeMetricsToWidth(
            widthRows,
            posterColumnMaxWidth + 24,
            posterBaseMetrics,
            posterMinMetrics,
            false,
            false,
            verticalBadgeContent
          );
          const shouldPreservePosterBadgeSizeForOverlay = overlayReservedHeight > 0;
          if (!isSingleSideVerticalPoster && !shouldPreservePosterBadgeSizeForOverlay) {
            fittedPosterMetrics = fitPosterBadgeMetricsToHeight(
              posterColumns,
              outputHeight,
              fittedPosterMetrics,
              badgeTopOffset,
              badgeBottomOffset + overlayReservedHeight,
              posterMinMetrics,
              reservedTopRows,
              verticalBadgeContent
            );
          }
          const posterColumnCountMetrics =
            isSingleSideVerticalPoster || shouldPreservePosterBadgeSizeForOverlay
              ? posterBaseMetrics
              : fittedPosterMetrics;
          const maxPerColumn = getMaxBadgeColumnCount(
            outputHeight,
            posterColumnCountMetrics,
            badgeTopOffset,
            badgeBottomOffset + overlayReservedHeight,
            reservedTopRows,
            verticalBadgeContent
          );
          const effectiveMaxPerSide =
            posterRatingsMaxPerSide === null
              ? maxPerColumn + (useThreeBadgeTopRow ? 1 : 0)
              : Math.min(maxPerColumn + (useThreeBadgeTopRow ? 1 : 0), posterRatingsMaxPerSide);
          posterBadgeGroups = splitPosterBadgesByLayout(cappedRatingBadges, posterRatingsLayout, effectiveMaxPerSide);
          topRatingBadges = posterBadgeGroups.topBadges;
          bottomRatingBadges = posterBadgeGroups.bottomBadges;
          leftRatingBadges = posterBadgeGroups.leftBadges;
          rightRatingBadges = posterBadgeGroups.rightBadges;
          cappedRatingBadges = [...topRatingBadges, ...leftRatingBadges, ...rightRatingBadges];
        } else {
          const posterRowFitWidth = usePosterRowLayout
            ? Math.max(0, outputWidth - posterRowHorizontalInset * 2)
            : outputWidth;
          fittedPosterMetrics = fitPosterBadgeMetricsToWidth(
            [topRatingBadges, bottomRatingBadges].filter((row) => row.length > 0),
            posterRowFitWidth,
            {
              iconSize: badgeIconSize,
              fontSize: badgeFontSize,
              paddingX: badgePaddingX,
              paddingY: badgePaddingY,
              gap: badgeGap,
            },
            posterMinMetrics,
            usePosterRowLayout,
            false
          );
        }
        badgeIconSize = fittedPosterMetrics.iconSize;
        badgeFontSize = fittedPosterMetrics.fontSize;
        badgePaddingX = fittedPosterMetrics.paddingX;
        badgePaddingY = fittedPosterMetrics.paddingY;
        badgeGap = fittedPosterMetrics.gap;
      } else if (useBackdropBadgeLayout && cappedRatingBadges.length > 0) {
        if (imageType === 'thumbnail') {
          const thumbnailScale =
            thumbnailSize === 'small' ? 1 : thumbnailSize === 'large' ? 1.75 : 1.4;
          badgeIconSize = Math.max(backdropMinMetrics.iconSize, Math.round(badgeIconSize * thumbnailScale));
          badgeFontSize = Math.max(backdropMinMetrics.fontSize, Math.round(badgeFontSize * thumbnailScale));
          badgePaddingX = Math.max(backdropMinMetrics.paddingX, Math.round(badgePaddingX * thumbnailScale));
          badgePaddingY = Math.max(backdropMinMetrics.paddingY, Math.round(badgePaddingY * thumbnailScale));
          badgeGap = Math.max(backdropMinMetrics.gap, Math.round(badgeGap * thumbnailScale));
          if (!useBackdropVerticalLayout) {
            const backdropRegion = getBackdropBadgePlacement(outputWidth, activeBackdropLikeLayout, imageType);
            const thumbnailRows = [topRatingBadges, bottomRatingBadges].filter((row) => row.length > 0);
            if (thumbnailRows.length > 0) {
              const currentMetrics: BadgeLayoutMetrics = {
                iconSize: badgeIconSize,
                fontSize: badgeFontSize,
                paddingX: badgePaddingX,
                paddingY: badgePaddingY,
                gap: badgeGap,
              };
              const maxRowWidth = Math.max(
                ...thumbnailRows.map((row) => measureBadgeRowWidth(row, currentMetrics)),
                0
              );
              const availableRowWidth = Math.max(0, backdropRegion.width - 24);
              if (availableRowWidth > 0 && maxRowWidth > availableRowWidth) {
                const fitScale = Math.max(0.55, availableRowWidth / maxRowWidth);
                badgeIconSize = Math.max(
                  backdropMinMetrics.iconSize,
                  Math.round(badgeIconSize * fitScale)
                );
                badgeFontSize = Math.max(
                  backdropMinMetrics.fontSize,
                  Math.round(badgeFontSize * fitScale)
                );
                badgePaddingX = Math.max(
                  backdropMinMetrics.paddingX,
                  Math.round(badgePaddingX * fitScale)
                );
                badgePaddingY = Math.max(
                  backdropMinMetrics.paddingY,
                  Math.round(badgePaddingY * fitScale)
                );
                badgeGap = Math.max(
                  backdropMinMetrics.gap,
                  Math.round(badgeGap * fitScale)
                );
              }
            }
          }
        } else {
          let fittedBackdropMetrics: BadgeLayoutMetrics;
          if (useBackdropVerticalLayout) {
            const backdropPlacement = getBackdropBadgePlacement(
              outputWidth,
              activeBackdropLikeLayout,
              backdropLikeImageType
            );
            fittedBackdropMetrics = {
              iconSize: badgeIconSize,
              fontSize: badgeFontSize,
              paddingX: badgePaddingX,
              paddingY: badgePaddingY,
              gap: badgeGap,
            };
            const verticalOutputHeightLimit =
              imageType === 'backdrop'
                ? Math.floor(outputHeight / 2) + badgeBottomOffset
                : outputHeight;
            const maxPerColumn = getMaxBadgeColumnCount(
              verticalOutputHeightLimit,
              fittedBackdropMetrics,
              badgeTopOffset,
              badgeBottomOffset,
              0,
              verticalBadgeContent
            );
            backdropColumns = splitBackdropVerticalBadgesIntoColumns(
              rightRatingBadges,
              backdropPlacement,
              fittedBackdropMetrics,
              maxPerColumn,
              verticalBadgeContent,
              imageType === 'backdrop'
                ? verticalBadgeContent === 'stacked'
                  ? 4
                  : 3
                : 2
            );
            if (backdropColumns.length > 0) {
              leftRatingBadges = backdropColumns[0] || [];
              rightRatingBadges =
                backdropColumns.length > 1
                  ? backdropColumns[backdropColumns.length - 1] || []
                  : backdropColumns[0] || [];
              cappedRatingBadges = backdropColumns.flat();
            } else {
              leftRatingBadges = [];
              rightRatingBadges = rightRatingBadges.slice(0, maxPerColumn);
              cappedRatingBadges = [...rightRatingBadges];
            }
          } else {
            const backdropRegion = getBackdropBadgePlacement(
              outputWidth,
              activeBackdropLikeLayout,
              backdropLikeImageType
            );
            const baseBackdropBadgeHeight = estimateBadgeHeight(
              badgeFontSize,
              badgePaddingX,
              badgePaddingY,
              badgeIconSize,
              'standard'
            );
            const backdropQualityHeight = Math.max(44, Math.round(baseBackdropBadgeHeight * 1.25));
            const backdropQualityBadgeWidth = Math.min(
              Math.max(72, Math.round(backdropQualityHeight * 1.75)),
              Math.max(72, outputWidth - 24)
            );
            const backdropQualityColumnGap = Math.max(8, Math.round(badgeGap * 0.8));
            const backdropQualityColumnCount =
              imageType === 'backdrop' && backdropRegion.align === 'right'
                ? streamBadges.length > 2
                  ? 2
                  : streamBadges.length > 0
                    ? 1
                    : 0
                : 0;
            const reservedQualityWidth =
              backdropQualityColumnCount > 0
                ? backdropQualityColumnCount * backdropQualityBadgeWidth +
                Math.max(0, backdropQualityColumnCount - 1) * backdropQualityColumnGap +
                backdropQualityColumnGap
                : 0;
            const availableBackdropRowWidth = Math.max(
              0,
              backdropRegion.width - reservedQualityWidth
            );
            fittedBackdropMetrics = fitPosterBadgeMetricsToWidth(
              [topRatingBadges, bottomRatingBadges].filter((row) => row.length > 0),
              availableBackdropRowWidth > 0 ? availableBackdropRowWidth : backdropRegion.width,
              {
                iconSize: badgeIconSize,
                fontSize: badgeFontSize,
                paddingX: badgePaddingX,
                paddingY: badgePaddingY,
                gap: badgeGap,
              },
              backdropMinMetrics
            );
          }
          badgeIconSize = fittedBackdropMetrics.iconSize;
          badgeFontSize = fittedBackdropMetrics.fontSize;
          badgePaddingX = fittedBackdropMetrics.paddingX;
          badgePaddingY = fittedBackdropMetrics.paddingY;
          badgeGap = fittedBackdropMetrics.gap;
        }
      }

      const logoBadgeRowWidth = useLogoBadgeLayout && cappedRatingBadges.length > 0
        ? measureBadgeRowWidth(cappedRatingBadges, {
          iconSize: badgeIconSize,
          fontSize: badgeFontSize,
          paddingX: badgePaddingX,
          paddingY: badgePaddingY,
          gap: badgeGap,
        }, false, verticalBadgeContent)
        : 0;
      const qualityBadges = useLogoBadgeLayout ? [] : streamBadges;
      const badgesForIcons = cappedRatingBadges;
      const logoNaturalWidth = useLogoBadgeLayout ? outputWidth : 0;
      const logoBadgeContainerTargetWidth = useLogoBadgeLayout
        ? Math.max(0, logoNaturalWidth - 24)
        : 0;
      const logoBadgeMetrics = {
        iconSize: badgeIconSize,
        fontSize: badgeFontSize,
        paddingX: badgePaddingX,
        paddingY: badgePaddingY,
        gap: badgeGap,
      };
      let logoBadgesPerRow = 0;
      if (useLogoBadgeLayout && cappedRatingBadges.length > 0) {
        logoBadgesPerRow = Math.max(1, cappedRatingBadges.length);
        if (logoMode === 'ratings-only') {
          for (let badgesPerRow = cappedRatingBadges.length; badgesPerRow >= 1; badgesPerRow -= 1) {
            const candidateRows = chunkBy(cappedRatingBadges, badgesPerRow);
            const widestCandidateRow = candidateRows.reduce(
              (maxWidth, row) =>
                Math.max(
                  maxWidth,
                  measureBadgeRowWidth(row, logoBadgeMetrics, false, verticalBadgeContent)
                ),
              0
            );
            logoBadgesPerRow = badgesPerRow;
            if (widestCandidateRow <= logoBadgeContainerTargetWidth) {
              break;
            }
          }
        }
      }
      const logoBadgeRowsData =
        useLogoBadgeLayout && cappedRatingBadges.length > 0 && logoBadgesPerRow > 0
          ? chunkBy(cappedRatingBadges, logoBadgesPerRow)
          : [];
      const widestLogoBadgeRowWidth = logoBadgeRowsData.reduce(
        (maxWidth, row) =>
          Math.max(
            maxWidth,
            measureBadgeRowWidth(row, logoBadgeMetrics, false, verticalBadgeContent)
          ),
        0
      );
      const finalOutputWidth = useLogoBadgeLayout && logoBadgeRowWidth > 0
        ? Math.max(logoNaturalWidth, widestLogoBadgeRowWidth + 24)
        : outputWidth;
      const logoImageWidth = useLogoBadgeLayout
        ? logoNaturalWidth
        : 0;
      const logoImageHeight = useLogoBadgeLayout
        ? logoMode === 'ratings-only'
          ? 0
          : outputHeight
        : 0;
      const logoBadgeRows = logoBadgeRowsData.length;
      const logoBadgeItemHeight = estimateBadgeHeight(
        badgeFontSize,
        badgePaddingX,
        badgePaddingY,
        badgeIconSize,
        verticalBadgeContent
      );
      const estimatedLogoWidth = logoImageWidth;
      const logoBadgeContainerMaxWidth = Math.max(0, finalOutputWidth - 24);
      const logoBadgeMaxWidth = logoBadgeContainerMaxWidth;
      const logoBadgeTopGap = useLogoBadgeLayout && cappedRatingBadges.length > 0
        ? logoMode === 'ratings-only'
          ? 0
          : Math.max(20, Math.round(badgeGap * 1.15))
        : 0;
      const logoBadgeBandHeight = useLogoBadgeLayout && cappedRatingBadges.length > 0
        ? logoBadgeRows * logoBadgeItemHeight + Math.max(0, logoBadgeRows - 1) * badgeGap
        : 0;
      const finalOutputHeight = useLogoBadgeLayout ? logoImageHeight + logoBadgeTopGap + logoBadgeBandHeight : outputHeight;
      const renderedRatingCacheTtlCandidates = [
        ...ratingBadges.map((badge) => {
          if (badge.key === 'tmdb') {
            return TMDB_CACHE_TTL_MS;
          }
          return renderedRatingTtlByProvider.get(badge.key) || null;
        }),
        ...(streamBadges.length > 0 ? [streamBadgesCacheTtlMs ?? STREAM_BADGES_CACHE_TTL_MS] : []),
      ].filter((ttlMs): ttlMs is number => typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0);
      const finalImageCacheTtlMs =
        renderedRatingCacheTtlCandidates.length > 0
          ? Math.min(...renderedRatingCacheTtlCandidates)
          : 7 * 24 * 60 * 60 * 1000;
      const storageCacheControl = buildPublicImageCacheControl(finalImageCacheTtlMs);
      const renderedPayload = await renderWithSharp(
        {
          imageType,
          outputFormat,
          imgUrl,
          outputWidth: finalOutputWidth,
          outputHeight: useLogoBadgeLayout ? Math.max(1, logoImageHeight) : outputHeight,
          imageWidth: useLogoBadgeLayout ? logoImageWidth : undefined,
          imageHeight: useLogoBadgeLayout ? Math.max(1, logoImageHeight) : undefined,
          finalOutputHeight,
          logoBadgeTopGap,
          logoBadgeBandHeight,
          logoBadgeMaxWidth,
          logoBadgesPerRow,
          posterRowHorizontalInset,
          posterTitleText,
          posterLogoUrl,
          posterReferenceBadgeHeight,
          posterReferenceVerticalBadgeHeight,
          posterReferenceBadgeGap,
          thumbnailFallbackEpisodeText: usedThumbnailBackdropFallback ? thumbnailFallbackEpisodeText : null,
          thumbnailFallbackEpisodeCode: usedThumbnailBackdropFallback ? thumbnailFallbackEpisodeCode : null,
          badgeIconSize,
          badgeFontSize,
          badgePaddingX,
          badgePaddingY,
          badgeGap,
          badgeTopOffset,
          badgeBottomOffset,
          badges: badgesForIcons,
          qualityBadges,
          qualityBadgesSide,
          posterQualityBadgesPosition,
          qualityBadgesStyle,
          posterRatingsLayout,
          posterRatingsMaxPerSide,
          backdropRatingsLayout: activeBackdropLikeLayout,
          backdropRatingsSize,
          thumbnailRatingsLayout,
          thumbnailSize,
          verticalBadgeContent,
          ratingStyle,
          topBadges: topRatingBadges,
          bottomBadges: bottomRatingBadges,
          leftBadges: leftRatingBadges,
          rightBadges: rightRatingBadges,
          backdropColumns,
          backdropRows,
          cacheControl: responseHeadersCacheControl,
        },
        phases
      );

      if (shouldCacheFinalImage) {
        try {
          await putCachedImageToObjectStorage(finalObjectStorageKey, {
            body: renderedPayload.body,
            contentType: renderedPayload.contentType,
            cacheControl: storageCacheControl,
          });
        } catch {
          // Ignore distributed cache persistence failures.
        }
      }
      return renderedPayload;
    });

    const finalPayload = renderedImage as RenderedImagePayload;
    return respond(finalPayload.body, 200, {
      'Content-Type': finalPayload.contentType,
      'Cache-Control': responseHeadersCacheControl,
    });
  } catch (e: any) {
    if (e instanceof HttpError) {
      return respond(e.message, e.status, e.headers);
    }
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ERDB] render failed', e);
    }
    const message = typeof e?.message === 'string' ? e.message : 'Unknown error';
    const stack = process.env.NODE_ENV !== 'production' && typeof e?.stack === 'string' ? `\n${e.stack}` : '';
    return respond(`Error: ${message}${stack}`, 500);
  }
}
