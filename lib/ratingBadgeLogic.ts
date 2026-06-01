import { RATING_PROVIDER_OPTIONS, type RatingPreference } from '@/lib/ratingPreferences';
import type { RatingStyle } from '@/lib/ratingStyle';
import type { PosterRatingLayout } from '@/lib/posterRatingLayout';

export type StreamBadgeKey =
  | 'atmosdv'
  | 'remux'
  | 'bluray'
  | 'webdl'
  | 'webrip'
  | '4k'
  | '1080p'
  | '720p'
  | 'dolbyvision'
  | 'hdr10plus'
  | 'hdr10'
  | 'hdr'
  | 'imaxenhanced'
  | 'imax'
  | 'sdr'
  | 'truehd'
  | 'dolbyatmos'
  | 'dtsx'
  | 'dtshdma'
  | 'dtshd'
  | 'dts'
  | 'ddplus'
  | 'dd';
export type RenderImageType = 'poster' | 'backdrop' | 'logo' | 'thumbnail';
export type BadgeKey = RatingPreference | StreamBadgeKey | 'average' | 'genre' | 'ranking';
export type QualityBadgesSide = 'left' | 'right';
export type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide | 'top' | 'bottom' | 'above-logo';
export type RankingPosition = 'auto' | 'top' | 'bottom' | 'above-logo';
export type PosterGenrePosition = 'off' | 'top' | 'bottom' | 'above-logo';
export type StreamQualityFlags = Partial<Record<StreamBadgeKey, boolean>>;
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
export const STREAM_BADGE_META = new Map<
  StreamBadgeKey,
  { label: string; value: string; accentColor: string; iconUrl: string; iconWidthRatio?: number }
