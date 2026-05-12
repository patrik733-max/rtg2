import { createHash } from 'node:crypto';
import {
  normalizeProxyCatalogBooleanOverrides,
  normalizeProxyCatalogKeyList,
  normalizeProxyCatalogNameOverrides,
} from '@/lib/proxyCatalog';

const ERDB_OPTIONAL_PARAMS = [
  'ratings',
  'lang',
  'posterLang',
  'posterAnimeLang',
  'backdropLang',
  'backdropAnimeLang',
  'logoLang',
  'logoAnimeLang',
  'posterAnimeImageText',
  'backdropAnimeImageText',
  'streamBadges',
  'qualityBadgesSide',
  'posterQualityBadgesPosition',
  'qualityBadgesStyle',
  'posterRatingsLayout',
  'posterRatingsMode',
  'posterConfiguratorPreset',
  'posterRatingsMaxPerSide',
  'backdropRatingsLayout',
  'backdropRatingsSize',
  'thumbnailRatingsLayout',
  'posterVerticalBadgeContent',
  'backdropVerticalBadgeContent',
  'thumbnailVerticalBadgeContent',
  'thumbnailSize',
  'aiometadataProvider',
];
const ERDB_TYPE_OPTIONAL_PARAMS = {
  poster: [
    'posterStreamBadges',
    'posterQualityBadgesStyle',
    'posterRatings',
    'posterRatingsMode',
    'posterConfiguratorPreset',
    'ranking',
    'rankingCountry',
    'rankingNoBox',
  ],
  backdrop: ['backdropStreamBadges', 'backdropQualityBadgesStyle', 'backdropRatings', 'backdropRatingsMax'],
  logo: ['logoRatings', 'logoRatingsMax', 'logoMode', 'logoFontVariant', 'logoPrimary', 'logoSecondary', 'logoOutline'],
  thumbnail: ['backdropStreamBadges', 'backdropQualityBadgesStyle', 'thumbnailRatings'],
} as const;
const ERDB_FANART_PARAMS = ['fanartKey'] as const;
const ERDB_OPTIONAL_PARAM_KEYS = [
  ...ERDB_OPTIONAL_PARAMS,
  ...ERDB_TYPE_OPTIONAL_PARAMS.poster,
  ...ERDB_TYPE_OPTIONAL_PARAMS.backdrop,
  ...ERDB_TYPE_OPTIONAL_PARAMS.thumbnail,
  ...ERDB_TYPE_OPTIONAL_PARAMS.logo,
  ...ERDB_FANART_PARAMS,
];

const ERDB_TYPE_STYLE_PARAMS = {
  poster: {
    ratingStyle: ['posterRatingStyle', 'ratingStyle'],
    imageText: ['posterImageText', 'imageText'],
  },
  backdrop: {
    ratingStyle: ['backdropRatingStyle', 'ratingStyle'],
    imageText: ['backdropImageText', 'imageText'],
  },
  logo: {
    ratingStyle: ['logoRatingStyle', 'ratingStyle'],
    imageText: [],
  },
  thumbnail: {
    ratingStyle: ['backdropRatingStyle', 'ratingStyle'],
    imageText: ['backdropImageText', 'imageText'],
  },
} as const;

export const ERDB_RESERVED_PARAMS = new Set<string>([
  'url',
  'token',
  'tmdbKey',
  'mdblistKey',
  'simklClientId',
  'erdbBase',
  'seriesMetadataProvider',
  'translateMeta',
  'posterEnabled',
  'backdropEnabled',
  'logoEnabled',
  'thumbnailEnabled',
  'catalogNames',
  'hiddenCatalogs',
  'searchDisabledCatalogs',
  'discoverOnlyCatalogs',
  'ratingStyle',
  'imageText',
  'posterRatingStyle',
  'backdropRatingStyle',
  'logoRatingStyle',
  'posterImageText',
  'backdropImageText',
  ...ERDB_OPTIONAL_PARAM_KEYS,
]);

