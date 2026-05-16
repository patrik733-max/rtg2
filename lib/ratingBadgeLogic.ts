import { RATING_PROVIDER_OPTIONS, type RatingPreference } from '@/lib/ratingPreferences';
import type { RatingStyle } from '@/lib/ratingStyle';
import type { PosterRatingLayout } from '@/lib/posterRatingLayout';

export type StreamBadgeKey = '4k' | 'hdr' | 'dolbyvision' | 'dolbyatmos' | 'remux';
export type RenderImageType = 'poster' | 'backdrop' | 'logo' | 'thumbnail';
export type BadgeKey = RatingPreference | StreamBadgeKey | 'average' | 'genre' | 'ranking';
export type QualityBadgesSide = 'left' | 'right';
export type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
export type RankingPosition = 'auto' | 'top' | 'bottom' | 'above-logo';
export type PosterGenrePosition = 'off' | 'top' | 'bottom' | 'above-logo';
export type StreamQualityFlags = {
  has4k: boolean;
  hasHdr: boolean;
  hasDolbyVision: boolean;
  hasDolbyAtmos: boolean;
  hasRemux: boolean;
};
export type RatingBadge = {
  key: BadgeKey;
  label: string;
  value: string;
  iconUrl: string;
  accentColor: string;
  iconCornerRadius?: number;
  iconScale?: number;
};
export type RankingBadge = {
  value: string;
  label: string;
  noBox?: boolean;
  compact?: boolean;
};
export type OutputFormat = 'png' | 'jpeg' | 'webp';
export const PERCENTAGE_RATING_PROVIDERS = new Set<RatingPreference>([
  'mdblist',
  'tomatoes',
  'tomatoesaudience',
  'metacritic',
  'trakt',
  'anilist',
  'kitsu',
]);
export const ANIME_ONLY_RATING_PROVIDER_SET = new Set<RatingPreference>(['myanimelist', 'anilist', 'kitsu']);
export const SCALE_SUFFIX_RATING_PROVIDERS: Partial<Record<RatingPreference, string>> = {
  tmdb: '/10',
  imdb: '/10',
  metacriticuser: '/10',
  simkl: '/10',
  filmweb: '/10',
  filmwebcritics: '/10',
  letterboxd: '/5',
  myanimelist: '/10',
  rogerebert: '/4',
};
export const RATING_PROVIDER_META = new Map(
  RATING_PROVIDER_OPTIONS.map((provider) => [provider.id, provider] as const)
);
export const STREAM_BADGE_META = new Map<StreamBadgeKey, { label: string; value: string; accentColor: string; iconUrl: string }>([
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
export const STREAM_BADGE_ORDER: StreamBadgeKey[] = ['4k', 'hdr', 'dolbyvision', 'dolbyatmos', 'remux'];
export const DEFAULT_QUALITY_BADGES_STYLE: RatingStyle = 'glass';
export const STREAM_BADGES_PROVIDER_BASE_URL = (
  process.env.ERDB_STREAM_BADGES_PROVIDER_URL || 'https://corsaro.stremio.dpdns.org/eyJ0bWRiX2tleSI6IjU0NjJmNzg0NjlmM2Q4MGJmNTIwMTY0NTI5NGMxNmU0IiwidXNlX2NvcnNhcm9uZXJvIjp0cnVlLCJ1c2VfdWluZGV4IjpmYWxzZSwidXNlX2tuYWJlbiI6dHJ1ZSwidXNlX3RvcnJlbnRnYWxheHkiOmZhbHNlLCJ1c2VfdG9ycmVudGlvIjp0cnVlLCJ1c2VfbWVkaWFmdXNpb24iOnRydWUsInVzZV9jb21ldCI6dHJ1ZSwidXNlX3N0cmVtdGhydV90b3J6Ijp0cnVlLCJ1c2VfcmFyYmciOnRydWUsImZ1bGxfaXRhIjpmYWxzZSwiZGJfb25seSI6ZmFsc2UsInVzZV9nbG9iYWxfY2FjaGUiOmZhbHNlLCJvbmx5X2RlYnJpZF9jYWNoZSI6ZmFsc2UsImh5YnJpZF9tb2RlIjp0cnVlfQ/manifest.json'
)
  .trim()
  .replace(/\/manifest\.json$/i, '')
  .replace(/\/+$/, '');
export const LOGO_BASE_HEIGHT = 320;
export const LOGO_FALLBACK_ASPECT_RATIO = 2.5;
export const LOGO_MIN_WIDTH = 360;
export const LOGO_MAX_WIDTH = 3000;


export const buildProviderMonogram = (label: string) => {
  const cleaned = label.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  if (!cleaned) return 'R';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

export const normalizeStreamBadgesSetting = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'auto';
  if (['1', 'true', 'yes', 'on', 'torrentio'].includes(normalized)) return 'on';
  if (['0', 'false', 'no', 'off', 'none'].includes(normalized)) return 'off';
  return 'auto';
};

export const normalizeQualityBadgesSide = (value?: string | null): QualityBadgesSide => {
  const normalized = (value || '').trim().toLowerCase();
  if (['right', 'r', 'end'].includes(normalized)) return 'right';
  return 'left';
};
export const normalizePosterQualityBadgesPosition = (value?: string | null): PosterQualityBadgesPosition => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto' || normalized === 'default') return 'auto';
  if (['right', 'r', 'end'].includes(normalized)) return 'right';
  if (['left', 'l', 'start'].includes(normalized)) return 'left';
  return 'auto';
};
export const normalizeRankingPosition = (value?: string | null): RankingPosition => {
  const normalized = (value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (!normalized || normalized === 'auto' || normalized === 'default') return 'auto';
  if (['top', 't', 'up'].includes(normalized)) return 'top';
  if (['bottom', 'bot', 'b', 'down'].includes(normalized)) return 'bottom';
  if (['above-logo', 'above-clean', 'above-poster-text', 'logo', 'clean'].includes(normalized)) {
    return 'above-logo';
  }
  return 'auto';
};
export const normalizePosterGenrePosition = (value?: string | null): PosterGenrePosition => {
  const normalized = (value || '').trim().toLowerCase();
  if (['top', 't', 'up'].includes(normalized)) return 'top';
  if (['bottom', 'bot', 'b', 'down'].includes(normalized)) return 'bottom';
  if (['above-logo', 'abovelogo', 'above_logo'].includes(normalized)) return 'above-logo';
  return 'off';
};
export const resolvePosterQualityBadgePlacement = (
  layout: PosterRatingLayout,
  qualityBadgesSide: QualityBadgesSide,
  posterQualityBadgesPosition: PosterQualityBadgesPosition
): 'top' | 'bottom' | QualityBadgesSide => {
  if (layout === 'left' || layout === 'right' || layout === 'left-right') {
    return 'bottom';
  }
  if (layout === 'top-bottom') {
    return posterQualityBadgesPosition === 'auto' ? 'bottom' : posterQualityBadgesPosition;
  }
  if (layout === 'top') {
    return posterQualityBadgesPosition === 'auto' ? 'bottom' : posterQualityBadgesPosition;
  }
  if (layout === 'bottom') {
    return posterQualityBadgesPosition === 'auto' ? 'bottom' : posterQualityBadgesPosition;
  }
  return qualityBadgesSide;
};

export const normalizeQualityBadgesStyle = (value?: string | null): RatingStyle => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'glass' || normalized === 'square' || normalized === 'plain' || normalized === 'solid-light') {
    return normalized;
  }
  return DEFAULT_QUALITY_BADGES_STYLE;
};

