'use client';

import { HomePageView, type HomePageViewProps } from '@/components/home-page-view';
import { WorkspacePageView } from '@/components/workspace-page-view';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import {
  RATING_PROVIDER_OPTIONS,
  parseRatingPreferencesAllowEmpty,
  stringifyRatingPreferencesAllowEmpty,
  type RatingPreference,
} from '@/lib/ratingPreferences';
import {
  buildDefaultRatingRows,
  enabledOrderedToRows,
  rowsToEnabledOrdered,
  type RatingProviderRow,
} from '@/lib/ratingRows';
import {
  BACKDROP_RATING_LAYOUT_OPTIONS,
  DEFAULT_BACKDROP_RATING_LAYOUT,
  normalizeBackdropRatingLayout,
  type BackdropRatingLayout,
} from '@/lib/backdropRatingLayout';
import {
  THUMBNAIL_RATING_LAYOUT_OPTIONS,
  DEFAULT_THUMBNAIL_RATING_LAYOUT,
  type ThumbnailRatingLayout,
} from '@/lib/thumbnailRatingLayout';
import {
  THUMBNAIL_SIZE_OPTIONS,
  DEFAULT_THUMBNAIL_SIZE,
  type ThumbnailSize,
} from '@/lib/thumbnailSize';
import {
  BACKDROP_RATINGS_SIZE_OPTIONS,
  DEFAULT_BACKDROP_RATINGS_SIZE,
  normalizeBackdropRatingsSize,
  type BackdropRatingsSize,
} from '@/lib/backdropRatingsSize';
import {
  DEFAULT_POSTER_RATINGS_MAX_PER_SIDE,
  DEFAULT_POSTER_RATING_LAYOUT,
  POSTER_RATING_LAYOUT_OPTIONS,
  isVerticalPosterRatingLayout,
  type PosterRatingLayout,
} from '@/lib/posterRatingLayout';
import {
  DEFAULT_LOGO_RATINGS_MAX,
  normalizeLogoRatingsMax,
} from '@/lib/logoRatingsMax';
import {
  DEFAULT_LOGO_MODE,
  isLogoMode,
  normalizeLogoMode,
  type LogoMode,
} from '@/lib/logoMode';
import {
  DEFAULT_LOGO_FONT_VARIANT,
  isLogoFontVariant,
  type LogoFontVariant,
} from '@/lib/logoFontVariant';
import {
  DEFAULT_LOGO_CUSTOM_PRIMARY,
  DEFAULT_LOGO_CUSTOM_OUTLINE,
  DEFAULT_LOGO_CUSTOM_SECONDARY,
  normalizeHexColor,
} from '@/lib/logoCustomColors';
import {
  DEFAULT_RATING_STYLE,
  RATING_STYLE_OPTIONS,
  type RatingStyle,
} from '@/lib/ratingStyle';
import {
  buildSupportedLanguageList,
  getTmdbLanguageBase,
  normalizeTmdbLanguageCode,
  type SupportedLanguage,
  type TmdbConfigurationLanguage,
} from '@/lib/tmdbLanguage';
import { ERDB_AI_INTEGRATION_PROMPT } from '@/lib/aiIntegrationPrompt';
import {
  normalizeProxyCatalogBooleanOverrides,
  normalizeProxyCatalogKeyList,
  normalizeProxyCatalogNameOverrides,
  type ProxyCatalogDescriptor,
} from '@/lib/proxyCatalog';

export type HomePageMode = 'landing' | 'workspace';