export type ProxyConfig = {
  url: string;
  token?: string;
  tmdbKey: string;
  mdblistKey: string;
  simklClientId?: string;
  translateMeta?: boolean;
  ratings?: string;
  posterRatings?: string;
  backdropRatings?: string;
  thumbnailRatings?: string;
  logoRatings?: string;
  logoRatingsMax?: string;
  logoMode?: string;
  fanartKey?: string;
  logoFontVariant?: string;
  logoPrimary?: string;
  logoSecondary?: string;
  logoOutline?: string;
  lang?: string;
  posterLang?: string;
  posterAnimeLang?: string;
  backdropLang?: string;
  backdropAnimeLang?: string;
  logoLang?: string;
  logoAnimeLang?: string;
  streamBadges?: string;
  posterStreamBadges?: string;
  backdropStreamBadges?: string;
  qualityBadgesSide?: string;
  posterQualityBadgesPosition?: string;
  qualityBadgesStyle?: string;
  posterQualityBadgesStyle?: string;
  backdropQualityBadgesStyle?: string;
  ratingStyle?: string;
  imageText?: string;
  posterRatingStyle?: string;
  backdropRatingStyle?: string;
  logoRatingStyle?: string;
  posterImageText?: string;
  posterAnimeImageText?: string;
  backdropImageText?: string;
  backdropAnimeImageText?: string;
  posterRatingsLayout?: string;
  posterRatingsMode?: string;
  posterConfiguratorPreset?: string;
  posterRatingsMaxPerSide?: string;
  backdropRatingsLayout?: string;
  backdropRatingsMax?: string;
  backdropRatingsSize?: string;
  thumbnailRatingsLayout?: string;
  posterVerticalBadgeContent?: string;
  backdropVerticalBadgeContent?: string;
  thumbnailVerticalBadgeContent?: string;
  thumbnailSize?: string;
  ranking?: string;
  rankingCountry?: string;
  rankingNoBox?: string;
  seriesMetadataProvider?: string;
  aiometadataProvider?: string;
  erdbBase?: string;
  baseUrl?: string;
  posterEnabled?: boolean;
  backdropEnabled?: boolean;
  logoEnabled?: boolean;
  thumbnailEnabled?: boolean;
  catalogNames?: Record<string, string>;
  hiddenCatalogs?: string[];
  searchDisabledCatalogs?: string[];
  discoverOnlyCatalogs?: Record<string, boolean>;
};

const PROXY_OPTIONAL_STRING_KEYS = [
  'ratings',
  'posterRatings',
  'backdropRatings',
  'thumbnailRatings',
  'logoRatings',
  'logoRatingsMax',
  'fanartKey',
  'logoMode',
  'logoFontVariant',
  'logoPrimary',
  'logoSecondary',
  'logoOutline',
  'simklClientId',
  'lang',
  'posterLang',
  'posterAnimeLang',
  'backdropLang',
  'backdropAnimeLang',
  'logoLang',
  'logoAnimeLang',
  'streamBadges',
  'posterStreamBadges',
  'backdropStreamBadges',
  'qualityBadgesSide',
  'posterQualityBadgesPosition',
  'qualityBadgesStyle',
  'posterQualityBadgesStyle',
  'backdropQualityBadgesStyle',
  'ratingStyle',
  'imageText',
  'posterRatingStyle',
  'backdropRatingStyle',
  'logoRatingStyle',
  'posterImageText',
  'posterAnimeImageText',
  'backdropImageText',
  'backdropAnimeImageText',
  'posterRatingsLayout',
  'posterRatingsMode',
  'posterConfiguratorPreset',
  'posterRatingsMaxPerSide',
  'backdropRatingsLayout',
  'backdropRatingsMax',
  'backdropRatingsSize',
  'thumbnailRatingsLayout',
  'posterVerticalBadgeContent',
  'backdropVerticalBadgeContent',
  'thumbnailVerticalBadgeContent',
  'thumbnailSize',
  'ranking',
  'rankingCountry',
  'rankingNoBox',
  'seriesMetadataProvider',
  'aiometadataProvider',
  'erdbBase',
  'baseUrl',
] as const satisfies readonly (keyof ProxyConfig)[];
type ProxyOptionalStringKey = (typeof PROXY_OPTIONAL_STRING_KEYS)[number];

const PROXY_OPTIONAL_BOOLEAN_KEYS = [
  'translateMeta',
  'posterEnabled',
  'backdropEnabled',
  'logoEnabled',
  'thumbnailEnabled',
] as const satisfies readonly (keyof ProxyConfig)[];
type ProxyOptionalBooleanKey = (typeof PROXY_OPTIONAL_BOOLEAN_KEYS)[number];