>([
  [
    'atmosdv',
    {
      label: 'Atmos+DV',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/atmos-vision.png',
      iconWidthRatio: 3.66,
    },
  ],
  [
    'remux',
    {
      label: 'REMUX',
      value: '',
      accentColor: '#27c04f',
      iconUrl: 'https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-remux.png',
      iconWidthRatio: 4.28,
    },
  ],
  [
    'bluray',
    {
      label: 'BluRay',
      value: '',
      accentColor: '#27c04f',
      iconUrl: 'https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-bluray.png',
      iconWidthRatio: 3.46,
    },
  ],
  [
    'webdl',
    {
      label: 'WebDL',
      value: '',
      accentColor: '#27c04f',
      iconUrl: 'https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-webdl.png',
      iconWidthRatio: 4.44,
    },
  ],
  [
    'webrip',
    {
      label: 'WebRip',
      value: '',
      accentColor: '#27c04f',
      iconUrl: 'https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w%3Ao%20logo/colored-webrip.png',
      iconWidthRatio: 3.75,
    },
  ],
  [
    '4k',
    {
      label: '4K',
      value: '',
      accentColor: '#ffbe01',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/4k.png',
      iconWidthRatio: 1.39,
    },
  ],
  [
    '1080p',
    {
      label: '1080p',
      value: '',
      accentColor: '#ff6904',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/1080p.png',
      iconWidthRatio: 2.23,
    },
  ],
  [
    '720p',
    {
      label: '720p',
      value: '',
      accentColor: '#fb411c',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/720p.png',
      iconWidthRatio: 1.59,
    },
  ],
  [
    'dolbyvision',
    {
      label: 'DV',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/DV.png',
      iconWidthRatio: 5.72,
    },
  ],
  [
    'hdr10plus',
    {
      label: 'HDR10+',
      value: '',
      accentColor: '#ffbe01',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR10Plus.png',
      iconWidthRatio: 4.79,
    },
  ],
  [
    'hdr10',
    {
      label: 'HDR10',
      value: '',
      accentColor: '#ffbe01',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR10.png',
      iconWidthRatio: 4.25,
    },
  ],
  [
    'hdr',
    {
      label: 'HDR',
      value: '',
      accentColor: '#ffbe01',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR.png',
      iconWidthRatio: 2.6,
    },
  ],
  [
    'imaxenhanced',
    {
      label: 'IMAX Enhanced',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/9mousaa/BetterFormatter/main/images/IMAX-enhanced.png',
      iconWidthRatio: 2.93,
    },
  ],
  [
    'imax',
    {
      label: 'IMAX',
      value: '',
      accentColor: '#ffbe01',
      iconUrl: 'https://github.com/nobnobz/Omni-Template-Bot-Bid-Raiser/blob/main/Other/regex%20tags/IMAXv2.PNG?raw=true',
      iconWidthRatio: 5.16,
    },
  ],
  [
    'sdr',
    {
      label: 'SDR',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images/sdr.png',
      iconWidthRatio: 2.5,
    },
  ],
  [
    'truehd',
    {
      label: 'TrueHD',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/TrueHD.png',
      iconWidthRatio: 6.26,
    },
  ],
  [
    'dolbyatmos',
    {
      label: 'Atmos',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/Atmos.png',
      iconWidthRatio: 5.94,
    },
  ],
  [
    'dtsx',
    {
      label: 'DTS:X',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dtsx.png',
      iconWidthRatio: 3.4,
    },
  ],
  [
    'dtshdma',
    {
      label: 'DTS-HD MA',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dtsHDMA.png',
      iconWidthRatio: 5.54,
    },
  ],
  [
    'dtshd',
    {
      label: 'DTS-HD',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dtsHD.png',
      iconWidthRatio: 4.31,
    },
  ],
  [
    'dts',
    {
      label: 'DTS',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dts.png',
      iconWidthRatio: 2.4,
    },
  ],
  [
    'ddplus',
    {
      label: 'DD+',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/DDPLUS.png',
      iconWidthRatio: 5.14,
    },
  ],
  [
    'dd',
    {
      label: 'DD',
      value: '',
      accentColor: '#ffffff',
      iconUrl: 'https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/DD.png',
      iconWidthRatio: 4.52,
    },
  ],
]);
export const STREAM_BADGE_ORDER: StreamBadgeKey[] = [
  'atmosdv',
  'remux',
  'bluray',
  'webdl',
  'webrip',
  '4k',
  '1080p',
  '720p',
  'dolbyvision',
  'hdr10plus',
  'hdr10',
  'hdr',
  'imaxenhanced',
  'imax',
  'sdr',
  'truehd',
  'dolbyatmos',
  'dtsx',
  'dtshdma',
  'dtshd',
  'dts',
  'ddplus',
  'dd',
];
const STREAM_BADGE_PATTERNS: Array<[StreamBadgeKey, RegExp]> = [
  ['atmosdv', /^(?=.*\batmos\b)(?=.*\b(?:dv|dovi|dolby[\s._-]?vision)\b)/i],
  ['remux', /\bremux\b/i],
  ['bluray', /^(?=.*(?:bluray|blu-ray))(?!.*remux)/i],
  ['webdl', /\b(?:web[-_. ]?dl|webdl)\b/i],
  ['webrip', /\bweb[-_. ]?rip\b/i],
  ['4k', /^(?=.*(?:2160[pi]?|4k|uhd))(?!.*(?:1080[pi]?|720[pi]?))/i],
  ['1080p', /\b1080[pi]?\b/i],
  ['720p', /\b720[pi]?\b/i],
  ['dolbyvision', /\b(?:dv|dovi|dolby[\s._-]?vision)\b/i],
  ['hdr10plus', /^(?!.*\b(?:dv|dovi|dolby[\s._-]?vision)\b)(?=.*hdr[\s._-]?10[\s._-]?(?:\+|plus|p))/i],
  ['hdr10', /^(?!.*\b(?:dv|dovi|dolby[\s._-]?vision)\b)(?=.*hdr[\s._-]?10)(?!.*hdr[\s._-]?10[\s._-]?(?:\+|plus|p))/i],
  ['hdr', /^(?!.*\b(?:dv|dovi|dolby[\s._-]?vision)\b)(?=.*\bHDR\b)(?!.*hdr[\s._-]?10)/i],
  ['imaxenhanced', /\bimax[\s._-]?enhanced\b/i],
  ['imax', /^(?=.*\bIMAX\b)(?!.*enhanced)/i],
  ['sdr', /\bsdr\b/i],
  ['truehd', /(?:\btrue[ ._-]?hd\b|^(?=.*\batmos\b)(?=.*\bremux\b)(?!.*\b(?:true[ ._-]?hd|ddp|dd\+|e-?ac3|eac3)\b).+$)/i],
  ['dolbyatmos', /^(?!.*\btrue[ _.-]?hd\b).*\batmos\b.*$/i],
  ['dtsx', /\bdts[-_.: ]?x\b/i],
  ['dtshdma', /^(?=.*\bdts[-_. ]?(?:hd[-_. ]?)?ma\b)(?!.*\bdts[-_.: ]?x\b)/i],
  ['dtshd', /^(?=.*\bdts[-_. ]?hd\b)(?!.*\bdts[-_. ]?(?:hd[-_. ]?)?ma\b)(?!.*\bdts[-_.: ]?x\b)/i],
  ['dts', /^(?=.*\bDTS\b)(?!.*\bdts[-_. ]?(?:hd|ma|xll|x)\b)/i],
  ['ddplus', /^(?=.*(?:\bddp|\bdd\+|\beac-?3|\be-?ac-?3))(?!.*\batmos\b)(?!.*\btrue[\s._-]?hd\b)(?!.*\b(?:dv|dovi|dolby[\s._-]?vision)\b)/i],
  ['dd', /^(?=.*\b(?:dd[25][. ][01]|dd[^p+a-z]\b|\bac-?3)\b)(?!.*(?:\bddp|\bdd\+|\beac-?3|\be-?ac-?3))(?!.*\btrue[\s._-]?hd\b)(?!.*\batmos\b)(?!.*\b(?:dv|dovi|dolby[\s._-]?vision)\b)/i],
];
type StreamBadgeCategory = 'quality' | 'resolution' | 'visual' | 'audio';
const STREAM_BADGE_CATEGORY: Record<StreamBadgeKey, StreamBadgeCategory> = {
  atmosdv: 'audio',
  remux: 'quality',
  bluray: 'quality',
  webdl: 'quality',
  webrip: 'quality',
  '4k': 'resolution',
  '1080p': 'resolution',
  '720p': 'resolution',
  dolbyvision: 'visual',
  hdr10plus: 'visual',
  hdr10: 'visual',
  hdr: 'visual',
  imaxenhanced: 'visual',
  imax: 'visual',
  sdr: 'visual',
  truehd: 'audio',
  dolbyatmos: 'audio',
  dtsx: 'audio',
  dtshdma: 'audio',
  dtshd: 'audio',
  dts: 'audio',
  ddplus: 'audio',
  dd: 'audio',
};
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
  const normalized = (value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (!normalized || normalized === 'auto' || normalized === 'default') return 'auto';
  if (['top', 't', 'up'].includes(normalized)) return 'top';
  if (['bottom', 'bot', 'b', 'down'].includes(normalized)) return 'bottom';
  if (['above-logo', 'above-clean', 'above-poster-text', 'logo', 'clean'].includes(normalized)) {
    return 'above-logo';
  }
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
): 'top' | 'bottom' | 'above-logo' | QualityBadgesSide => {
  if (posterQualityBadgesPosition !== 'auto') {
    return posterQualityBadgesPosition;
  }
  if (layout === 'left' || layout === 'right' || layout === 'left-right') {
    return 'bottom';
  }
  if (layout === 'top-bottom') {
    return 'bottom';
  }
  if (layout === 'top') {
    return 'bottom';
  }
  if (layout === 'bottom') {
    return 'bottom';
  }
  return qualityBadgesSide;
};