export const createEmptyStreamFlags = (): StreamQualityFlags => ({
  has4k: false,
  hasHdr: false,
  hasDolbyVision: false,
  hasDolbyAtmos: false,
  hasRemux: false,
});

export const parseStreamFlagsFromFilename = (filename: string): StreamQualityFlags => {
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

export const mergeStreamFlags = (left: StreamQualityFlags, right: StreamQualityFlags): StreamQualityFlags => ({
  has4k: left.has4k || right.has4k,
  hasHdr: left.hasHdr || right.hasHdr,
  hasDolbyVision: left.hasDolbyVision || right.hasDolbyVision,
  hasDolbyAtmos: left.hasDolbyAtmos || right.hasDolbyAtmos,
  hasRemux: left.hasRemux || right.hasRemux,
});

export const extractTorrentioFilenames = (payload: any) => {
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

export const collectStreamFlags = (filenames: string[]) => {
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

export const buildStreamBadgesFromFlags = (flags: StreamQualityFlags): RatingBadge[] => {
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

export const buildTorrentioUrl = (type: 'movie' | 'series', id: string) =>
  `${STREAM_BADGES_PROVIDER_BASE_URL}/stream/${type}/${encodeURIComponent(id)}.json`;

export const formatRatingNumber = (value: number) => {
  const rounded = value.toFixed(1);
  return rounded === '10.0' ? '10' : rounded;
};

export const formatDisplayRatingValue = (
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

export const parseDisplayRatingValue = (value: string) => {
  const numericCandidate = value
    .replace('%', '')
    .split('/')[0]
    .replace(',', '.')
    .trim();
  const numericValue = Number(numericCandidate);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const shouldRenderRatingValue = (value: string | null | undefined) => {
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

export const pickOutputFormat = (imageType: RenderImageType, acceptHeader?: string | null): OutputFormat => {
  if (imageType === 'logo') return 'png';
  const accept = (acceptHeader || '').toLowerCase();
  return accept.includes('image/webp') ? 'webp' : 'jpeg';
};

export const outputFormatToContentType = (format: OutputFormat) => {
  if (format === 'webp') return 'image/webp';
  if (format === 'jpeg') return 'image/jpeg';
  return 'image/png';
};

export const outputFormatToExtension = (format: OutputFormat) => {
  if (format === 'webp') return 'webp';
  if (format === 'jpeg') return 'jpg';
  return 'png';
};