const SUPPORTED_PREFIXES = new Set(['tmdb', 'tvdb', 'realimdb', 'kitsu', 'anilist', 'anidb', 'myanimelist', 'mal']);
const IMDB_RE = /^tt\d+$/i;

export const buildProxyId = (manifestUrl: string, configSeed?: string) => {
  const hash = createHash('sha256').update(manifestUrl);
  if (configSeed) {
    hash.update('|');
    hash.update(configSeed);
  }
  const digest = hash.digest('hex').slice(0, 12);
  return `erdb.proxy.${digest}`;
};

export const parseAddonBaseUrl = (manifestUrl: string) => {
  const url = new URL(manifestUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported manifest URL protocol.');
  }
  url.hash = '';
  url.search = '';
  if (url.pathname.endsWith('/manifest.json')) {
    url.pathname = url.pathname.slice(0, -'/manifest.json'.length);
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString();
};

const normalizeStremioType = (value: string | undefined | null): 'movie' | 'tv' | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'movie' || normalized === 'film') return 'movie';
  if (normalized === 'series' || normalized === 'tv' || normalized === 'show') return 'tv';
  return null;
};

export const normalizeErdbId = (
  rawId: string | undefined | null,
  mediaType?: string | null
): string | null => {
  if (!rawId) return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(':');
  const head = parts[0];
  if (IMDB_RE.test(head)) return head;

  const prefix = head.toLowerCase();
  if (prefix === 'imdb' && parts.length >= 2 && IMDB_RE.test(parts[1])) {
    return parts[1];
  }

  if (prefix === 'tmdb') {
    const explicitTypeCandidate = (parts[1] || '').trim().toLowerCase();
    if (
      (explicitTypeCandidate === 'movie' || explicitTypeCandidate === 'tv' || explicitTypeCandidate === 'series') &&
      parts.length >= 3 &&
      parts[2]
    ) {
      const normalizedType = explicitTypeCandidate === 'series' ? 'tv' : explicitTypeCandidate;
      return `tmdb:${normalizedType}:${parts[2]}`;
    }

    if (parts.length >= 2 && parts[1]) {
      const inferredType = normalizeStremioType(mediaType);
      if (inferredType) {
        return `tmdb:${inferredType}:${parts[1]}`;
      }
      return `tmdb:${parts[1]}`;
    }
  }

  if (prefix === 'tvdb' && parts.length >= 2 && parts[1]) {
    return `tvdb:${parts[1]}`;
  }

  if (prefix === 'realimdb' && parts.length >= 2 && parts[1]) {
    return `realimdb:${parts[1]}`;
  }

  if (SUPPORTED_PREFIXES.has(prefix) && parts.length >= 2 && parts[1]) {
    if (prefix === 'mal' || prefix === 'myanimelist') {
      return `mal:${parts[1]}`;
    }
    return `${prefix}:${parts[1]}`;
  }

  return null;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const toOptionalStringAllowEmpty = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return undefined;
};

const decodeBase64Url = (value: string) => {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch (error) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
    return Buffer.from(padded, 'base64').toString('utf8');
  }
};

export const decodeProxyConfig = (encoded: string): ProxyConfig | null => {
  try {
    const json = decodeBase64Url(encoded);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const url = toOptionalString((parsed as ProxyConfig).url);
    const tmdbKey = toOptionalString((parsed as ProxyConfig).tmdbKey);
    const mdblistKey = toOptionalString((parsed as ProxyConfig).mdblistKey);
    if (!url || !tmdbKey || !mdblistKey) return null;

    const config: ProxyConfig = { url, tmdbKey, mdblistKey };
    for (const key of PROXY_OPTIONAL_STRING_KEYS) {
      const value = toOptionalStringAllowEmpty((parsed as ProxyConfig)[key]);
      if (value !== undefined) {
        config[key] = value;
      }
    }
    for (const key of PROXY_OPTIONAL_BOOLEAN_KEYS) {
      const value = toOptionalBoolean((parsed as ProxyConfig)[key]);
      if (value !== undefined) {
        config[key] = value;
      }
    }
    // Alias baseUrl to erdbBase
    if (!config.erdbBase && (parsed as any).baseUrl) {
      config.erdbBase = toOptionalStringAllowEmpty((parsed as any).baseUrl);
    }
    const catalogNames = normalizeProxyCatalogNameOverrides((parsed as ProxyConfig).catalogNames);
    if (catalogNames) {
      config.catalogNames = catalogNames;
    }
    const hiddenCatalogs = normalizeProxyCatalogKeyList((parsed as ProxyConfig).hiddenCatalogs);
    if (hiddenCatalogs) {
      config.hiddenCatalogs = hiddenCatalogs;
    }
    const searchDisabledCatalogs = normalizeProxyCatalogKeyList(
      (parsed as ProxyConfig).searchDisabledCatalogs
    );
    if (searchDisabledCatalogs) {
      config.searchDisabledCatalogs = searchDisabledCatalogs;
    }
    const discoverOnlyCatalogs = normalizeProxyCatalogBooleanOverrides(
      (parsed as ProxyConfig).discoverOnlyCatalogs
    );
    if (discoverOnlyCatalogs) {
      config.discoverOnlyCatalogs = discoverOnlyCatalogs;
    }
    return config;
  } catch (error) {
    return null;
  }
};