const VISIBLE_RATING_PROVIDER_OPTIONS = RATING_PROVIDER_OPTIONS;
const THUMBNAIL_SUPPORTED_RATINGS: RatingPreference[] = ['tmdb', 'imdb'];
const EPISODE_ID_PATTERN = /^.+:\d+:\d+$/;
const DEFAULT_SERIES_ID = 'tt4574334';
const DEFAULT_THUMBNAIL_ID = 'tt4574334:1:1';
const PROXY_TYPES = ['poster', 'backdrop', 'logo', 'thumbnail'] as const;
const PREVIEW_TYPES = ['poster', 'backdrop', 'logo', 'thumbnail'] as const;
type ProxyType = (typeof PROXY_TYPES)[number];
type PreviewType = (typeof PREVIEW_TYPES)[number];
type ProxyEnabledTypes = Record<ProxyType, boolean>;
type AiometadataPatternType = 'poster' | 'background' | 'logo' | 'episodeThumbnail';
type AiometadataEpisodeProvider = 'tvdb' | 'realimdb';
type ProxySeriesMetadataProvider = 'tmdb' | 'imdb';
type ProxyEpisodeProvider = 'custom' | 'realimdb' | 'tvdb';
type StreamBadgesSetting = 'auto' | 'on' | 'off';
type QualityBadgesSide = 'left' | 'right';
type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
type VerticalBadgeContent = 'standard' | 'stacked';
const DEFAULT_QUALITY_BADGES_STYLE: RatingStyle = 'glass';
const STREAM_BADGE_OPTIONS: Array<{ id: StreamBadgesSetting; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
];
const QUALITY_BADGE_SIDE_OPTIONS: Array<{ id: QualityBadgesSide; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
const POSTER_QUALITY_BADGE_POSITION_OPTIONS: Array<{
  id: PosterQualityBadgesPosition;
  label: string;
}> = [
    { id: 'auto', label: 'Auto' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ];
const TMDB_KEY_STORAGE_KEY = 'erdb_tmdb_key';
const MDBLIST_KEY_STORAGE_KEY = 'erdb_mdblist_key';
const SIMKL_CLIENT_ID_STORAGE_KEY = 'erdb_simkl_client_id';
const ERDB_TOKEN_STORAGE_KEY = 'erdb_active_token';
const PREVIEW_CONFIG_STORAGE_KEY = 'erdb_preview_config';
const EXPORT_CONFIG_VERSION = 1;
const TMDB_LANGUAGE_DOC_EXAMPLES = 'TMDB language code (en, es-ES, es-MX, pt-PT, pt-BR, etc.)';
const RATING_PROVIDER_IDS = new Set(RATING_PROVIDER_OPTIONS.map((option) => option.id));
const isRatingProviderId = (value: string): value is RatingPreference =>
  RATING_PROVIDER_IDS.has(value as RatingPreference);

const isPreviewType = (value: unknown): value is PreviewType =>
  PREVIEW_TYPES.includes(value as PreviewType);
const isProxyType = (value: unknown): value is ProxyType =>
  PROXY_TYPES.includes(value as ProxyType);
const isStreamBadgesSetting = (value: unknown): value is StreamBadgesSetting =>
  value === 'auto' || value === 'on' || value === 'off';
const isQualityBadgesSide = (value: unknown): value is QualityBadgesSide =>
  value === 'left' || value === 'right';
const isPosterQualityBadgesPosition = (value: unknown): value is PosterQualityBadgesPosition =>
  value === 'auto' || value === 'left' || value === 'right';
const isImageText = (value: unknown): value is 'default' | 'clean' | 'alternative' =>
  value === 'default' || value === 'original' || value === 'clean' || value === 'alternative';
const isRatingStyle = (value: unknown): value is RatingStyle =>
  RATING_STYLE_OPTIONS.some((option) => option.id === value);
const isPosterRatingLayout = (value: unknown): value is PosterRatingLayout =>
  POSTER_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
const isBackdropRatingLayout = (value: unknown): value is BackdropRatingLayout =>
  BACKDROP_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
const isThumbnailRatingLayout = (value: unknown): value is ThumbnailRatingLayout =>
  THUMBNAIL_RATING_LAYOUT_OPTIONS.some((option) => option.id === value);
const isProxySeriesMetadataProvider = (value: unknown): value is ProxySeriesMetadataProvider =>
  value === 'tmdb' || value === 'imdb';
const isProxyEpisodeProvider = (value: unknown): value is ProxyEpisodeProvider =>
  value === 'custom' || value === 'realimdb' || value === 'tvdb';
const isAiometadataEpisodeProvider = (value: unknown): value is AiometadataEpisodeProvider =>
  value === 'tvdb' || value === 'realimdb';
const isVerticalBadgeContent = (value: unknown): value is VerticalBadgeContent =>
  value === 'standard' || value === 'stacked';

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

const normalizeManifestUrl = (value: string, allowBareScheme = false) => {
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

const isBareHttpUrl = (value: string) => value === 'http://' || value === 'https://';
const isCinemetaManifestUrl = (value: string) => {
  try {
    return /(^|[-.])cinemeta\.strem\.io$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

const safeLocalStorageGet = (key: string) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
};

const safeLocalStorageRemove = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
};

const subscribeToNothing = () => () => { };

const useClientOrigin = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => ''
  );

const encodeBase64Url = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const tryParseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const parseImportedConfigPayload = (value: string) => {
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

const EMPTY_ENABLED_RATING_QUERY_KEYS = new Set([
  'ratings',
  'posterRatings',
  'backdropRatings',
  'thumbnailRatings',
  'logoRatings',
]);

const buildAiometadataPattern = (options: {
  baseUrl: string;
  activeToken: string | null;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  idPlaceholder: string;
  tmdbKey: string;
  mdblistKey: string;
  simklClientId: string;
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
  backdropRatingsSize: BackdropRatingsSize;
  thumbnailRatingsLayout: ThumbnailRatingLayout;
  posterVerticalBadgeContent: VerticalBadgeContent;
  backdropVerticalBadgeContent: VerticalBadgeContent;
  thumbnailVerticalBadgeContent: VerticalBadgeContent;
  thumbnailSize: ThumbnailSize;
}) => {
  const {
    baseUrl,
    activeToken,
    imageType,
    idPlaceholder,
    tmdbKey,
    mdblistKey,
    simklClientId,
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
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
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

  if (simklClientId) {
    params.push(['simklClientId', simklClientId]);
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

const buildAiometadataPatternBlock = (options: {
  baseUrl: string;
  activeToken: string | null;
  imageType: 'poster' | 'backdrop' | 'logo' | 'thumbnail';
  configString: string;
  idPattern?: string;
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

  if (options.imageType !== 'thumbnail') {
    pushIfString('mdblistKey');
    pushIfString('simklClientId');
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

const buildEpisodeThumbnailIdPattern = (provider: AiometadataEpisodeProvider) =>
  provider === 'tvdb' ? 'tvdb:{tvdb_id}:{season}:{episode}' : 'realimdb:{imdb_id}:{season}:{episode}';

const downloadJsonFile = (payload: Record<string, unknown>, filename: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const maskSensitiveText = (value: string) => value.replace(/[^\s]/g, '*');

export default function HomePage({
  mode = 'landing',
  initialToken = null,
  initialConfig = null,
}: {
  mode?: HomePageMode;
  initialToken?: string | null;
  initialConfig?: Record<string, unknown> | null;
}) {
  const [previewType, setPreviewType] = useState<PreviewType>('poster');
  const [mediaId, setMediaId] = useState(DEFAULT_SERIES_ID);
  const [lang, setLang] = useState('en');
  const [posterLang, setPosterLang] = useState('');
  const [posterAnimeLang, setPosterAnimeLang] = useState('');
  const [backdropLang, setBackdropLang] = useState('');
  const [backdropAnimeLang, setBackdropAnimeLang] = useState('');
  const [logoLang, setLogoLang] = useState('');
  const [logoAnimeLang, setLogoAnimeLang] = useState('');
  const [posterImageText, setPosterImageText] = useState<'default' | 'clean' | 'alternative'>('clean');
  const [posterAnimeImageText, setPosterAnimeImageText] = useState<'default' | 'clean' | 'alternative'>('clean');
  const [backdropImageText, setBackdropImageText] = useState<'default' | 'clean' | 'alternative'>('clean');
  const [backdropAnimeImageText, setBackdropAnimeImageText] = useState<'default' | 'clean' | 'alternative'>('clean');
  const [posterRatingRows, setPosterRatingRows] = useState<RatingProviderRow[]>(buildDefaultRatingRows);
  const [backdropRatingRows, setBackdropRatingRows] = useState<RatingProviderRow[]>(buildDefaultRatingRows);
  const [thumbnailRatingRows, setThumbnailRatingRows] = useState<RatingProviderRow[]>(
    enabledOrderedToRows(THUMBNAIL_SUPPORTED_RATINGS)
  );
  const [logoRatingRows, setLogoRatingRows] = useState<RatingProviderRow[]>(buildDefaultRatingRows);

  const posterRatingPreferences = useMemo(() => rowsToEnabledOrdered(posterRatingRows), [posterRatingRows]);
  const backdropRatingPreferences = useMemo(() => rowsToEnabledOrdered(backdropRatingRows), [backdropRatingRows]);
  const thumbnailRatingPreferences = useMemo(
    () =>
      rowsToEnabledOrdered(thumbnailRatingRows).filter((rating): rating is RatingPreference =>
        THUMBNAIL_SUPPORTED_RATINGS.includes(rating)
      ),
    [thumbnailRatingRows]
  );
  const logoRatingPreferences = useMemo(() => rowsToEnabledOrdered(logoRatingRows), [logoRatingRows]);
  const [posterStreamBadges, setPosterStreamBadges] = useState<StreamBadgesSetting>('auto');
  const [backdropStreamBadges, setBackdropStreamBadges] = useState<StreamBadgesSetting>('auto');
  const [qualityBadgesSide, setQualityBadgesSide] = useState<QualityBadgesSide>('left');
  const [posterQualityBadgesPosition, setPosterQualityBadgesPosition] =
    useState<PosterQualityBadgesPosition>('auto');
  const [posterQualityBadgesStyle, setPosterQualityBadgesStyle] = useState<RatingStyle>(DEFAULT_QUALITY_BADGES_STYLE);
  const [backdropQualityBadgesStyle, setBackdropQualityBadgesStyle] = useState<RatingStyle>(DEFAULT_QUALITY_BADGES_STYLE);
  const [posterRatingsLayout, setPosterRatingsLayout] = useState<PosterRatingLayout>('bottom');
  const [backdropRatingsLayout, setBackdropRatingsLayout] = useState<BackdropRatingLayout>(DEFAULT_BACKDROP_RATING_LAYOUT);
  const [backdropRatingsSize, setBackdropRatingsSize] = useState<BackdropRatingsSize>(DEFAULT_BACKDROP_RATINGS_SIZE);
  const [thumbnailRatingsLayout, setThumbnailRatingsLayout] = useState<ThumbnailRatingLayout>(DEFAULT_THUMBNAIL_RATING_LAYOUT);
  const [posterVerticalBadgeContent, setPosterVerticalBadgeContent] = useState<VerticalBadgeContent>('standard');
  const [backdropVerticalBadgeContent, setBackdropVerticalBadgeContent] = useState<VerticalBadgeContent>('standard');
  const [thumbnailVerticalBadgeContent, setThumbnailVerticalBadgeContent] = useState<VerticalBadgeContent>('standard');
  const [thumbnailSize, setThumbnailSize] = useState<ThumbnailSize>(DEFAULT_THUMBNAIL_SIZE);
  const [posterRatingStyle, setPosterRatingStyle] = useState<RatingStyle>(DEFAULT_RATING_STYLE);
  const [backdropRatingStyle, setBackdropRatingStyle] = useState<RatingStyle>(DEFAULT_RATING_STYLE);
  const [thumbnailRatingStyle, setThumbnailRatingStyle] = useState<RatingStyle>(DEFAULT_RATING_STYLE);
  const [logoRatingStyle, setLogoRatingStyle] = useState<RatingStyle>('plain');
  const [posterRatingsMaxPerSide, setPosterRatingsMaxPerSide] = useState<number | null>(DEFAULT_POSTER_RATINGS_MAX_PER_SIDE);
  const [logoRatingsMax, setLogoRatingsMax] = useState<number | null>(DEFAULT_LOGO_RATINGS_MAX);
  const [logoMode, setLogoMode] = useState<LogoMode>(DEFAULT_LOGO_MODE);
  const [logoFontVariant, setLogoFontVariant] = useState<LogoFontVariant>(DEFAULT_LOGO_FONT_VARIANT);
  const [logoCustomPrimary, setLogoCustomPrimary] = useState(DEFAULT_LOGO_CUSTOM_PRIMARY);
  const [logoCustomSecondary, setLogoCustomSecondary] = useState(DEFAULT_LOGO_CUSTOM_SECONDARY);
  const [logoCustomOutline, setLogoCustomOutline] = useState(DEFAULT_LOGO_CUSTOM_OUTLINE);
  const [tmdbLanguages, setTmdbLanguages] = useState<TmdbConfigurationLanguage[]>([]);
  const [tmdbPrimaryTranslations, setTmdbPrimaryTranslations] = useState<string[]>([]);
  const [mdblistKey, setMdblistKey] = useState('');
  const [tmdbKey, setTmdbKey] = useState('');
  const [simklClientId, setSimklClientId] = useState('');
  const [proxyManifestUrl, setProxyManifestUrl] = useState('');
  const [proxySeriesMetadataProvider, setProxySeriesMetadataProvider] =
    useState<ProxySeriesMetadataProvider>('tmdb');
  const [proxyAiometadataProvider, setProxyAiometadataProvider] = useState<ProxyEpisodeProvider>('custom');
  const [proxyEnabledTypes, setProxyEnabledTypes] = useState<ProxyEnabledTypes>({
    poster: true,
    backdrop: true,
    logo: true,
    thumbnail: true,
  });
  const [proxyTranslateMeta, setProxyTranslateMeta] = useState(false);
  const [proxyCatalogs, setProxyCatalogs] = useState<ProxyCatalogDescriptor[]>([]);
  const [proxyCatalogNames, setProxyCatalogNames] = useState<Record<string, string>>({});
  const [proxyHiddenCatalogs, setProxyHiddenCatalogs] = useState<string[]>([]);
  const [proxySearchDisabledCatalogs, setProxySearchDisabledCatalogs] = useState<string[]>([]);
  const [proxyDiscoverOnlyCatalogs, setProxyDiscoverOnlyCatalogs] = useState<Record<string, boolean>>({});
  const [proxyCatalogsStatus, setProxyCatalogsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [proxyCatalogsError, setProxyCatalogsError] = useState('');
  const [proxyCopied, setProxyCopied] = useState(false);
  const [showProxyUrl, setShowProxyUrl] = useState(false);
  const [aiometadataCopiedType, setAiometadataCopiedType] = useState<AiometadataPatternType | null>(null);
  const [aiometadataEpisodeProvider, setAiometadataEpisodeProvider] = useState<AiometadataEpisodeProvider>('realimdb');
  const [currentVersion, setCurrentVersion] = useState('0.3.14');
  const [githubPackageVersion, setGithubPackageVersion] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'with' | 'without'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const [activeToken, setActiveToken] = useState<string | null>(initialToken);
  const [configSaveStatus, setConfigSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const navRef = useRef<HTMLElement | null>(null);
  const baseUrl = normalizeBaseUrl(useClientOrigin());
  const hasTmdbKey = tmdbKey.length > 10;
  const supportedLanguages: SupportedLanguage[] = useMemo(
    () =>
      buildSupportedLanguageList({
        languages: hasTmdbKey ? tmdbLanguages : [],
        primaryTranslations: hasTmdbKey ? tmdbPrimaryTranslations : [],
      }),
    [hasTmdbKey, tmdbLanguages, tmdbPrimaryTranslations]
  );
  const effectiveLang = useMemo(() => {
    const normalizedLang = normalizeTmdbLanguageCode(lang) || lang;

    if (!hasTmdbKey || supportedLanguages.length === 0) {
      return normalizedLang;
    }

    if (normalizedLang && supportedLanguages.some((language) => language.code === normalizedLang)) {
      return normalizedLang;
    }

    const baseCode = getTmdbLanguageBase(normalizedLang);
    return (
      (baseCode
        ? supportedLanguages.find((language) => getTmdbLanguageBase(language.code) === baseCode)?.code
        : null) ||
      supportedLanguages.find((language) => language.code === 'en')?.code ||
      supportedLanguages[0]?.code ||
      normalizedLang
    );
  }, [hasTmdbKey, lang, supportedLanguages]);
  const effectivePosterLang = useMemo(() => {
    if (posterLang === 'original') {
      return 'original';
    }
    const normalizedPosterLang = normalizeTmdbLanguageCode(posterLang) || posterLang;
    if (!normalizedPosterLang) {
      return effectiveLang;
    }
    return normalizedPosterLang;
  }, [effectiveLang, hasTmdbKey, posterLang, supportedLanguages]);
  const effectivePosterAnimeLang = useMemo(() => {
    if (!posterAnimeLang) {
      return effectivePosterLang;
    }
    if (posterAnimeLang === 'original') {
      return 'original';
    }
    const normalizedPosterAnimeLang = normalizeTmdbLanguageCode(posterAnimeLang) || posterAnimeLang;
    return normalizedPosterAnimeLang || effectivePosterLang;
  }, [effectivePosterLang, posterAnimeLang]);
  const effectiveBackdropLang = useMemo(() => {
    if (backdropLang === 'original') {
      return 'original';
    }
    const normalizedBackdropLang = normalizeTmdbLanguageCode(backdropLang) || backdropLang;
    if (!normalizedBackdropLang) {
      return effectiveLang;
    }
    return normalizedBackdropLang;
  }, [backdropLang, effectiveLang]);
  const effectiveBackdropAnimeLang = useMemo(() => {
    if (!backdropAnimeLang) {
      return effectiveBackdropLang;
    }
    if (backdropAnimeLang === 'original') {
      return 'original';
    }
    const normalizedBackdropAnimeLang = normalizeTmdbLanguageCode(backdropAnimeLang) || backdropAnimeLang;
    return normalizedBackdropAnimeLang || effectiveBackdropLang;
  }, [backdropAnimeLang, effectiveBackdropLang]);
  const effectiveLogoLang = useMemo(() => {
    if (logoLang === 'original') {
      return 'original';
    }
    const normalizedLogoLang = normalizeTmdbLanguageCode(logoLang) || logoLang;
    if (!normalizedLogoLang) {
      return effectiveLang;
    }
    return normalizedLogoLang;
  }, [effectiveLang, logoLang]);
  const effectiveLogoAnimeLang = useMemo(() => {
    if (!logoAnimeLang) {
      return effectiveLogoLang;
    }
    if (logoAnimeLang === 'original') {
      return 'original';
    }
    const normalizedLogoAnimeLang = normalizeTmdbLanguageCode(logoAnimeLang) || logoAnimeLang;
    return normalizedLogoAnimeLang || effectiveLogoLang;
  }, [effectiveLogoLang, logoAnimeLang]);
  const sanitizedProxyCatalogNames = useMemo(
    () => normalizeProxyCatalogNameOverrides(proxyCatalogNames) || {},
    [proxyCatalogNames]
  );
  const sanitizedProxyHiddenCatalogs = useMemo(
    () => normalizeProxyCatalogKeyList(proxyHiddenCatalogs) || [],
    [proxyHiddenCatalogs]
  );
  const sanitizedProxySearchDisabledCatalogs = useMemo(
    () => normalizeProxyCatalogKeyList(proxySearchDisabledCatalogs) || [],
    [proxySearchDisabledCatalogs]
  );
  const sanitizedProxyDiscoverOnlyCatalogs = useMemo(
    () => normalizeProxyCatalogBooleanOverrides(proxyDiscoverOnlyCatalogs) || {},
    [proxyDiscoverOnlyCatalogs]
  );

  const [copied, setCopied] = useState(false);
  const shouldShowPosterQualityBadgesSide = posterRatingsLayout === 'top-bottom';
  const shouldShowPosterQualityBadgesPosition =
    posterRatingsLayout === 'top' || posterRatingsLayout === 'bottom';
  const shouldShowQualityBadgesSide = previewType === 'poster' && shouldShowPosterQualityBadgesSide;
  const shouldShowQualityBadgesPosition =
    previewType === 'poster' && shouldShowPosterQualityBadgesPosition;
  const shouldShowVerticalBadgeContent =
    (previewType === 'poster' && isVerticalPosterRatingLayout(posterRatingsLayout)) ||
    (previewType === 'backdrop' && backdropRatingsLayout === 'right-vertical') ||
    (previewType === 'thumbnail' && thumbnailRatingsLayout.endsWith('-vertical'));
  const qualityBadgeTypeLabel = previewType === 'backdrop' || previewType === 'thumbnail' ? 'Backdrop' : 'Poster';
  const activeStreamBadges =
    previewType === 'backdrop' || previewType === 'thumbnail' ? backdropStreamBadges : posterStreamBadges;
  const setActiveStreamBadges =
    previewType === 'backdrop' || previewType === 'thumbnail'
      ? setBackdropStreamBadges
      : setPosterStreamBadges;
  const activeQualityBadgesStyle =
    previewType === 'backdrop' || previewType === 'thumbnail'
      ? backdropQualityBadgesStyle
      : posterQualityBadgesStyle;
  const setActiveQualityBadgesStyle =
    previewType === 'backdrop' || previewType === 'thumbnail'
      ? setBackdropQualityBadgesStyle
      : setPosterQualityBadgesStyle;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTmdbKey = safeLocalStorageGet(TMDB_KEY_STORAGE_KEY);
    const storedMdblistKey = safeLocalStorageGet(MDBLIST_KEY_STORAGE_KEY);
    const storedSimklClientId = safeLocalStorageGet(SIMKL_CLIENT_ID_STORAGE_KEY);
    const storedToken = safeLocalStorageGet(ERDB_TOKEN_STORAGE_KEY);
    if (!storedTmdbKey && !storedMdblistKey && !storedSimklClientId && !storedToken) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (storedTmdbKey) {
        setTmdbKey(storedTmdbKey);
      }
      if (storedMdblistKey) {
        setMdblistKey(storedMdblistKey);
      }
      if (storedSimklClientId) {
        setSimklClientId(storedSimklClientId);
      }
      if (!initialToken && storedToken) {
        setActiveToken(storedToken);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [initialToken]);

  useEffect(() => {
    if (activeToken) {
      safeLocalStorageSet(ERDB_TOKEN_STORAGE_KEY, activeToken);
    } else {
      safeLocalStorageRemove(ERDB_TOKEN_STORAGE_KEY);
    }
  }, [activeToken]);

  useEffect(() => {
    if (tmdbKey) {
      safeLocalStorageSet(TMDB_KEY_STORAGE_KEY, tmdbKey);
    } else {
      safeLocalStorageRemove(TMDB_KEY_STORAGE_KEY);
    }
  }, [tmdbKey]);

  useEffect(() => {
    if (mdblistKey) {
      safeLocalStorageSet(MDBLIST_KEY_STORAGE_KEY, mdblistKey);
    } else {
      safeLocalStorageRemove(MDBLIST_KEY_STORAGE_KEY);
    }
  }, [mdblistKey]);

  useEffect(() => {
    if (simklClientId) {
      safeLocalStorageSet(SIMKL_CLIENT_ID_STORAGE_KEY, simklClientId);
    } else {
      safeLocalStorageRemove(SIMKL_CLIENT_ID_STORAGE_KEY);
    }
  }, [simklClientId]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/version', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json();
      })
      .then((payload) => {
        if (cancelled || !payload || typeof payload !== 'object') return;
        if (typeof payload.currentVersion === 'string' && payload.currentVersion) {
          setCurrentVersion(payload.currentVersion);
        }
        if (typeof payload.githubPackageVersion === 'string' && payload.githubPackageVersion) {
          setGithubPackageVersion(payload.githubPackageVersion);
        }
        if (typeof payload.repoUrl === 'string' && payload.repoUrl) {
          setRepoUrl(payload.repoUrl);
        }
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToHash = useCallback((hash: string, behavior: ScrollBehavior = 'smooth') => {
    if (typeof window === 'undefined') return;
    if (!hash || !hash.startsWith('#')) return;
    const target = document.querySelector(hash);
    if (!target) return;
    const navHeight = navRef.current?.getBoundingClientRect().height ?? 0;
    const offset = navHeight + 12;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top, behavior });
  }, []);

  const handleAnchorClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      const href = event.currentTarget.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      event.preventDefault();
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', href);
      }
      scrollToHash(href);
    },
    [scrollToHash]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => scrollToHash(window.location.hash);
    if (window.location.hash) {
      requestAnimationFrame(() => scrollToHash(window.location.hash, 'auto'));
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [scrollToHash]);

  useEffect(() => {
    let cancelled = false;

    if (!hasTmdbKey) {
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      fetch(`https://api.themoviedb.org/3/configuration/languages?api_key=${tmdbKey}`).then((res) => res.json()),
      fetch(`https://api.themoviedb.org/3/configuration/primary_translations?api_key=${tmdbKey}`).then((res) =>
        res.json()
      ),
    ])
      .then(([languagesResponse, primaryTranslationsResponse]) => {
        if (cancelled) {
          return;
        }

        setTmdbLanguages(Array.isArray(languagesResponse) ? languagesResponse : []);
        setTmdbPrimaryTranslations(
          Array.isArray(primaryTranslationsResponse)
            ? primaryTranslationsResponse.filter((entry): entry is string => typeof entry === 'string')
            : []
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setTmdbLanguages([]);
        setTmdbPrimaryTranslations([]);
      });

    return () => {
      cancelled = true;
    };
  }, [hasTmdbKey, tmdbKey]);

  useEffect(() => {
    let cancelled = false;
    const manifestUrl = normalizeManifestUrl(proxyManifestUrl);

    if (!manifestUrl || isBareHttpUrl(manifestUrl)) {
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setProxyCatalogsStatus('loading');
      setProxyCatalogsError('');
    });

    fetch(`/api/proxy-manifest?url=${encodeURIComponent(manifestUrl)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { catalogs?: ProxyCatalogDescriptor[]; error?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            typeof payload?.error === 'string' && payload.error
              ? payload.error
              : 'Unable to load catalogs from the source manifest.'
          );
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const catalogs = Array.isArray(payload?.catalogs) ? payload.catalogs : [];
        setProxyCatalogs(catalogs);
        const allowedKeys = new Set(catalogs.map((catalog) => catalog.key));
        setProxyCatalogNames((current) => {
          return Object.fromEntries(
            Object.entries(normalizeProxyCatalogNameOverrides(current) || {}).filter(([key]) =>
              allowedKeys.has(key)
            )
          );
        });
        setProxyHiddenCatalogs((current) =>
          (normalizeProxyCatalogKeyList(current) || []).filter((key) => allowedKeys.has(key))
        );
        setProxySearchDisabledCatalogs((current) =>
          (normalizeProxyCatalogKeyList(current) || []).filter((key) => allowedKeys.has(key))
        );
        setProxyDiscoverOnlyCatalogs((current) =>
          Object.fromEntries(
            Object.entries(normalizeProxyCatalogBooleanOverrides(current) || {}).filter(([key]) =>
              allowedKeys.has(key)
            )
          )
        );
        setProxyCatalogsStatus('ready');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setProxyCatalogs([]);
        setProxyCatalogsStatus('error');
        setProxyCatalogsError(
          error instanceof Error && error.message
            ? error.message
            : 'Unable to load catalogs from the source manifest.'
        );
      });

    return () => {
      cancelled = true;
    };
  }, [proxyManifestUrl]);

  const handleCopyPrompt = useCallback(() => {
    navigator.clipboard.writeText(ERDB_AI_INTEGRATION_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const previewUrl = useMemo(() => {
    const ratingPreferencesForType =
      previewType === 'poster'
        ? posterRatingPreferences
        : previewType === 'backdrop'
          ? backdropRatingPreferences
          : previewType === 'thumbnail'
            ? thumbnailRatingPreferences
            : logoRatingPreferences;
    const ratingsQuery = stringifyRatingPreferencesAllowEmpty(ratingPreferencesForType);
    const ratingStyleForType =
      previewType === 'poster'
        ? posterRatingStyle
        : previewType === 'backdrop'
          ? backdropRatingStyle
          : previewType === 'thumbnail'
            ? thumbnailRatingStyle
            : logoRatingStyle;
    const imageTextForType =
      previewType === 'backdrop' || previewType === 'thumbnail' ? backdropImageText : posterImageText;
    const streamBadgesForType =
      previewType === 'backdrop' || previewType === 'thumbnail' ? backdropStreamBadges : posterStreamBadges;
    const qualityBadgesStyleForType =
      previewType === 'backdrop' || previewType === 'thumbnail'
        ? backdropQualityBadgesStyle
        : posterQualityBadgesStyle;
    const query = new URLSearchParams({
      ratingStyle: ratingStyleForType,
      lang: effectiveLang,
    });
    if (previewType === 'poster') {
      if (posterLang) {
        query.set('posterLang', effectivePosterLang);
      }
      if (posterAnimeLang) {
        query.set('posterAnimeLang', effectivePosterAnimeLang);
      }
      query.set('posterAnimeImageText', posterAnimeImageText);
      query.set('posterRatings', ratingsQuery);
    } else if (previewType === 'backdrop') {
      if (backdropLang) {
        query.set('backdropLang', effectiveBackdropLang);
      }
      if (backdropAnimeLang) {
        query.set('backdropAnimeLang', effectiveBackdropAnimeLang);
      }
      query.set('backdropAnimeImageText', backdropAnimeImageText);
      query.set('backdropRatings', ratingsQuery);
    } else if (previewType === 'thumbnail') {
      query.set('thumbnailRatings', ratingsQuery);
    } else {
      if (logoLang) {
        query.set('logoLang', effectiveLogoLang);
      }
      if (logoAnimeLang) {
        query.set('logoAnimeLang', effectiveLogoAnimeLang);
      }
      query.set('logoRatings', ratingsQuery);
      if (logoRatingsMax !== null) {
        query.set('logoRatingsMax', String(logoRatingsMax));
      }
      query.set('logoMode', logoMode);
      if (logoMode === 'custom-logo') {
        query.set('logoFontVariant', logoFontVariant);
        query.set('logoPrimary', logoCustomPrimary);
        query.set('logoSecondary', logoCustomSecondary);
        query.set('logoOutline', logoCustomOutline);
      }
    }
    if (previewType !== 'logo' && previewType !== 'thumbnail' && streamBadgesForType !== 'auto') {
      query.set(
        previewType === 'backdrop'
          ? 'backdropStreamBadges'
          : 'posterStreamBadges',
        streamBadgesForType
      );
    }
    if (shouldShowQualityBadgesSide && qualityBadgesSide !== 'left') {
      query.set('qualityBadgesSide', qualityBadgesSide);
    }
    if (shouldShowQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      query.set('posterQualityBadgesPosition', posterQualityBadgesPosition);
    }
    if (previewType !== 'logo' && previewType !== 'thumbnail' && qualityBadgesStyleForType !== DEFAULT_QUALITY_BADGES_STYLE) {
      query.set(
        previewType === 'backdrop'
          ? 'backdropQualityBadgesStyle'
          : 'posterQualityBadgesStyle',
        qualityBadgesStyleForType
      );
    }

    if (mdblistKey) {
      query.set('mdblistKey', mdblistKey);
    }
    if (simklClientId) {
      query.set('simklClientId', simklClientId);
    }
    if (tmdbKey) {
      query.set('tmdbKey', tmdbKey);
    }

    if (previewType === 'poster' || previewType === 'backdrop') {
      query.set('imageText', imageTextForType);
    }
    if (previewType === 'poster') {
      query.set('posterRatingsLayout', posterRatingsLayout);
      if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
        query.set('posterRatingsMaxPerSide', String(posterRatingsMaxPerSide));
      }
      if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterVerticalBadgeContent !== 'standard') {
        query.set('posterVerticalBadgeContent', posterVerticalBadgeContent);
      }
    } else if (previewType === 'backdrop' || previewType === 'thumbnail') {
        query.set(
          previewType === 'thumbnail' ? 'thumbnailRatingsLayout' : 'backdropRatingsLayout',
          previewType === 'thumbnail' ? thumbnailRatingsLayout : backdropRatingsLayout
        );
        if (previewType === 'backdrop') {
          query.set('backdropRatingsSize', backdropRatingsSize);
        }
        if (
          previewType === 'backdrop' &&
        backdropRatingsLayout === 'right-vertical' &&
        backdropVerticalBadgeContent !== 'standard'
      ) {
        query.set('backdropVerticalBadgeContent', backdropVerticalBadgeContent);
      }
      if (
        previewType === 'thumbnail' &&
        thumbnailRatingsLayout.endsWith('-vertical') &&
        thumbnailVerticalBadgeContent !== 'standard'
      ) {
        query.set('thumbnailVerticalBadgeContent', thumbnailVerticalBadgeContent);
      }
      if (previewType === 'thumbnail') {
        query.set('thumbnailSize', thumbnailSize);
        query.set('previewVariant', `${thumbnailSize}-${thumbnailRatingsLayout}`);
      }
    }

    if (!baseUrl) {
      return '';
    }
    return `${baseUrl}/${previewType}/${mediaId}.jpg?${query.toString()}`;
  }, [
    previewType,
    mediaId,
    effectiveLang,
    effectivePosterLang,
    effectivePosterAnimeLang,
    effectiveBackdropLang,
    effectiveBackdropAnimeLang,
    effectiveLogoLang,
    effectiveLogoAnimeLang,
    posterLang,
    posterAnimeLang,
    backdropLang,
    backdropAnimeLang,
    logoLang,
    logoAnimeLang,
    posterImageText,
    posterAnimeImageText,
    backdropImageText,
    backdropAnimeImageText,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowQualityBadgesSide,
    shouldShowQualityBadgesPosition,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    thumbnailRatingStyle,
    baseUrl,
    mdblistKey,
    simklClientId,
    tmdbKey,
  ]);

  const configString = useMemo(() => {
    const tmdb = tmdbKey.trim();
    const mdb = mdblistKey.trim();
    const simkl = simklClientId.trim();
    if (!baseUrl || !tmdb || !mdb) {
      return '';
    }

    const config: Record<string, string | number> = {
      erdbBase: baseUrl,
      baseUrl: baseUrl,
      tmdbKey: tmdb,
      mdblistKey: mdb,
    };
    if (simkl) {
      config.simklClientId = simkl;
    }

    const posterRatingsQuery = stringifyRatingPreferencesAllowEmpty(posterRatingPreferences);
    const backdropRatingsQuery = stringifyRatingPreferencesAllowEmpty(backdropRatingPreferences);
    const thumbnailRatingsQuery = stringifyRatingPreferencesAllowEmpty(thumbnailRatingPreferences);
    const logoRatingsQuery = stringifyRatingPreferencesAllowEmpty(logoRatingPreferences);
    const ratingsMatch =
      posterRatingsQuery === backdropRatingsQuery &&
      posterRatingsQuery === thumbnailRatingsQuery &&
      posterRatingsQuery === logoRatingsQuery;
    if (ratingsMatch) {
      config.ratings = posterRatingsQuery;
    } else {
      config.posterRatings = posterRatingsQuery;
      config.backdropRatings = backdropRatingsQuery;
      config.thumbnailRatings = thumbnailRatingsQuery;
      config.logoRatings = logoRatingsQuery;
    }
    if (effectiveLang) {
      config.lang = effectiveLang;
    }
    if (posterAnimeImageText) {
      config.posterAnimeImageText = posterAnimeImageText;
    }
    if (backdropAnimeImageText) {
      config.backdropAnimeImageText = backdropAnimeImageText;
    }
    if (posterLang) {
      config.posterLang = effectivePosterLang;
    }
    if (posterAnimeLang) {
      config.posterAnimeLang = effectivePosterAnimeLang;
    }
    if (backdropLang) {
      config.backdropLang = effectiveBackdropLang;
    }
    if (backdropAnimeLang) {
      config.backdropAnimeLang = effectiveBackdropAnimeLang;
    }
    if (logoLang) {
      config.logoLang = effectiveLogoLang;
    }
    if (logoAnimeLang) {
      config.logoAnimeLang = effectiveLogoAnimeLang;
    }
    if (posterStreamBadges !== 'auto') {
      config.posterStreamBadges = posterStreamBadges;
    }
    if (backdropStreamBadges !== 'auto') {
      config.backdropStreamBadges = backdropStreamBadges;
    }
    if (shouldShowPosterQualityBadgesSide && qualityBadgesSide !== 'left') {
      config.qualityBadgesSide = qualityBadgesSide;
    }
    if (shouldShowPosterQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      config.posterQualityBadgesPosition = posterQualityBadgesPosition;
    }
    if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.posterQualityBadgesStyle = posterQualityBadgesStyle;
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.backdropQualityBadgesStyle = backdropQualityBadgesStyle;
    }
    if (posterRatingStyle) {
      config.posterRatingStyle = posterRatingStyle;
    }
    if (backdropRatingStyle) {
      config.backdropRatingStyle = backdropRatingStyle;
    }
    if (thumbnailRatingStyle) {
      config.thumbnailRatingStyle = thumbnailRatingStyle;
    }
    if (logoRatingStyle) {
      config.logoRatingStyle = logoRatingStyle;
    }
    if (posterImageText) {
      config.posterImageText = posterImageText;
    }
    if (backdropImageText) {
      config.backdropImageText = backdropImageText;
    }
    if (posterRatingsLayout) {
      config.posterRatingsLayout = posterRatingsLayout;
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = posterRatingsMaxPerSide;
    }
    if (logoRatingsMax !== null) {
      config.logoRatingsMax = logoRatingsMax;
    }
    if (logoMode !== DEFAULT_LOGO_MODE) {
      config.logoMode = logoMode;
    }
    if (logoMode === 'custom-logo') {
      config.logoFontVariant = logoFontVariant;
      config.logoPrimary = logoCustomPrimary;
      config.logoSecondary = logoCustomSecondary;
      config.logoOutline = logoCustomOutline;
    }
    if (backdropRatingsLayout) {
      config.backdropRatingsLayout = backdropRatingsLayout;
    }
    if (backdropRatingsSize) {
      config.backdropRatingsSize = backdropRatingsSize;
    }
    if (thumbnailRatingsLayout) {
      config.thumbnailRatingsLayout = thumbnailRatingsLayout;
    }
    if (thumbnailSize) {
      config.thumbnailSize = thumbnailSize;
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterVerticalBadgeContent !== 'standard') {
      config.posterVerticalBadgeContent = posterVerticalBadgeContent;
    }
    if (
      (backdropRatingsLayout === 'right-vertical' || thumbnailRatingsLayout.endsWith('-vertical')) &&
      backdropVerticalBadgeContent !== 'standard'
    ) {
      config.backdropVerticalBadgeContent = backdropVerticalBadgeContent;
    }
    if (
      thumbnailRatingsLayout.endsWith('-vertical') &&
      thumbnailVerticalBadgeContent !== 'standard'
    ) {
      config.thumbnailVerticalBadgeContent = thumbnailVerticalBadgeContent;
    }

    return encodeBase64Url(JSON.stringify(config));
  }, [
    baseUrl,
    tmdbKey,
    mdblistKey,
    simklClientId,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowPosterQualityBadgesSide,
    shouldShowPosterQualityBadgesPosition,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    effectiveLang,
    effectivePosterLang,
    posterLang,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    posterImageText,
    posterAnimeImageText,
    backdropImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    thumbnailRatingStyle,
  ]);

  const proxyUrl = useMemo(() => {
    if (!baseUrl) {
      return '';
    }
    const manifestUrl = normalizeManifestUrl(proxyManifestUrl);
    if (!manifestUrl || isBareHttpUrl(manifestUrl)) {
      return '';
    }

    const isAiometadataManifest = manifestUrl.toLowerCase().includes('aiometadata');
    const isCinemetaManifest = isCinemetaManifestUrl(manifestUrl);

    if (activeToken) {
      const tokenProxyConfig: Record<string, unknown> = {
        url: manifestUrl,
        erdbBase: baseUrl,
        posterEnabled: proxyEnabledTypes.poster,
        backdropEnabled: proxyEnabledTypes.backdrop,
        logoEnabled: proxyEnabledTypes.logo,
        thumbnailEnabled: proxyEnabledTypes.thumbnail,
      };

      if (proxyTranslateMeta) {
        tokenProxyConfig.translateMeta = true;
      }
      if (Object.keys(sanitizedProxyCatalogNames).length > 0) {
        tokenProxyConfig.catalogNames = sanitizedProxyCatalogNames;
      }
      if (sanitizedProxyHiddenCatalogs.length > 0) {
        tokenProxyConfig.hiddenCatalogs = sanitizedProxyHiddenCatalogs;
      }
      if (sanitizedProxySearchDisabledCatalogs.length > 0) {
        tokenProxyConfig.searchDisabledCatalogs = sanitizedProxySearchDisabledCatalogs;
      }
      if (Object.keys(sanitizedProxyDiscoverOnlyCatalogs).length > 0) {
        tokenProxyConfig.discoverOnlyCatalogs = sanitizedProxyDiscoverOnlyCatalogs;
      }
      if (isAiometadataManifest) {
        tokenProxyConfig.aiometadataProvider = proxyAiometadataProvider;
      } else if (!isCinemetaManifest && proxySeriesMetadataProvider === 'imdb') {
        tokenProxyConfig.seriesMetadataProvider = proxySeriesMetadataProvider;
      }

      const encodedProxyConfig = encodeBase64Url(JSON.stringify(tokenProxyConfig));
      return `${baseUrl}/proxy/${activeToken}/${encodedProxyConfig}/manifest.json`;
    }

    const tmdb = tmdbKey.trim();
    const mdb = mdblistKey.trim();
    const simkl = simklClientId.trim();
    if (!tmdb || !mdb) {
      return '';
    }

    const config: Record<string, unknown> = {
      url: manifestUrl,
      tmdbKey: tmdb,
      mdblistKey: mdb,
      erdbBase: baseUrl,
      baseUrl: baseUrl,
    };
    if (simkl) {
      config.simklClientId = simkl;
    }

    const proxyPosterRatingsQuery = stringifyRatingPreferencesAllowEmpty(posterRatingPreferences);
    const proxyBackdropRatingsQuery = stringifyRatingPreferencesAllowEmpty(backdropRatingPreferences);
    const proxyThumbnailRatingsQuery = stringifyRatingPreferencesAllowEmpty(thumbnailRatingPreferences);
    const proxyLogoRatingsQuery = stringifyRatingPreferencesAllowEmpty(logoRatingPreferences);
    const proxyRatingsMatch =
      proxyPosterRatingsQuery === proxyBackdropRatingsQuery &&
      proxyPosterRatingsQuery === proxyThumbnailRatingsQuery &&
      proxyPosterRatingsQuery === proxyLogoRatingsQuery;
    if (proxyRatingsMatch) {
      config.ratings = proxyPosterRatingsQuery;
    } else {
      config.posterRatings = proxyPosterRatingsQuery;
      config.backdropRatings = proxyBackdropRatingsQuery;
      config.thumbnailRatings = proxyThumbnailRatingsQuery;
      config.logoRatings = proxyLogoRatingsQuery;
    }
    if (effectiveLang) {
      config.lang = effectiveLang;
    }
    if (posterLang) {
      config.posterLang = effectivePosterLang;
    }
    if (posterAnimeLang) {
      config.posterAnimeLang = effectivePosterAnimeLang;
    }
    if (backdropLang) {
      config.backdropLang = effectiveBackdropLang;
    }
    if (backdropAnimeLang) {
      config.backdropAnimeLang = effectiveBackdropAnimeLang;
    }
    if (logoLang) {
      config.logoLang = effectiveLogoLang;
    }
    if (logoAnimeLang) {
      config.logoAnimeLang = effectiveLogoAnimeLang;
    }
    config.posterAnimeImageText = posterAnimeImageText;
    config.backdropAnimeImageText = backdropAnimeImageText;
    if (posterStreamBadges !== 'auto') {
      config.posterStreamBadges = posterStreamBadges;
    }
    if (backdropStreamBadges !== 'auto') {
      config.backdropStreamBadges = backdropStreamBadges;
    }
    if (shouldShowPosterQualityBadgesSide && qualityBadgesSide !== 'left') {
      config.qualityBadgesSide = qualityBadgesSide;
    }
    if (shouldShowPosterQualityBadgesPosition && posterQualityBadgesPosition !== 'auto') {
      config.posterQualityBadgesPosition = posterQualityBadgesPosition;
    }
    if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.posterQualityBadgesStyle = posterQualityBadgesStyle;
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.backdropQualityBadgesStyle = backdropQualityBadgesStyle;
    }
    if (posterRatingStyle) {
      config.posterRatingStyle = posterRatingStyle;
    }
    if (backdropRatingStyle) {
      config.backdropRatingStyle = backdropRatingStyle;
    }
    if (thumbnailRatingStyle) {
      config.thumbnailRatingStyle = thumbnailRatingStyle;
    }
    if (logoRatingStyle) {
      config.logoRatingStyle = logoRatingStyle;
    }

    config.posterRatingStyle = posterRatingStyle;
    config.backdropRatingStyle = backdropRatingStyle;
    config.thumbnailRatingStyle = thumbnailRatingStyle;
    config.logoRatingStyle = logoRatingStyle;
    config.logoMode = logoMode;
    config.logoFontVariant = logoFontVariant;
    config.logoPrimary = logoCustomPrimary;
    config.logoSecondary = logoCustomSecondary;
    config.logoOutline = logoCustomOutline;
    config.posterImageText = posterImageText;
    config.backdropImageText = backdropImageText;
    config.posterEnabled = proxyEnabledTypes.poster;
    config.backdropEnabled = proxyEnabledTypes.backdrop;
    config.logoEnabled = proxyEnabledTypes.logo;
    config.thumbnailEnabled = proxyEnabledTypes.thumbnail;
    if (proxyTranslateMeta) {
      config.translateMeta = true;
    }
    if (Object.keys(sanitizedProxyCatalogNames).length > 0) {
      config.catalogNames = sanitizedProxyCatalogNames;
    }
    if (sanitizedProxyHiddenCatalogs.length > 0) {
      config.hiddenCatalogs = sanitizedProxyHiddenCatalogs;
    }
    if (sanitizedProxySearchDisabledCatalogs.length > 0) {
      config.searchDisabledCatalogs = sanitizedProxySearchDisabledCatalogs;
    }
    if (Object.keys(sanitizedProxyDiscoverOnlyCatalogs).length > 0) {
      config.discoverOnlyCatalogs = sanitizedProxyDiscoverOnlyCatalogs;
    }

    if (posterRatingsLayout) {
      config.posterRatingsLayout = posterRatingsLayout;
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = String(posterRatingsMaxPerSide);
    }
    if (logoRatingsMax !== null) {
      config.logoRatingsMax = String(logoRatingsMax);
    }
    if (backdropRatingsLayout) {
      config.backdropRatingsLayout = backdropRatingsLayout;
    }
    if (backdropRatingsSize) {
      config.backdropRatingsSize = backdropRatingsSize;
    }
    if (thumbnailRatingsLayout) {
      config.thumbnailRatingsLayout = thumbnailRatingsLayout;
    }
    if (thumbnailSize) {
      config.thumbnailSize = thumbnailSize;
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterVerticalBadgeContent !== 'standard') {
      config.posterVerticalBadgeContent = posterVerticalBadgeContent;
    }
    if (
      (backdropRatingsLayout === 'right-vertical' || thumbnailRatingsLayout.endsWith('-vertical')) &&
      backdropVerticalBadgeContent !== 'standard'
    ) {
      config.backdropVerticalBadgeContent = backdropVerticalBadgeContent;
    }
    if (
      thumbnailRatingsLayout.endsWith('-vertical') &&
      thumbnailVerticalBadgeContent !== 'standard'
    ) {
      config.thumbnailVerticalBadgeContent = thumbnailVerticalBadgeContent;
    }
    if (isAiometadataManifest) {
      config.aiometadataProvider = proxyAiometadataProvider;
    } else if (!isCinemetaManifest && proxySeriesMetadataProvider === 'imdb') {
      config.seriesMetadataProvider = proxySeriesMetadataProvider;
    }

    config.erdbBase = baseUrl;
    const encoded = encodeBase64Url(JSON.stringify(config));
    return `${baseUrl}/proxy/${encoded}/manifest.json`;
  }, [
    proxyManifestUrl,
    tmdbKey,
    mdblistKey,
    simklClientId,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    effectiveLang,
    effectivePosterLang,
    posterLang,
    posterStreamBadges,
    backdropStreamBadges,
    shouldShowPosterQualityBadgesSide,
    shouldShowPosterQualityBadgesPosition,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    posterImageText,
    backdropImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    proxySeriesMetadataProvider,
    proxyAiometadataProvider,
    proxyEnabledTypes,
    proxyTranslateMeta,
    sanitizedProxyCatalogNames,
    sanitizedProxyHiddenCatalogs,
    sanitizedProxySearchDisabledCatalogs,
    sanitizedProxyDiscoverOnlyCatalogs,
    baseUrl,
    thumbnailRatingStyle,
    activeToken,
  ]);

  const aiometadataPatterns = useMemo(() => {
    const episodePattern = buildAiometadataPatternBlock({
      baseUrl,
      activeToken,
      imageType: 'thumbnail',
      configString,
      idPattern: buildEpisodeThumbnailIdPattern(aiometadataEpisodeProvider),
    });

    return {
      poster: buildAiometadataPatternBlock({
        baseUrl,
        activeToken,
        imageType: 'poster',
        configString,
        idPattern: '{imdb_id}',
      }),
      background: buildAiometadataPatternBlock({
        baseUrl,
        activeToken,
        imageType: 'backdrop',
        configString,
        idPattern: '{imdb_id}',
      }),
      logo: buildAiometadataPatternBlock({
        baseUrl,
        activeToken,
        imageType: 'logo',
        configString,
        idPattern: '{imdb_id}',
      }),
      episodeThumbnail: episodePattern,
    };
  }, [
    baseUrl,
    activeToken,
    configString,
    aiometadataEpisodeProvider,
  ]);

  const updateRatingRowsForType = (
    type: PreviewType,
    updater: (current: RatingProviderRow[]) => RatingProviderRow[]
  ) => {
    if (type === 'poster') {
      setPosterRatingRows(updater);
      return;
    }
    if (type === 'backdrop') {
      setBackdropRatingRows(updater);
      return;
    }
    if (type === 'thumbnail') {
      setThumbnailRatingRows((current) => {
        const next = updater(current);
        const supportedSet = new Set<RatingPreference>(THUMBNAIL_SUPPORTED_RATINGS);
        return next.map((row) => ({
          ...row,
          enabled: supportedSet.has(row.id) ? row.enabled : false,
        }));
      });
      return;
    }
    setLogoRatingRows(updater);
  };

  const toggleRatingPreference = (rating: RatingPreference) => {
    updateRatingRowsForType(previewType, (rows) =>
      rows.map((r) => (r.id === rating ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const enableAllRatingPreferences = () => {
    updateRatingRowsForType(previewType, (rows) => rows.map((row) => ({ ...row, enabled: true })));
  };

  const disableAllRatingPreferences = () => {
    updateRatingRowsForType(previewType, (rows) => rows.map((row) => ({ ...row, enabled: false })));
  };

  const reorderRatingPreference = (fromIndex: number, toIndex: number) => {
    updateRatingRowsForType(previewType, (rows) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= rows.length ||
        toIndex >= rows.length
      ) {
        return rows;
      }
      if (previewType === 'thumbnail') {
        const supportedSet = new Set<RatingPreference>(THUMBNAIL_SUPPORTED_RATINGS);
        const thumbnailRows = rows.filter((row) => supportedSet.has(row.id));
        if (fromIndex >= thumbnailRows.length || toIndex >= thumbnailRows.length) {
          return rows;
        }

        const reorderedThumbnailRows = [...thumbnailRows];
        const [item] = reorderedThumbnailRows.splice(fromIndex, 1);
        reorderedThumbnailRows.splice(toIndex, 0, item);

        let thumbnailCursor = 0;
        return rows.map((row) => {
          if (!supportedSet.has(row.id)) {
            return row;
          }
          const nextRow = reorderedThumbnailRows[thumbnailCursor];
          thumbnailCursor += 1;
          return nextRow;
        });
      }

      const copy = [...rows];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
  };

  const toggleProxyEnabledType = (type: ProxyType) => {
    setProxyEnabledTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  };

  const handleCopyProxy = useCallback(() => {
    if (!proxyUrl) return;
    navigator.clipboard.writeText(proxyUrl);
    setProxyCopied(true);
    setTimeout(() => setProxyCopied(false), 2000);
  }, [proxyUrl]);

  const handleCopyAiometadataPattern = useCallback((type: AiometadataPatternType) => {
    const value = aiometadataPatterns[type];
    if (!value) return;
    navigator.clipboard.writeText(value);
    setAiometadataCopiedType(type);
    setTimeout(() => setAiometadataCopiedType((current) => (current === type ? null : current)), 2000);
  }, [aiometadataPatterns]);

  const handleExportConfig = (includeKeys: boolean) => {
    const payload: Record<string, unknown> = {
      version: EXPORT_CONFIG_VERSION,
      createdAt: new Date().toISOString(),
      previewType,
      mediaId,
      lang: effectiveLang,
      posterLang,
      posterAnimeLang,
      posterImageText,
      posterAnimeImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      thumbnailRatingStyle,
      logoRatingStyle,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      logoRatingsMax,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      backdropRatingsLayout,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      aiometadataEpisodeProvider,
      proxySeriesMetadataProvider,
      proxyAiometadataProvider,
      proxyManifestUrl,
      proxyEnabledTypes,
      translateMeta: proxyTranslateMeta,
      proxyCatalogNames: sanitizedProxyCatalogNames,
      proxyHiddenCatalogs: sanitizedProxyHiddenCatalogs,
      proxySearchDisabledCatalogs: sanitizedProxySearchDisabledCatalogs,
      proxyDiscoverOnlyCatalogs: sanitizedProxyDiscoverOnlyCatalogs,
    };

    if (includeKeys) {
      payload.tmdbKey = tmdbKey;
      payload.mdblistKey = mdblistKey;
      payload.simklClientId = simklClientId;
    }

    const filename = includeKeys ? 'erdb-config-with-keys.json' : 'erdb-config.json';
    downloadJsonFile(payload, filename);
    setExportStatus(includeKeys ? 'with' : 'without');
    setTimeout(() => setExportStatus('idle'), 2000);
  };

  function applyImportedConfig(
    payload: Record<string, unknown>,
    options: { includeProxy?: boolean } = {}
  ) {
    const { includeProxy = true } = options;
    if (typeof payload.tmdbKey === 'string') {
      setTmdbKey(payload.tmdbKey);
    }
    if (typeof payload.mdblistKey === 'string') {
      setMdblistKey(payload.mdblistKey);
    }
    if (typeof payload.simklClientId === 'string') {
      setSimklClientId(payload.simklClientId);
    }
    if (typeof payload.mediaId === 'string') {
      setMediaId(payload.mediaId);
    }
    if (typeof payload.lang === 'string') {
      setLang(normalizeTmdbLanguageCode(payload.lang) || payload.lang);
    }
    if (typeof payload.posterLang === 'string') {
      setPosterLang(normalizeTmdbLanguageCode(payload.posterLang) || payload.posterLang);
    }
    if (typeof payload.posterAnimeLang === 'string') {
      setPosterAnimeLang(normalizeTmdbLanguageCode(payload.posterAnimeLang) || payload.posterAnimeLang);
    }
    if (typeof payload.backdropLang === 'string') {
      setBackdropLang(normalizeTmdbLanguageCode(payload.backdropLang) || payload.backdropLang);
    }
    if (typeof payload.backdropAnimeLang === 'string') {
      setBackdropAnimeLang(normalizeTmdbLanguageCode(payload.backdropAnimeLang) || payload.backdropAnimeLang);
    }
    if (typeof payload.logoLang === 'string') {
      setLogoLang(normalizeTmdbLanguageCode(payload.logoLang) || payload.logoLang);
    }
    if (typeof payload.logoAnimeLang === 'string') {
      setLogoAnimeLang(normalizeTmdbLanguageCode(payload.logoAnimeLang) || payload.logoAnimeLang);
    }
    if (typeof payload.previewType === 'string' && isPreviewType(payload.previewType)) {
      setPreviewType(payload.previewType);
    }
    if (typeof payload.posterImageText === 'string' && isImageText(payload.posterImageText)) {
      setPosterImageText(payload.posterImageText);
    }
    if (typeof payload.posterAnimeImageText === 'string' && isImageText(payload.posterAnimeImageText)) {
      setPosterAnimeImageText(payload.posterAnimeImageText);
    }
    if (typeof payload.backdropAnimeImageText === 'string' && isImageText(payload.backdropAnimeImageText)) {
      setBackdropAnimeImageText(payload.backdropAnimeImageText);
    }
    if (typeof payload.backdropImageText === 'string' && isImageText(payload.backdropImageText)) {
      setBackdropImageText(payload.backdropImageText);
    }
    if (typeof payload.posterStreamBadges === 'string' && isStreamBadgesSetting(payload.posterStreamBadges)) {
      setPosterStreamBadges(payload.posterStreamBadges);
    }
    if (typeof payload.backdropStreamBadges === 'string' && isStreamBadgesSetting(payload.backdropStreamBadges)) {
      setBackdropStreamBadges(payload.backdropStreamBadges);
    }
    if (typeof payload.qualityBadgesSide === 'string' && isQualityBadgesSide(payload.qualityBadgesSide)) {
      setQualityBadgesSide(payload.qualityBadgesSide);
    }
    if (
      typeof payload.posterQualityBadgesPosition === 'string' &&
      isPosterQualityBadgesPosition(payload.posterQualityBadgesPosition)
    ) {
      setPosterQualityBadgesPosition(payload.posterQualityBadgesPosition);
    }
    if (typeof payload.posterQualityBadgesStyle === 'string' && isRatingStyle(payload.posterQualityBadgesStyle)) {
      setPosterQualityBadgesStyle(payload.posterQualityBadgesStyle);
    }
    if (typeof payload.backdropQualityBadgesStyle === 'string' && isRatingStyle(payload.backdropQualityBadgesStyle)) {
      setBackdropQualityBadgesStyle(payload.backdropQualityBadgesStyle);
    }
    if (typeof payload.posterRatingStyle === 'string' && isRatingStyle(payload.posterRatingStyle)) {
      setPosterRatingStyle(payload.posterRatingStyle);
    }
    if (typeof payload.backdropRatingStyle === 'string' && isRatingStyle(payload.backdropRatingStyle)) {
      setBackdropRatingStyle(payload.backdropRatingStyle);
    }
    if (typeof payload.thumbnailRatingStyle === 'string' && isRatingStyle(payload.thumbnailRatingStyle)) {
      setThumbnailRatingStyle(payload.thumbnailRatingStyle);
    }
    if (typeof payload.logoRatingStyle === 'string' && isRatingStyle(payload.logoRatingStyle)) {
      setLogoRatingStyle(payload.logoRatingStyle);
    }
    if (typeof payload.logoMode === 'string') {
      setLogoMode(normalizeLogoMode(payload.logoMode));
    }
    if (isLogoFontVariant(payload.logoFontVariant)) {
      setLogoFontVariant(payload.logoFontVariant);
    }
    if (typeof payload.logoCustomPrimary === 'string') {
      setLogoCustomPrimary(normalizeHexColor(payload.logoCustomPrimary, DEFAULT_LOGO_CUSTOM_PRIMARY));
    }
    if (typeof payload.logoCustomSecondary === 'string') {
      setLogoCustomSecondary(normalizeHexColor(payload.logoCustomSecondary, DEFAULT_LOGO_CUSTOM_SECONDARY));
    }
    if (typeof payload.logoCustomOutline === 'string') {
      setLogoCustomOutline(normalizeHexColor(payload.logoCustomOutline, DEFAULT_LOGO_CUSTOM_OUTLINE));
    }
    if (typeof payload.posterRatingsLayout === 'string' && isPosterRatingLayout(payload.posterRatingsLayout)) {
      setPosterRatingsLayout(payload.posterRatingsLayout);
    }
    if (typeof payload.backdropRatingsLayout === 'string') {
      setBackdropRatingsLayout(normalizeBackdropRatingLayout(payload.backdropRatingsLayout));
    }
    if (typeof payload.backdropRatingsSize === 'string') {
      setBackdropRatingsSize(normalizeBackdropRatingsSize(payload.backdropRatingsSize));
    }
    if (typeof payload.thumbnailRatingsLayout === 'string' && isThumbnailRatingLayout(payload.thumbnailRatingsLayout)) {
      setThumbnailRatingsLayout(payload.thumbnailRatingsLayout);
    }
    if (isVerticalBadgeContent(payload.posterVerticalBadgeContent)) {
      setPosterVerticalBadgeContent(payload.posterVerticalBadgeContent);
    } else if (isVerticalBadgeContent(payload.verticalBadgeContent)) {
      setPosterVerticalBadgeContent(payload.verticalBadgeContent);
    }
    if (isVerticalBadgeContent(payload.backdropVerticalBadgeContent)) {
      setBackdropVerticalBadgeContent(payload.backdropVerticalBadgeContent);
    }
    if (isVerticalBadgeContent(payload.thumbnailVerticalBadgeContent)) {
      setThumbnailVerticalBadgeContent(payload.thumbnailVerticalBadgeContent);
    } else if (isVerticalBadgeContent(payload.verticalBadgeContent)) {
      setThumbnailVerticalBadgeContent(payload.verticalBadgeContent);
    }
    if (typeof payload.thumbnailSize === 'string' && THUMBNAIL_SIZE_OPTIONS.some((option) => option.id === payload.thumbnailSize)) {
      setThumbnailSize(payload.thumbnailSize as ThumbnailSize);
    }
    if (isAiometadataEpisodeProvider(payload.aiometadataEpisodeProvider)) {
      setAiometadataEpisodeProvider(payload.aiometadataEpisodeProvider);
    }

    if (payload.posterRatingsMaxPerSide === null) {
      setPosterRatingsMaxPerSide(null);
    } else if (typeof payload.posterRatingsMaxPerSide === 'number' || typeof payload.posterRatingsMaxPerSide === 'string') {
      const parsed = typeof payload.posterRatingsMaxPerSide === 'number'
        ? payload.posterRatingsMaxPerSide
        : parseInt(payload.posterRatingsMaxPerSide, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 20) {
        setPosterRatingsMaxPerSide(parsed);
      }
    }
    if (payload.logoRatingsMax === null) {
      setLogoRatingsMax(null);
    } else if (typeof payload.logoRatingsMax === 'number' || typeof payload.logoRatingsMax === 'string') {
      setLogoRatingsMax(normalizeLogoRatingsMax(payload.logoRatingsMax));
    }

    const normalizeRatingArray = (value: unknown) => {
      if (!Array.isArray(value)) return null;
      const normalized = value
        .map((item) => (typeof item === 'string' ? item : null))
        .filter((item): item is RatingPreference => item !== null && isRatingProviderId(item));
      return [...new Set(normalized)];
    };

    const resolveRatingPreferences = (arrayValue: unknown, stringValue?: unknown) => {
      const fromArray = normalizeRatingArray(arrayValue);
      if (fromArray !== null) return fromArray;
      if (typeof stringValue === 'string') {
        return parseRatingPreferencesAllowEmpty(stringValue);
      }
      return null;
    };

    const posterRatings =
      resolveRatingPreferences(payload.posterRatingPreferences, payload.posterRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (posterRatings !== null) {
      setPosterRatingRows(enabledOrderedToRows(posterRatings));
    }

    const backdropRatings =
      resolveRatingPreferences(payload.backdropRatingPreferences, payload.backdropRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (backdropRatings !== null) {
      setBackdropRatingRows(enabledOrderedToRows(backdropRatings));
    }

    const thumbnailRatingsRaw =
      resolveRatingPreferences((payload as Record<string, unknown>).thumbnailRatingPreferences, payload.thumbnailRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (thumbnailRatingsRaw !== null) {
      const thumbnailRatings = thumbnailRatingsRaw.filter((rating) => THUMBNAIL_SUPPORTED_RATINGS.includes(rating));
      setThumbnailRatingRows(enabledOrderedToRows(thumbnailRatings));
    }

    const logoRatings =
      resolveRatingPreferences(payload.logoRatingPreferences, payload.logoRatings) ??
      resolveRatingPreferences(null, payload.ratings);
    if (logoRatings !== null) {
      setLogoRatingRows(enabledOrderedToRows(logoRatings));
    }

    if (includeProxy) {
      const importedProxyManifestUrl =
        typeof payload.proxyManifestUrl === 'string'
          ? payload.proxyManifestUrl
          : typeof payload.url === 'string'
            ? payload.url
            : null;
      if (importedProxyManifestUrl) {
        const nextProxyManifestUrl = normalizeManifestUrl(importedProxyManifestUrl, true);
        setProxyManifestUrl(nextProxyManifestUrl);
        setProxyCatalogs([]);
        setProxyCatalogNames({});
        setProxyHiddenCatalogs([]);
        setProxySearchDisabledCatalogs([]);
        setProxyDiscoverOnlyCatalogs({});
        setProxyCatalogsStatus('idle');
        setProxyCatalogsError('');
      }
      const importedSeriesMetadataProvider =
        payload.proxySeriesMetadataProvider ?? payload.seriesMetadataProvider;
      if (isProxySeriesMetadataProvider(importedSeriesMetadataProvider)) {
        setProxySeriesMetadataProvider(importedSeriesMetadataProvider);
      }
      const importedAiometadataProvider =
        payload.proxyAiometadataProvider ?? payload.aiometadataProvider;
      if (isProxyEpisodeProvider(importedAiometadataProvider)) {
        setProxyAiometadataProvider(importedAiometadataProvider);
      }
      if (payload.proxyEnabledTypes && typeof payload.proxyEnabledTypes === 'object') {
        const enabled = payload.proxyEnabledTypes as Record<string, unknown>;
        setProxyEnabledTypes((current) => ({
          poster: typeof enabled.poster === 'boolean' ? enabled.poster : current.poster,
          backdrop: typeof enabled.backdrop === 'boolean' ? enabled.backdrop : current.backdrop,
          logo: typeof enabled.logo === 'boolean' ? enabled.logo : current.logo,
          thumbnail: typeof enabled.thumbnail === 'boolean' ? enabled.thumbnail : current.thumbnail,
        }));
      } else if (
        typeof payload.posterEnabled === 'boolean' ||
        typeof payload.backdropEnabled === 'boolean' ||
        typeof payload.logoEnabled === 'boolean' ||
        typeof payload.thumbnailEnabled === 'boolean'
      ) {
        setProxyEnabledTypes((current) => ({
          poster: typeof payload.posterEnabled === 'boolean' ? payload.posterEnabled : current.poster,
          backdrop: typeof payload.backdropEnabled === 'boolean' ? payload.backdropEnabled : current.backdrop,
          logo: typeof payload.logoEnabled === 'boolean' ? payload.logoEnabled : current.logo,
          thumbnail: typeof payload.thumbnailEnabled === 'boolean' ? payload.thumbnailEnabled : current.thumbnail,
        }));
      }
      if (typeof payload.translateMeta === 'boolean') {
        setProxyTranslateMeta(payload.translateMeta);
      }
      const importedProxyCatalogNames =
        normalizeProxyCatalogNameOverrides(payload.proxyCatalogNames) ||
        normalizeProxyCatalogNameOverrides(payload.catalogNames);
      if (importedProxyCatalogNames) {
        setProxyCatalogNames(importedProxyCatalogNames);
      } else if ('proxyCatalogNames' in payload || 'catalogNames' in payload) {
        setProxyCatalogNames({});
      }
      const importedHiddenCatalogs =
        normalizeProxyCatalogKeyList(payload.proxyHiddenCatalogs) ||
        normalizeProxyCatalogKeyList(payload.hiddenCatalogs);
      if (importedHiddenCatalogs) {
        setProxyHiddenCatalogs(importedHiddenCatalogs);
      } else if ('proxyHiddenCatalogs' in payload || 'hiddenCatalogs' in payload) {
        setProxyHiddenCatalogs([]);
      }
      const importedSearchDisabledCatalogs =
        normalizeProxyCatalogKeyList(payload.proxySearchDisabledCatalogs) ||
        normalizeProxyCatalogKeyList(payload.searchDisabledCatalogs);
      if (importedSearchDisabledCatalogs) {
        setProxySearchDisabledCatalogs(importedSearchDisabledCatalogs);
      } else if ('proxySearchDisabledCatalogs' in payload || 'searchDisabledCatalogs' in payload) {
        setProxySearchDisabledCatalogs([]);
      }
      const importedDiscoverOnlyCatalogs =
        normalizeProxyCatalogBooleanOverrides(payload.proxyDiscoverOnlyCatalogs) ||
        normalizeProxyCatalogBooleanOverrides(payload.discoverOnlyCatalogs);
      if (importedDiscoverOnlyCatalogs) {
        setProxyDiscoverOnlyCatalogs(importedDiscoverOnlyCatalogs);
      } else if ('proxyDiscoverOnlyCatalogs' in payload || 'discoverOnlyCatalogs' in payload) {
        setProxyDiscoverOnlyCatalogs({});
      }
    }

    setImportStatus('success');
    setImportMessage('');
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPreviewConfig = safeLocalStorageGet(PREVIEW_CONFIG_STORAGE_KEY);
    if (!storedPreviewConfig) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      try {
        const parsed = JSON.parse(storedPreviewConfig) as Record<string, unknown>;
        applyImportedConfig(parsed);
      } catch {
        safeLocalStorageRemove(PREVIEW_CONFIG_STORAGE_KEY);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!initialConfig) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      applyImportedConfig(initialConfig, { includeProxy: false });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [initialConfig]);

  useEffect(() => {
    const payload: Record<string, unknown> = {
      version: EXPORT_CONFIG_VERSION,
      previewType,
      mediaId,
      lang: effectiveLang,
      posterLang,
      posterAnimeLang,
      backdropLang,
      backdropAnimeLang,
      logoLang,
      logoAnimeLang,
      posterImageText,
      posterAnimeImageText,
      backdropAnimeImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      thumbnailRatingStyle,
      logoRatingStyle,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      logoRatingsMax,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      aiometadataEpisodeProvider,
      proxySeriesMetadataProvider,
      proxyAiometadataProvider,
      proxyManifestUrl,
      proxyEnabledTypes,
      translateMeta: proxyTranslateMeta,
      proxyCatalogNames: sanitizedProxyCatalogNames,
      proxyHiddenCatalogs: sanitizedProxyHiddenCatalogs,
      proxySearchDisabledCatalogs: sanitizedProxySearchDisabledCatalogs,
      proxyDiscoverOnlyCatalogs: sanitizedProxyDiscoverOnlyCatalogs,
    };
    safeLocalStorageSet(PREVIEW_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  }, [
    previewType,
    mediaId,
    effectiveLang,
    posterLang,
    posterAnimeLang,
    posterImageText,
    posterAnimeImageText,
    backdropImageText,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    posterStreamBadges,
    backdropStreamBadges,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    posterQualityBadgesStyle,
    backdropQualityBadgesStyle,
    posterRatingStyle,
    backdropRatingStyle,
    logoRatingStyle,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    aiometadataEpisodeProvider,
    proxySeriesMetadataProvider,
    proxyAiometadataProvider,
    proxyManifestUrl,
    proxyEnabledTypes,
    proxyTranslateMeta,
    sanitizedProxyCatalogNames,
    sanitizedProxyHiddenCatalogs,
    sanitizedProxySearchDisabledCatalogs,
    sanitizedProxyDiscoverOnlyCatalogs,
  ]);

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    setImportStatus('idle');
    setImportMessage('');

    try {
      const raw = await file.text();
      const payload = parseImportedConfigPayload(raw);

      if (!payload) {
        setImportStatus('error');
        setImportMessage('Invalid config file.');
        return;
      }

      applyImportedConfig(payload);
    } catch {
      setImportStatus('error');
      setImportMessage('Invalid config file.');
    }
  };

  const handleImportConfigString = (value: string) => {
    setImportStatus('idle');
    setImportMessage('');

    const payload = parseImportedConfigPayload(value);
    if (!payload) {
      setImportStatus('error');
      setImportMessage('Invalid config string.');
      return;
    }

    applyImportedConfig(payload);
  };

  const currentConfigPayload = useMemo(
    () => ({
      version: EXPORT_CONFIG_VERSION,
      lang: effectiveLang,
      posterLang,
      posterAnimeLang,
      posterImageText,
      posterAnimeImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      thumbnailRatingStyle,
      logoRatingStyle,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      aiometadataEpisodeProvider,
      proxySeriesMetadataProvider,
      proxyAiometadataProvider,
      proxyManifestUrl,
      proxyEnabledTypes,
      translateMeta: proxyTranslateMeta,
      proxyCatalogNames: sanitizedProxyCatalogNames,
      proxyHiddenCatalogs: sanitizedProxyHiddenCatalogs,
      proxySearchDisabledCatalogs: sanitizedProxySearchDisabledCatalogs,
      proxyDiscoverOnlyCatalogs: sanitizedProxyDiscoverOnlyCatalogs,
      tmdbKey,
      mdblistKey,
      simklClientId,
    }),
    [
      effectiveLang,
      posterLang,
      posterAnimeLang,
      posterImageText,
      posterAnimeImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      thumbnailRatingStyle,
      logoRatingStyle,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      aiometadataEpisodeProvider,
      proxySeriesMetadataProvider,
      proxyAiometadataProvider,
      proxyManifestUrl,
      proxyEnabledTypes,
      proxyTranslateMeta,
      sanitizedProxyCatalogNames,
      sanitizedProxyHiddenCatalogs,
      sanitizedProxySearchDisabledCatalogs,
      sanitizedProxyDiscoverOnlyCatalogs,
      tmdbKey,
      mdblistKey,
      simklClientId,
    ]
  );

  const persistedTokenConfigPayload = useMemo(
    () => ({
      version: EXPORT_CONFIG_VERSION,
      lang: effectiveLang,
      posterLang,
      posterAnimeLang,
      posterImageText,
      posterAnimeImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      thumbnailRatingStyle,
      logoRatingStyle,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      tmdbKey,
      mdblistKey,
      simklClientId,
    }),
    [
      effectiveLang,
      posterLang,
      posterAnimeLang,
      posterImageText,
      posterAnimeImageText,
      backdropImageText,
      posterRatingPreferences,
      backdropRatingPreferences,
      thumbnailRatingPreferences,
      logoRatingPreferences,
      posterStreamBadges,
      backdropStreamBadges,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      posterQualityBadgesStyle,
      backdropQualityBadgesStyle,
      posterRatingStyle,
      backdropRatingStyle,
      thumbnailRatingStyle,
      logoRatingStyle,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      tmdbKey,
      mdblistKey,
      simklClientId,
    ]
  );

  const handleTokenDisconnect = () => {
    setActiveToken(null);
    void fetch('/api/workspace-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).finally(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/configurator';
      }
    });
  };

  const handleSaveConfig = useCallback(() => {
    if (typeof window === 'undefined' || mode !== 'workspace' || !activeToken) {
      return;
    }

    setConfigSaveStatus('saving');
    void fetch('/api/workspace-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: persistedTokenConfigPayload }),
    })
      .then((response) => {
        setConfigSaveStatus(response.ok ? 'saved' : 'error');
      })
      .catch(() => {
        setConfigSaveStatus('error');
      })
      .finally(() => {
        const resetId = window.setTimeout(() => setConfigSaveStatus('idle'), 2000);
        return () => window.clearTimeout(resetId);
      });
  }, [mode, activeToken, persistedTokenConfigPayload]);

  const normalizedProxyManifestUrl = normalizeManifestUrl(proxyManifestUrl);
  const canGenerateProxy = Boolean(
    normalizedProxyManifestUrl &&
    !isBareHttpUrl(normalizedProxyManifestUrl) &&
    (activeToken || (tmdbKey.trim() && mdblistKey.trim()))
  );
  const isProxyUrlVisible = Boolean(proxyUrl) && showProxyUrl;
  const proxyDisplayValue = proxyUrl || `${baseUrl || 'https://erdb.example.com'}/proxy/{config}/manifest.json`;
  const displayedProxyUrl = isProxyUrlVisible ? proxyDisplayValue : maskSensitiveText(proxyDisplayValue);
  const activeRatingStyle =
    previewType === 'poster'
      ? posterRatingStyle
      : previewType === 'backdrop'
        ? backdropRatingStyle
        : previewType === 'thumbnail'
          ? thumbnailRatingStyle
          : logoRatingStyle;
  const activeImageText =
    previewType === 'backdrop' || previewType === 'thumbnail' ? backdropImageText : posterImageText;
  const styleLabel =
    previewType === 'poster'
      ? 'Poster Ratings Style'
      : previewType === 'backdrop'
        ? 'Backdrop Ratings Style'
        : previewType === 'thumbnail'
          ? 'Thumbnail Ratings Style'
          : 'Logo Ratings Style';
  const textLabel =
    previewType === 'backdrop' ? 'Backdrop Text' : previewType === 'thumbnail' ? 'Thumbnail Text' : 'Poster Text';
  const providersLabel =
    previewType === 'poster'
      ? 'Poster Providers'
      : previewType === 'backdrop'
        ? 'Backdrop Providers'
        : previewType === 'thumbnail'
          ? 'Thumbnail Providers'
          : 'Logo Providers';
  const ratingProviderRows =
    previewType === 'poster'
      ? posterRatingRows
      : previewType === 'backdrop'
        ? backdropRatingRows
        : previewType === 'thumbnail'
          ? thumbnailRatingRows
          : logoRatingRows;
  const visibleRatingProviderRows =
    previewType === 'thumbnail'
      ? ratingProviderRows.filter((row) => THUMBNAIL_SUPPORTED_RATINGS.includes(row.id))
      : ratingProviderRows;
  const previewNotice =
    previewType === 'thumbnail' && !EPISODE_ID_PATTERN.test(mediaId.trim())
      ? 'Movies are not supported for thumbnails.'
      : null;

  const setRatingStyleForType = (value: RatingStyle) => {
    if (previewType === 'poster') {
      setPosterRatingStyle(value);
      return;
    }
    if (previewType === 'backdrop') {
      setBackdropRatingStyle(value);
      return;
    }
    if (previewType === 'thumbnail') {
      setThumbnailRatingStyle(value);
      return;
    }
    setLogoRatingStyle(value);
  };

  const setImageTextForType = (value: 'default' | 'clean' | 'alternative') => {
    if (previewType === 'backdrop' || previewType === 'thumbnail') {
      setBackdropImageText(value);
      return;
    }
    setPosterImageText(value);
  };
  const handleSetPreviewType: Dispatch<SetStateAction<PreviewType>> = (value) => {
    const nextPreviewType = typeof value === 'function' ? value(previewType) : value;
    setPreviewType(nextPreviewType);
    setMediaId((currentMediaId) => {
      const trimmed = currentMediaId.trim();
      if (nextPreviewType === 'thumbnail') {
        return EPISODE_ID_PATTERN.test(trimmed) ? trimmed : DEFAULT_THUMBNAIL_ID;
      }
      return EPISODE_ID_PATTERN.test(trimmed) ? DEFAULT_SERIES_ID : trimmed || DEFAULT_SERIES_ID;
    });
  };
  const viewProps: HomePageViewProps = {
    refs: {
      navRef,
    },
    state: {
      previewType,
      mediaId,
      lang: effectiveLang,
      posterLang,
      posterAnimeLang,
      backdropLang,
      backdropAnimeLang,
      logoLang,
      logoAnimeLang,
      posterAnimeImageText,
      backdropAnimeImageText,
      supportedLanguages,
      tmdbKey,
      mdblistKey,
      simklClientId,
      proxyManifestUrl,
      proxyCatalogs,
      proxyCatalogNames: sanitizedProxyCatalogNames,
      proxyHiddenCatalogs: sanitizedProxyHiddenCatalogs,
      proxySearchDisabledCatalogs: sanitizedProxySearchDisabledCatalogs,
      proxyDiscoverOnlyCatalogs: sanitizedProxyDiscoverOnlyCatalogs,
      proxyCatalogsStatus,
      proxyCatalogsError,
      proxyEnabledTypes,
      proxyTranslateMeta,
      exportStatus,
      importStatus,
      importMessage,
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      logoMode,
      logoFontVariant,
      logoCustomPrimary,
      logoCustomSecondary,
      logoCustomOutline,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      qualityBadgesSide,
      posterQualityBadgesPosition,
      proxyCopied,
      copied,
      aiometadataCopiedType,
      aiometadataEpisodeProvider,
      proxySeriesMetadataProvider,
      proxyAiometadataProvider,
      activeToken,
      configSaveStatus,
    },
    derived: {
      baseUrl,
      previewUrl,
      proxyUrl,
      currentVersion,
      githubPackageVersion,
      repoUrl,
      previewNotice,
      canGenerateProxy,
      isProxyUrlVisible,
      displayedProxyUrl,
      styleLabel,
      textLabel,
      providersLabel,
      activeRatingStyle,
      activeImageText,
      ratingProviderRows: visibleRatingProviderRows,
      shouldShowQualityBadgesPosition,
      shouldShowQualityBadgesSide,
      qualityBadgeTypeLabel,
      activeStreamBadges,
      activeQualityBadgesStyle,
      aiometadataPatterns,
    },
    actions: {
      handleAnchorClick,
      handleExportConfig,
      handleImportFile,
      handleImportConfigString,
      handleCopyProxy,
      handleCopyPrompt,
      handleCopyAiometadataPattern,
      setPreviewType: handleSetPreviewType,
      setMediaId,
      setLang,
      setPosterLang,
      setPosterAnimeLang,
      setBackdropLang,
      setBackdropAnimeLang,
      setLogoLang,
      setLogoAnimeLang,
      setPosterAnimeImageText,
      setBackdropAnimeImageText,
      setTmdbKey,
      setMdblistKey,
      setSimklClientId,
      setPosterRatingsLayout,
      setPosterRatingsMaxPerSide,
      setLogoRatingsMax,
      setLogoMode,
      setLogoFontVariant,
      setLogoCustomPrimary,
      setLogoCustomSecondary,
      setLogoCustomOutline,
      setBackdropRatingsLayout,
      setBackdropRatingsSize,
      setThumbnailRatingsLayout,
      setPosterVerticalBadgeContent,
      setBackdropVerticalBadgeContent,
      setThumbnailVerticalBadgeContent,
      setThumbnailSize,
      setAiometadataEpisodeProvider,
      setProxySeriesMetadataProvider,
      setProxyAiometadataProvider,
      setPosterQualityBadgesPosition,
      setQualityBadgesSide,
      setRatingStyleForType,
      setImageTextForType,
      setActiveStreamBadges,
      setActiveQualityBadgesStyle,
      toggleRatingPreference,
      enableAllRatingPreferences,
      disableAllRatingPreferences,
      reorderRatingPreference,
      updateProxyManifestUrl: (value) => {
        setProxyManifestUrl(normalizeManifestUrl(value, true));
        setProxyCatalogs([]);
        setProxyCatalogNames({});
        setProxyHiddenCatalogs([]);
        setProxySearchDisabledCatalogs([]);
        setProxyDiscoverOnlyCatalogs({});
        setProxyCatalogsStatus('idle');
        setProxyCatalogsError('');
      },
      updateProxyCatalogName: (key, value) =>
        setProxyCatalogNames((current) => {
          const trimmedKey = key.trim();
          if (!trimmedKey) {
            return current;
          }

          const nextValue = value.trim();
          if (!nextValue) {
            if (!(trimmedKey in current)) {
              return current;
            }
            const next = { ...current };
            delete next[trimmedKey];
            return next;
          }

          return {
            ...current,
            [trimmedKey]: nextValue,
          };
        }),
      toggleProxyCatalogHidden: (key) =>
        setProxyHiddenCatalogs((current) => {
          const trimmedKey = key.trim();
          if (!trimmedKey) {
            return current;
          }
          return current.includes(trimmedKey)
            ? current.filter((entry) => entry !== trimmedKey)
            : [...current, trimmedKey];
        }),
      toggleProxyCatalogSearchDisabled: (key) =>
        setProxySearchDisabledCatalogs((current) => {
          const trimmedKey = key.trim();
          if (!trimmedKey) {
            return current;
          }
          return current.includes(trimmedKey)
            ? current.filter((entry) => entry !== trimmedKey)
            : [...current, trimmedKey];
        }),
      setProxyCatalogDiscoverOnly: (key, enabled) =>
        setProxyDiscoverOnlyCatalogs((current) => {
          const trimmedKey = key.trim();
          if (!trimmedKey) {
            return current;
          }

          const sourceValue = proxyCatalogs.find((catalog) => catalog.key === trimmedKey)?.discoverOnly;
          if (sourceValue === enabled) {
            if (!(trimmedKey in current)) {
              return current;
            }
            const next = { ...current };
            delete next[trimmedKey];
            return next;
          }

          return {
            ...current,
            [trimmedKey]: enabled,
          };
        }),
      resetProxyCatalogNames: () => setProxyCatalogNames({}),
      resetProxyCatalogCustomizations: () => {
        setProxyCatalogNames({});
        setProxyHiddenCatalogs([]);
        setProxySearchDisabledCatalogs([]);
        setProxyDiscoverOnlyCatalogs({});
      },
      toggleProxyEnabledType,
      toggleProxyTranslateMeta: () => setProxyTranslateMeta((value) => !value),
      toggleProxyUrlVisibility: () => setShowProxyUrl((value) => !value),
      handleTokenDisconnect,
      handleSaveConfig,
    },
  };

  return mode === 'workspace' ? <WorkspacePageView {...viewProps} /> : <HomePageView {...viewProps} />;
}
