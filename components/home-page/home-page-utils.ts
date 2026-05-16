import { useSyncExternalStore } from 'react';
import {
  RATING_PROVIDER_OPTIONS,
  parseRatingPreferencesAllowEmpty,
  stringifyRatingPreferencesAllowEmpty,
  type RatingPreference,
} from '@/lib/ratingPreferences';
import {
  BACKDROP_RATING_LAYOUT_OPTIONS,
  type BackdropRatingLayout,
} from '@/lib/backdropRatingLayout';
import type { BackdropRatingsSize } from '@/lib/backdropRatingsSize';
import {
  THUMBNAIL_RATING_LAYOUT_OPTIONS,
  type ThumbnailRatingLayout,
} from '@/lib/thumbnailRatingLayout';
import type { ThumbnailSize } from '@/lib/thumbnailSize';
import {
  POSTER_RATING_LAYOUT_OPTIONS,
  isVerticalPosterRatingLayout,
  type PosterRatingLayout,
} from '@/lib/posterRatingLayout';
import {
  RATING_STYLE_OPTIONS,
  type RatingStyle,
} from '@/lib/ratingStyle';
import type { LogoMode } from '@/lib/logoMode';
import type { LogoFontVariant } from '@/lib/logoFontVariant';
import type { PosterGenrePosition, RankingPosition } from '@/lib/ratingBadgeLogic';
import {
  getTmdbLanguageBase,
  normalizeTmdbLanguageCode,
} from '@/lib/tmdbLanguage';
import { JUSTWATCH_COUNTRY_OPTIONS } from '@/components/workspace/constants';
export type HomePageMode = 'landing' | 'workspace';