export const getProxyConfigFromQuery = (searchParams: URLSearchParams): ProxyConfig | null => {
  const url = searchParams.get('url');
  const tmdbKey = searchParams.get('tmdbKey');
  const mdblistKey = searchParams.get('mdblistKey');
  if (!url || !tmdbKey || !mdblistKey) return null;

  const config: ProxyConfig = { url, tmdbKey, mdblistKey };
  for (const key of PROXY_OPTIONAL_STRING_KEYS) {
    const value = searchParams.get(key);
    if (value !== null) {
      config[key] = value;
    }
  }
  for (const key of PROXY_OPTIONAL_BOOLEAN_KEYS) {
    const value = toOptionalBoolean(searchParams.get(key));
    if (value !== undefined) {
      config[key] = value;
    }
  }
  return config;
};

const getProxyParam = (reqUrl: URL, config: ProxyConfig | null, key: keyof ProxyConfig) => {
  const configValue = config ? config[key] : null;
  if (typeof configValue === 'string') {
    return configValue;
  }
  const queryValue = reqUrl.searchParams.get(key);
  return queryValue !== null ? queryValue : null;
};

export const buildErdbImageUrl = (options: {
  reqUrl: URL;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  erdbId: string;
  tmdbKey: string;
  mdblistKey: string;
  simklClientId?: string;
  config?: ProxyConfig | null;
}) => {
  const { reqUrl, imageType, erdbId, tmdbKey, mdblistKey, simklClientId, config = null } = options;
  const baseOverride = getProxyParam(reqUrl, config, 'erdbBase');
  const base = new URL(baseOverride || reqUrl.origin);
  base.search = '';

  const token = config?.token;
  if (token) {
    base.pathname = `/${token}/${imageType}/${encodeURIComponent(erdbId)}.jpg`;
    return base.toString();
  } else {
    base.pathname = `/${imageType}/${encodeURIComponent(erdbId)}.jpg`;
    base.searchParams.set('tmdbKey', tmdbKey);
    base.searchParams.set('mdblistKey', mdblistKey);
    if (simklClientId) {
      base.searchParams.set('simklClientId', simklClientId);
    }
  }

  for (const key of ERDB_OPTIONAL_PARAMS) {
    const value = getProxyParam(reqUrl, config, key as keyof ProxyConfig);
    if (value !== null) base.searchParams.set(key, value);
  }
  const typeOptionalParams = ERDB_TYPE_OPTIONAL_PARAMS[imageType] || [];
  for (const key of typeOptionalParams) {
    const value = getProxyParam(reqUrl, config, key as keyof ProxyConfig);
    if (value !== null) base.searchParams.set(key, value);
  }

  const styleParams = ERDB_TYPE_STYLE_PARAMS[imageType];
  const ratingStyle =
    styleParams.ratingStyle.map((key) => getProxyParam(reqUrl, config, key)).find((value) => value) || null;
  if (ratingStyle) base.searchParams.set('ratingStyle', ratingStyle);

  if (styleParams.imageText.length > 0) {
    const imageText =
      styleParams.imageText.map((key) => getProxyParam(reqUrl, config, key)).find((value) => value) || null;
    if (imageText) base.searchParams.set('imageText', imageText);
  }

  return base.toString();
};