export const normalizeQualityBadgesStyle = (value?: string | null): RatingStyle => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'glass' || normalized === 'square' || normalized === 'plain') {
    return normalized;
  }
  return DEFAULT_QUALITY_BADGES_STYLE;
};

export const createEmptyStreamFlags = (): StreamQualityFlags => ({});

export const parseStreamFlagsFromFilename = (filename: string): StreamQualityFlags => {
  const flags = createEmptyStreamFlags();
  for (const [key, pattern] of STREAM_BADGE_PATTERNS) {
    if (pattern.test(filename)) flags[key] = true;
  }
  return flags;
};

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
  let bestFlags = createEmptyStreamFlags();
  let bestScore = 0;
  const scoreFlags = (flags: StreamQualityFlags) =>
    STREAM_BADGE_ORDER.reduce((score, key, index) => {
      if (!flags[key]) return score;
      return score + STREAM_BADGE_ORDER.length - index;
    }, 0);

  for (const filename of filenames) {
    if (!filename) continue;
    const flags = parseStreamFlagsFromFilename(filename);
    const score = scoreFlags(flags);
    if (score > bestScore) {
      bestFlags = flags;
      bestScore = score;
    }
  }
  return bestFlags;
};

export const buildStreamBadgesFromFlags = (flags: StreamQualityFlags): RatingBadge[] => {
  const badges: RatingBadge[] = [];
  const legacyFlags = flags as StreamQualityFlags & {
    has4k?: boolean;
    hasHdr?: boolean;
    hasDolbyVision?: boolean;
    hasDolbyAtmos?: boolean;
    hasRemux?: boolean;
  };
  const normalizedFlags: StreamQualityFlags = {
    ...flags,
    '4k': flags['4k'] || legacyFlags.has4k,
    hdr: flags.hdr || legacyFlags.hasHdr,
    dolbyvision: flags.dolbyvision || legacyFlags.hasDolbyVision,
    dolbyatmos: flags.dolbyatmos || legacyFlags.hasDolbyAtmos,
    remux: flags.remux || legacyFlags.hasRemux,
  };
  if (normalizedFlags.atmosdv) {
    normalizedFlags.dolbyatmos = false;
    normalizedFlags.dolbyvision = false;
  }
  const usedCategories = new Set<StreamBadgeCategory>();
  for (const key of STREAM_BADGE_ORDER) {
    if (!normalizedFlags[key]) continue;
    const category = STREAM_BADGE_CATEGORY[key];
    if (usedCategories.has(category)) continue;
    const meta = STREAM_BADGE_META.get(key);
    if (!meta) continue;
    usedCategories.add(category);
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