export const VISIBLE_RATING_PROVIDER_OPTIONS = RATING_PROVIDER_OPTIONS;
export const THUMBNAIL_SUPPORTED_RATINGS: RatingPreference[] = ['tmdb', 'imdb'];
export const EPISODE_ID_PATTERN = /^.+:\d+:\d+$/;
export const DEFAULT_SERIES_ID = 'tt4574334';
export const DEFAULT_THUMBNAIL_ID = 'tt4574334:1:1';
export const PROXY_TYPES = ['poster', 'backdrop', 'logo', 'thumbnail'] as const;
export const PREVIEW_TYPES = ['poster', 'backdrop', 'logo', 'thumbnail'] as const;
export type ProxyType = (typeof PROXY_TYPES)[number];
export type PreviewType = (typeof PREVIEW_TYPES)[number];
export type ProxyEnabledTypes = Record<ProxyType, boolean>;
export type AiometadataPatternType = 'poster' | 'background' | 'logo' | 'episodeThumbnail';
export type AiometadataEpisodeProvider = 'tvdb' | 'realimdb';
export type ProxySeriesMetadataProvider = 'tmdb' | 'imdb';
export type ProxyEpisodeProvider = 'custom' | 'realimdb' | 'tvdb';
export type StreamBadgesSetting = 'auto' | 'on' | 'off';
export type QualityBadgesSide = 'left' | 'right';
export type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
export type { PosterGenrePosition };
export type VerticalBadgeContent = 'standard' | 'stacked';
export type PosterConfiguratorPreset = 'simple' | 'advanced';
export const DEFAULT_QUALITY_BADGES_STYLE: RatingStyle = 'glass';
export const STREAM_BADGE_OPTIONS: Array<{ id: StreamBadgesSetting; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
];
export const QUALITY_BADGE_SIDE_OPTIONS: Array<{ id: QualityBadgesSide; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
export const POSTER_QUALITY_BADGE_POSITION_OPTIONS: Array<{
  id: PosterQualityBadgesPosition;
  label: string;
}> = [
    { id: 'auto', label: 'Auto' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ];
export const TMDB_KEY_STORAGE_KEY = 'erdb_tmdb_key';
export const MDBLIST_KEY_STORAGE_KEY = 'erdb_mdblist_key';
export const SIMKL_CLIENT_ID_STORAGE_KEY = 'erdb_simkl_client_id';
export const FANART_KEY_STORAGE_KEY = 'erdb_fanart_key';
export const ERDB_TOKEN_STORAGE_KEY = 'erdb_active_token';
export const PREVIEW_CONFIG_STORAGE_KEY = 'erdb_preview_config';
export const EXPORT_CONFIG_VERSION = 1;
export const TMDB_LANGUAGE_DOC_EXAMPLES = 'TMDB language code (en, es-ES, es-MX, pt-PT, pt-BR, etc.)';
export const RATING_PROVIDER_IDS = new Set(RATING_PROVIDER_OPTIONS.map((option) => option.id));
export const isRatingProviderId = (value: string): value is RatingPreference =>
  RATING_PROVIDER_IDS.has(value as RatingPreference);

export const isPreviewType = (value: unknown): value is PreviewType =>
  PREVIEW_TYPES.includes(value as PreviewType);
export const isProxyType = (value: unknown): value is ProxyType =>
  PROXY_TYPES.includes(value as ProxyType);
export const isStreamBadgesSetting = (value: unknown): value is StreamBadgesSetting =>
  value === 'auto' || value === 'on' || value === 'off';
export const isQualityBadgesSide = (value: unknown): value is QualityBadgesSide =>
  value === 'left' || value === 'right';
export const isPosterQualityBadgesPosition = (value: unknown): value is PosterQualityBadgesPosition =>
  value === 'auto' || value === 'left' || value === 'right';
export const isPosterGenrePosition = (value: unknown): value is PosterGenrePosition =>
  value === 'off' || value === 'top' || value === 'bottom' || value === 'above-logo';
export const isImageText = (value: unknown): value is 'default' | 'clean' | 'alternative' =>
  value === 'default' || value === 'original' || value === 'clean' || value === 'alternative';
export const isRatingStyle = (value: unknown): value is RatingStyle =>
  RATING_STYLE_OPTIONS.some((option) => option.id === value);
export const isPosterRatingLayout = (value: unknown): value is PosterRatingLayout =>
  POSTER_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
export const isBackdropRatingLayout = (value: unknown): value is BackdropRatingLayout =>
  BACKDROP_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
export const isThumbnailRatingLayout = (value: unknown): value is ThumbnailRatingLayout =>
  THUMBNAIL_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
export const isProxySeriesMetadataProvider = (value: unknown): value is ProxySeriesMetadataProvider =>
  value === 'tmdb' || value === 'imdb';
export const isProxyEpisodeProvider = (value: unknown): value is ProxyEpisodeProvider =>
  value === 'custom' || value === 'realimdb' || value === 'tvdb';
export const isAiometadataEpisodeProvider = (value: unknown): value is AiometadataEpisodeProvider =>
  value === 'tvdb' || value === 'realimdb';
export const isVerticalBadgeContent = (value: unknown): value is VerticalBadgeContent =>
  value === 'standard' || value === 'stacked';

export const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

export const normalizeManifestUrl = (value: string, allowBareScheme = false) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('stremio://')) {
    return trimmed;
  }

  const withoutScheme = trimmed.slice('stremio://'.length);
  if (!withoutScheme) return allowBareScheme ? 'https://' : '';
  if (/^https?:\/\//i.test(withoutScheme)) {
    return withoutScheme;
  }
  return `https://${withoutScheme}`;
};

export const isBareHttpUrl = (value: string) => value === 'http://' || value === 'https://';
export const isCinemetaManifestUrl = (value: string) => {
  try {
    return /(^|[-.])cinemeta\.strem\.io$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

export const safeLocalStorageGet = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeLocalStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
};

export const safeLocalStorageRemove = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

export const subscribeToNothing = () => () => { };

export const useClientOrigin = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => ''
  );

export const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const tryParseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const parseImportedConfigPayload = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedInput = trimmed.replace(/^['"]+|['"]+$/g, '');
  const directJson = tryParseJsonObject(normalizedInput);
  if (directJson) {
    return directJson;
  }

  const candidates = new Set<string>([normalizedInput]);
  const proxyPathMatch = normalizedInput.match(/\/proxy\/([^/?#]+)\/manifest\.json/i);
  if (proxyPathMatch?.[1]) {
    candidates.add(proxyPathMatch[1]);
  }

  const tryAddUrlCandidates = (urlValue: string) => {
    try {
      const parsedUrl = new URL(urlValue);
      const pathMatch = parsedUrl.pathname.match(/\/proxy\/([^/?#]+)\/manifest\.json/i);
      if (pathMatch?.[1]) {
        candidates.add(pathMatch[1]);
      }
      for (const key of ['config', 'erdbConfig']) {
        const paramValue = parsedUrl.searchParams.get(key);
        if (paramValue) {
          candidates.add(paramValue.trim());
        }
      }
    } catch {
      // ignore invalid URLs
    }
  };

  tryAddUrlCandidates(normalizedInput);
  if (/^stremio:\/\//i.test(normalizedInput)) {
    tryAddUrlCandidates(normalizeManifestUrl(normalizedInput, true));
  }

  for (const candidate of candidates) {
    try {
      const decoded = decodeBase64Url(candidate.trim());
      const parsed = tryParseJsonObject(decoded);
      if (parsed) {
        return parsed;
      }
    } catch {
      // keep trying alternative candidate formats
    }
  }

  return null;
};

export const EMPTY_ENABLED_RATING_QUERY_KEYS = new Set([
  'ratings',
  'posterRatings',
  'backdropRatings',
  'thumbnailRatings',
  'logoRatings',
]);

export const buildAiometadataPattern = (options: {
  baseUrl: string;
  activeToken: string | null;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  idPlaceholder: string;
  tmdbKey: string;
  mdblistKey: string;
  simklClientId: string;
  fanartKey: string;
  lang: string;
  posterLang: string;
  posterAnimeLang: string;
  backdropLang: string;
  backdropAnimeLang: string;
  logoLang: string;
  logoAnimeLang: string;
  posterAnimeImageText: 'default' | 'clean' | 'alternative';
  backdropAnimeImageText: 'default' | 'clean' | 'alternative';
  posterRatings: string;
  backdropRatings: string;
  thumbnailRatings: string;
  logoRatings: string;
  logoRatingsMax: number | null;
  logoMode: LogoMode;
  logoFontVariant: LogoFontVariant;
  logoCustomPrimary: string;
  logoCustomSecondary: string;
  logoCustomOutline: string;
  posterStreamBadges: StreamBadgesSetting;
  backdropStreamBadges: StreamBadgesSetting;
  shouldShowPosterQualityBadgesSide: boolean;
  shouldShowPosterQualityBadgesPosition: boolean;
  qualityBadgesSide: QualityBadgesSide;
  posterQualityBadgesPosition: PosterQualityBadgesPosition;
  posterGenrePosition: PosterGenrePosition;
  posterQualityBadgesStyle: RatingStyle;
  backdropQualityBadgesStyle: RatingStyle;
  posterRatingStyle: RatingStyle;
  backdropRatingStyle: RatingStyle;
  thumbnailRatingStyle: RatingStyle;
  logoRatingStyle: RatingStyle;
  posterImageText: 'default' | 'clean' | 'alternative';
  backdropImageText: 'default' | 'clean' | 'alternative';
  posterRatingsLayout: PosterRatingLayout;
  posterRatingsMaxPerSide: number | null;
  backdropRatingsLayout: BackdropRatingLayout;
  backdropRatingsMax: number | null;
  backdropRatingsSize: BackdropRatingsSize;
  thumbnailRatingsLayout: ThumbnailRatingLayout;
  posterVerticalBadgeContent: VerticalBadgeContent;
  backdropVerticalBadgeContent: VerticalBadgeContent;
  thumbnailVerticalBadgeContent: VerticalBadgeContent;
  thumbnailSize: ThumbnailSize;
  ranking: string;
  rankingCountry: string;
  rankingNoBox?: boolean;
  rankingPosition: RankingPosition;
}) => {
  const {
    baseUrl,
    activeToken,
    imageType,
    idPlaceholder,
    tmdbKey,
    mdblistKey,
    simklClientId,
    fanartKey,
    lang,
    posterLang,
    posterAnimeLang,
    backdropLang,
    backdropAnimeLang,
    logoLang,
    logoAnimeLang,
    posterAnimeImageText,
    backdropAnimeImageText,
    posterRatings,
    backdropRatings,
    thumbnailRatings,
    logoRatings,
    logoRatingsMax,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowPosterQualityBadgesSide,
    shouldShowPosterQualityBadgesPosition,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterGenrePosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    thumbnailRatingStyle,
    logoRatingStyle,
    posterImageText,
    backdropImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    backdropRatingsLayout,
    backdropRatingsMax,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    ranking,
    rankingCountry,
    rankingNoBox,
    rankingPosition,
  } = options;

  if (!baseUrl) {
    return '';
  }

  if (activeToken) {
    return `${baseUrl}/${activeToken}/${imageType}/${idPlaceholder}.jpg`;
  }

  if (!tmdbKey || !mdblistKey) {
    return '';
  }

  const params: Array<[string, string]> = [
    ['tmdbKey', tmdbKey || '{tmdb_key}'],
    ['mdblistKey', mdblistKey || '{mdblist_key}'],
    ['lang', '{language_code}'],
  ];

  if (imageType === 'poster' && ranking !== 'off') {
    params.push(['ranking', ranking]);
    if (rankingCountry !== 'global') {
      params.push(['rankingCountry', rankingCountry]);
    }
    if (rankingNoBox) {
      params.push(['rankingNoBox', 'on']);
    }
    if (rankingPosition !== 'auto') {
      params.push(['rankingPosition', rankingPosition]);
    }
  }

  if (simklClientId) {
    params.push(['simklClientId', simklClientId]);
  }
  if (fanartKey) {
    params.push(['fanartKey', fanartKey]);
  }

  if (imageType === 'poster') {
    if (posterLang) {
      params.push(['posterLang', posterLang]);
    }
    if (posterAnimeLang) {
      params.push(['posterAnimeLang', posterAnimeLang]);
    }
    params.push(['posterAnimeImageText', posterAnimeImageText]);
    params.push(['posterRatings', posterRatings]);
    if (posterStreamBadges !== 'auto') {
      params.push(['posterStreamBadges', posterStreamBadges]);
    }
    if (shouldShowPosterQualityBadgesSide && qualityBadgesSide !== 'left') {
      params.push(['qualityBadgesSide', qualityBadgesSide]);
    }
    if (shouldShowPosterQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      params.push(['posterQualityBadgesPosition', posterQualityBadgesPosition]);
    }
    if (posterGenrePosition !== 'off') {
      params.push(['posterGenrePosition', posterGenrePosition]);
    }
    if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      params.push(['posterQualityBadgesStyle', posterQualityBadgesStyle]);
    }
    params.push(['ratingStyle', posterRatingStyle]);
    params.push(['imageText', posterImageText]);
    params.push(['posterRatingsLayout', posterRatingsLayout]);
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      params.push(['posterRatingsMaxPerSide', String(posterRatingsMaxPerSide)]);
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterVerticalBadgeContent !== 'standard') {
      params.push(['posterVerticalBadgeContent', posterVerticalBadgeContent]);
    }
  } else if (imageType === 'backdrop') {
    if (backdropLang) {
      params.push(['backdropLang', backdropLang]);
    }
    if (backdropAnimeLang) {
      params.push(['backdropAnimeLang', backdropAnimeLang]);
    }
    params.push(['backdropAnimeImageText', backdropAnimeImageText]);
    params.push(['backdropRatings', backdropRatings]);
    if (backdropStreamBadges !== 'auto') {
      params.push(['backdropStreamBadges', backdropStreamBadges]);
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      params.push(['backdropQualityBadgesStyle', backdropQualityBadgesStyle]);
    }
    params.push(['ratingStyle', backdropRatingStyle]);
    params.push(['imageText', backdropImageText]);
    params.push(['backdropRatingsLayout', backdropRatingsLayout]);
    params.push(['backdropRatingsSize', backdropRatingsSize]);
    if (backdropRatingsMax !== null) {
      params.push(['backdropRatingsMax', String(backdropRatingsMax)]);
    }
    if (backdropRatingsLayout === 'right-vertical' && backdropVerticalBadgeContent !== 'standard') {
      params.push(['backdropVerticalBadgeContent', backdropVerticalBadgeContent]);
    }
  } else if (imageType === 'thumbnail') {
    params.push(['thumbnailRatings', thumbnailRatings]);
    params.push(['ratingStyle', thumbnailRatingStyle]);
    params.push(['thumbnailRatingsLayout', thumbnailRatingsLayout]);
    params.push(['thumbnailSize', thumbnailSize]);
    if (thumbnailRatingsLayout.endsWith('-vertical') && thumbnailVerticalBadgeContent !== 'standard') {
      params.push(['thumbnailVerticalBadgeContent', thumbnailVerticalBadgeContent]);
    }
  } else {
    if (logoLang) {
      params.push(['logoLang', logoLang]);
    }
    if (logoAnimeLang) {
      params.push(['logoAnimeLang', logoAnimeLang]);
    }
    params.push(['logoRatings', logoRatings]);
    if (logoRatingsMax !== null) {
      params.push(['logoRatingsMax', String(logoRatingsMax)]);
    }
    params.push(['logoMode', logoMode]);
    if (logoMode === 'custom-logo') {
      params.push(['logoFontVariant', logoFontVariant]);
      params.push(['logoPrimary', logoCustomPrimary]);
      params.push(['logoSecondary', logoCustomSecondary]);
      params.push(['logoOutline', logoCustomOutline]);
    }
    params.push(['ratingStyle', logoRatingStyle]);
  }

  const query = params
    .filter(([key, value]) => value !== '' || EMPTY_ENABLED_RATING_QUERY_KEYS.has(key))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return `${baseUrl}/${imageType}/${idPlaceholder}.jpg?${query}`;
};

export const buildAiometadataPatternBlock = (options: {
  baseUrl: string;
  activeToken: string | null;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  configString: string;
  idPattern?: string;
  ranking: string;
  rankingCountry: string;
  rankingNoBox?: boolean;
}) => {
  if (!options.baseUrl) {
    return '';
  }

  if (options.activeToken) {
    return `${options.baseUrl}/${options.activeToken}/${options.imageType}/${options.idPattern || '{imdb_id}'}.jpg`;
  }

  if (!options.configString) {
    return '';
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(decodeBase64Url(options.configString)) as Record<string, unknown>;
  } catch {
    return '';
  }

  const params: Array<[string, string]> = [];
  const THUMBNAIL_SUPPORTED_RATINGS = new Set(['tmdb', 'imdb']);

  const pushIfString = (key: string) => {
    const value = config[key];
    if (
      typeof value === 'string' &&
      (value !== '' || EMPTY_ENABLED_RATING_QUERY_KEYS.has(key))
    ) {
      params.push([key, value]);
    }
  };

  const filterThumbnailRatings = (value: unknown) => {
    if (typeof value !== 'string' || value === '') return '';
    return value
      .split(',')
      .map((provider) => provider.trim().toLowerCase())
      .filter((provider, index, providers) => {
        return THUMBNAIL_SUPPORTED_RATINGS.has(provider) && providers.indexOf(provider) === index;
      })
      .join(',');
  };

  pushIfString('tmdbKey');
  pushIfString('lang');
  if (options.imageType === 'poster') {
    pushIfString('ranking');
    pushIfString('rankingCountry');
    if (config.rankingNoBox === 'on' || config.rankingNoBox === true) {
      params.push(['rankingNoBox', 'on']);
    }
    pushIfString('rankingPosition');
  }

  if (options.imageType !== 'thumbnail') {
    pushIfString('mdblistKey');
    pushIfString('simklClientId');
    pushIfString('fanartKey');
    pushIfString('ratings');
    pushIfString('qualityBadgesSide');
    pushIfString('posterQualityBadgesPosition');
    pushIfString('qualityBadgesStyle');
    pushIfString('posterQualityBadgesStyle');
    pushIfString('backdropQualityBadgesStyle');
    pushIfString('streamBadges');
    pushIfString('posterStreamBadges');
    pushIfString('backdropStreamBadges');
  }

  if (options.imageType === 'poster') {
    pushIfString('posterRatings');
    if (typeof config.posterRatingStyle === 'string' && config.posterRatingStyle !== '') {
      params.push(['ratingStyle', config.posterRatingStyle]);
    }
    if (typeof config.posterImageText === 'string' && config.posterImageText !== '') {
      params.push(['imageText', config.posterImageText]);
    }
    pushIfString('posterRatingsLayout');
    pushIfString('posterGenrePosition');
    if (
      typeof config.posterRatingsMaxPerSide === 'string' ||
      typeof config.posterRatingsMaxPerSide === 'number'
    ) {
      params.push(['posterRatingsMaxPerSide', String(config.posterRatingsMaxPerSide)]);
    }
    pushIfString('posterVerticalBadgeContent');
  } else if (options.imageType === 'backdrop' || options.imageType === 'thumbnail') {
    if (options.imageType === 'backdrop') {
      pushIfString('backdropLang');
      pushIfString('backdropAnimeLang');
      pushIfString('backdropAnimeImageText');
    }
    const typeRatingStyle = options.imageType === 'thumbnail' ? config.thumbnailRatingStyle : config.backdropRatingStyle;
    if (typeof typeRatingStyle === 'string' && typeRatingStyle !== '') {
      params.push(['ratingStyle', typeRatingStyle]);
    }
    if (options.imageType !== 'thumbnail' && typeof config.backdropImageText === 'string' && config.backdropImageText !== '') {
      params.push(['imageText', config.backdropImageText]);
    }
    pushIfString(options.imageType === 'thumbnail' ? 'thumbnailRatingsLayout' : 'backdropRatingsLayout');
    pushIfString(options.imageType === 'thumbnail' ? 'thumbnailVerticalBadgeContent' : 'backdropVerticalBadgeContent');
    if (options.imageType === 'thumbnail') {
      const thumbnailRatingsSource = config.thumbnailRatings ?? config.ratings;
      const thumbnailRatings = filterThumbnailRatings(thumbnailRatingsSource);
      if (typeof thumbnailRatingsSource === 'string') {
        params.push(['ratings', thumbnailRatings]);
      }
      pushIfString('thumbnailSize');
    } else {
      pushIfString('backdropRatings');
      pushIfString('backdropRatingsSize');
    }
  } else {
    pushIfString('logoLang');
    pushIfString('logoAnimeLang');
    pushIfString('logoRatings');
    if (typeof config.logoRatingsMax === 'string' || typeof config.logoRatingsMax === 'number') {
      params.push(['logoRatingsMax', String(config.logoRatingsMax)]);
    }
    if (typeof config.logoMode === 'string' && config.logoMode !== '') {
      params.push(['logoMode', config.logoMode]);
    }
    if (typeof config.logoFontVariant === 'string' && config.logoFontVariant !== '') {
      params.push(['logoFontVariant', config.logoFontVariant]);
    }
    if (typeof config.logoPrimary === 'string' && config.logoPrimary !== '') {
      params.push(['logoPrimary', config.logoPrimary]);
    }
    if (typeof config.logoSecondary === 'string' && config.logoSecondary !== '') {
      params.push(['logoSecondary', config.logoSecondary]);
    }
    if (typeof config.logoOutline === 'string' && config.logoOutline !== '') {
      params.push(['logoOutline', config.logoOutline]);
    }
    if (typeof config.logoRatingStyle === 'string' && config.logoRatingStyle !== '') {
      params.push(['ratingStyle', config.logoRatingStyle]);
    }
  }

  const query = params
    .filter(([key, value]) => value !== '' || EMPTY_ENABLED_RATING_QUERY_KEYS.has(key))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const idPattern =
    options.idPattern ||
    (options.imageType === 'thumbnail'
      ? 'tmdb:{type}:{tmdb_id}:{season}:{episode}'
      : 'tmdb:{type}:{tmdb_id}');
  const basePattern = `${options.baseUrl}/${options.imageType}/${idPattern}.jpg`;
  return query ? `${basePattern}?${query}` : basePattern;
};

export const buildEpisodeThumbnailIdPattern = (provider: AiometadataEpisodeProvider) =>
  provider === 'tvdb' ? 'tvdb:{tvdb_id}:{season}:{episode}' : 'realimdb:{imdb_id}:{season}:{episode}';

export const downloadJsonFile = (payload: Record<string, unknown>, filename: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const maskSensitiveText = (value: string) => value.replace(/[^\s]/g, '*');
export const JUSTWATCH_LANGUAGE_COUNTRY_OVERRIDES: Record<string, string> = {
  en: 'US',
  ar: 'EG',
  es: 'ES',
  pt: 'BR',
};
export const getJustWatchCountryForLanguage = (language: string) => {
  const normalized = normalizeTmdbLanguageCode(language) || language;
  const region = normalized.match(/^[a-z]{2}-([A-Z]{2})$/)?.[1];
  const supportedCountries = new Set(JUSTWATCH_COUNTRY_OPTIONS.map((option) => option.id));
  if (region && supportedCountries.has(region)) return region;
  const base = getTmdbLanguageBase(normalized);
  const mapped = base ? JUSTWATCH_LANGUAGE_COUNTRY_OVERRIDES[base] : null;
  return mapped && supportedCountries.has(mapped) ? mapped : 'global';
};


