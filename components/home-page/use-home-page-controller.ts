'use client';

import type { HomePageViewProps } from '@/components/home-page-view';
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
  DEFAULT_BACKDROP_RATINGS_MAX,
  normalizeBackdropRatingsMax,
} from '@/lib/backdropRatingsMax';
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
  RATING_STYLE_OPTIONS,
  type RatingStyle,
} from '@/lib/ratingStyle';
import { normalizeRankingPosition, type RankingPosition } from '@/lib/ratingBadgeLogic';
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
import { JUSTWATCH_COUNTRY_OPTIONS } from '@/components/workspace/constants';

import {
  type HomePageMode,
  VISIBLE_RATING_PROVIDER_OPTIONS,
  THUMBNAIL_SUPPORTED_RATINGS,
  EPISODE_ID_PATTERN,
  DEFAULT_SERIES_ID,
  DEFAULT_THUMBNAIL_ID,
  PROXY_TYPES,
  PREVIEW_TYPES,
  type ProxyType,
  type PreviewType,
  type ProxyEnabledTypes,
  type AiometadataPatternType,
  type AiometadataEpisodeProvider,
  type ProxySeriesMetadataProvider,
  type ProxyEpisodeProvider,
  type StreamBadgesSetting,
  type QualityBadgesSide,
  type PosterQualityBadgesPosition,
  type PosterGenrePosition,
  type VerticalBadgeContent,
  type PosterConfiguratorPreset,
  DEFAULT_QUALITY_BADGES_STYLE,
  STREAM_BADGE_OPTIONS,
  QUALITY_BADGE_SIDE_OPTIONS,
  POSTER_QUALITY_BADGE_POSITION_OPTIONS,
  TMDB_KEY_STORAGE_KEY,
  MDBLIST_KEY_STORAGE_KEY,
  SIMKL_CLIENT_ID_STORAGE_KEY,
  FANART_KEY_STORAGE_KEY,
  ERDB_TOKEN_STORAGE_KEY,
  PREVIEW_CONFIG_STORAGE_KEY,
  EXPORT_CONFIG_VERSION,
  TMDB_LANGUAGE_DOC_EXAMPLES,
  isRatingProviderId,
  isPreviewType,
  isProxyType,
  isStreamBadgesSetting,
  isQualityBadgesSide,
  isPosterQualityBadgesPosition,
  isPosterGenrePosition,
  isImageText,
  isRatingStyle,
  isPosterRatingLayout,
  isBackdropRatingLayout,
  isThumbnailRatingLayout,
  isProxySeriesMetadataProvider,
  isProxyEpisodeProvider,
  isAiometadataEpisodeProvider,
  isVerticalBadgeContent,
  normalizeBaseUrl,
  normalizeManifestUrl,
  isBareHttpUrl,
  isCinemetaManifestUrl,
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  subscribeToNothing,
  useClientOrigin,
  encodeBase64Url,
  decodeBase64Url,
  tryParseJsonObject,
  parseImportedConfigPayload,
  EMPTY_ENABLED_RATING_QUERY_KEYS,
  buildAiometadataPattern,
  buildAiometadataPatternBlock,
  buildEpisodeThumbnailIdPattern,
  downloadJsonFile,
  maskSensitiveText,
  getJustWatchCountryForLanguage
} from '@/components/home-page/home-page-utils';

export function useHomePageController({
  mode = 'landing',
  initialToken = null,
  initialConfig = null,
  initialVersion = '',
}: {
  mode?: HomePageMode;
  initialToken?: string | null;
  initialConfig?: Record<string, unknown> | null;
  initialVersion?: string;
}) {
  const [previewType, setPreviewType] = useState<PreviewType>('poster');
  const [mediaId, setMediaId] = useState(DEFAULT_SERIES_ID);
  const [lang, setLang] = useState('en-US');
  const [posterLang, setPosterLang] = useState('');
  const [posterAnimeLang, setPosterAnimeLang] = useState('');
  const [backdropLang, setBackdropLang] = useState('');
  const [backdropAnimeLang, setBackdropAnimeLang] = useState('');
  const [logoLang, setLogoLang] = useState('');
  const [logoAnimeLang, setLogoAnimeLang] = useState('');
  const [posterImageText, setPosterImageText] = useState<'default' | 'clean' | 'alternative'>('clean');
  const [posterAnimeImageText, setPosterAnimeImageText] = useState<'default' | 'clean' | 'alternative'>('default');
  const [posterConfiguratorPreset, setPosterConfiguratorPresetState] = useState<PosterConfiguratorPreset>('simple');
  const [posterAverageRatingsEnabled, setPosterAverageRatingsEnabled] = useState(false);
  const [posterVignetteEnabled, setPosterVignetteEnabled] = useState(true);
  const [posterGenrePosition, setPosterGenrePosition] = useState<PosterGenrePosition>('bottom');
  const [posterSimpleRatingSource, setPosterSimpleRatingSource] = useState<'average' | RatingPreference>('average');
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
  const isSimplePosterPreset = previewType === 'poster' && posterConfiguratorPreset === 'simple';
  const shouldUsePosterAverageRatings =
    previewType === 'poster' && (posterConfiguratorPreset === 'simple' || posterAverageRatingsEnabled);
  const [posterStreamBadges, setPosterStreamBadges] = useState<StreamBadgesSetting>('auto');
  const [backdropStreamBadges, setBackdropStreamBadges] = useState<StreamBadgesSetting>('off');
  const [qualityBadgesSide, setQualityBadgesSide] = useState<QualityBadgesSide>('left');
  const [posterQualityBadgesPosition, setPosterQualityBadgesPosition] =
    useState<PosterQualityBadgesPosition>('auto');
  const [posterQualityBadgesStyle, setPosterQualityBadgesStyle] = useState<RatingStyle>('glass');
  const [backdropQualityBadgesStyle, setBackdropQualityBadgesStyle] = useState<RatingStyle>(DEFAULT_QUALITY_BADGES_STYLE);
  const [ranking, setRanking] = useState('daily');
  const setPosterConfiguratorPreset = useCallback((value: PosterConfiguratorPreset) => {
    setPosterConfiguratorPresetState(value);
    if (value === 'simple') {
      setPosterImageText('clean');
      setPosterAnimeImageText('default');
      setPosterStreamBadges('on');
      setPosterQualityBadgesStyle('plain');
      setRanking('daily');
      setPosterGenrePosition('top');
      setPosterVignetteEnabled(true);
      setPosterRatingsLayout('top');
    } else {
      setPosterAverageRatingsEnabled(false);
    }
  }, []);
  const [posterRatingsLayout, setPosterRatingsLayout] = useState<PosterRatingLayout>('top');
  const [backdropRatingsLayout, setBackdropRatingsLayout] = useState<BackdropRatingLayout>('right-vertical');
  const [backdropRatingsSize, setBackdropRatingsSize] = useState<BackdropRatingsSize>('large');
  const [thumbnailRatingsLayout, setThumbnailRatingsLayout] = useState<ThumbnailRatingLayout>('left-vertical');
  const [posterVerticalBadgeContent, setPosterVerticalBadgeContent] = useState<VerticalBadgeContent>('stacked');
  const [backdropVerticalBadgeContent, setBackdropVerticalBadgeContent] = useState<VerticalBadgeContent>('stacked');
  const [thumbnailVerticalBadgeContent, setThumbnailVerticalBadgeContent] = useState<VerticalBadgeContent>('stacked');
  const [thumbnailSize, setThumbnailSize] = useState<ThumbnailSize>('large');
  const [posterRatingStyle, setPosterRatingStyle] = useState<RatingStyle>('glass');
  const [backdropRatingStyle, setBackdropRatingStyle] = useState<RatingStyle>('glass');
  const [rankingCountry, setRankingCountry] = useState('global');
  const [rankingCountryTouched, setRankingCountryTouched] = useState(false);
  const [rankingNoBox, setRankingNoBox] = useState(false);
  const [rankingCompact, setRankingCompact] = useState(false);
  const [rankingPosition, setRankingPosition] = useState<RankingPosition>('auto');
  const updateRankingCountry = useCallback((value: SetStateAction<string>) => {
    setRankingCountryTouched(true);
    setRankingCountry(value);
  }, []);
  const [thumbnailRatingStyle, setThumbnailRatingStyle] = useState<RatingStyle>('glass');
  const [logoRatingStyle, setLogoRatingStyle] = useState<RatingStyle>('plain');
  const [posterRatingsMaxPerSide, setPosterRatingsMaxPerSide] = useState<number | null>(DEFAULT_POSTER_RATINGS_MAX_PER_SIDE);
  const [logoRatingsMax, setLogoRatingsMax] = useState<number | null>(5);
  const [backdropRatingsMax, setBackdropRatingsMax] = useState<number | null>(DEFAULT_BACKDROP_RATINGS_MAX);
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
  const [fanartKey, setFanartKey] = useState('');
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
  const [currentVersion, setCurrentVersion] = useState(initialVersion);
  const [githubPackageVersion, setGithubPackageVersion] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'with' | 'without'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const [activeToken, setActiveToken] = useState<string | null>(initialToken);
  const [configSaveStatus, setConfigSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const navRef = useRef<HTMLElement | null>(null);
  const isHydrated = useRef(false);
  const isPreviewHydrated = useRef(false);
  const baseUrl = normalizeBaseUrl(useClientOrigin());
  const hasTmdbKey = tmdbKey.length > 10;
  const supportedLanguages: SupportedLanguage[] = useMemo(
    () =>
      buildSupportedLanguageList({
        languages: hasTmdbKey ? tmdbLanguages : [],
        primaryTranslations: hasTmdbKey ? tmdbPrimaryTranslations : [],
      }),
    [tmdbLanguages, tmdbPrimaryTranslations, hasTmdbKey]
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
  }, [effectiveLang, posterLang]);
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

  const effectiveRankingCountry = rankingCountryTouched
    ? rankingCountry
    : getJustWatchCountryForLanguage(effectiveLang);

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
  const shouldShowPosterQualityBadgesSide = false;
  const shouldShowPosterQualityBadgesPosition =
    posterRatingsLayout === 'top' || posterRatingsLayout === 'bottom' || posterRatingsLayout === 'top-bottom';
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
    const storedFanartKey = safeLocalStorageGet(FANART_KEY_STORAGE_KEY);
    const storedToken = safeLocalStorageGet(ERDB_TOKEN_STORAGE_KEY);
    if (!storedTmdbKey && !storedMdblistKey && !storedSimklClientId && !storedToken) {
      isHydrated.current = true;
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
      if (storedFanartKey) {
        setFanartKey(storedFanartKey);
      }
      if (!initialToken && storedToken) {
        setActiveToken(storedToken);
      }
      isHydrated.current = true;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [initialToken]);

  useEffect(() => {
    if (!isHydrated.current) return;
    if (activeToken) {
      safeLocalStorageSet(ERDB_TOKEN_STORAGE_KEY, activeToken);
    } else {
      safeLocalStorageRemove(ERDB_TOKEN_STORAGE_KEY);
    }
  }, [activeToken]);

  useEffect(() => {
    if (!isHydrated.current) return;
    if (tmdbKey) {
      safeLocalStorageSet(TMDB_KEY_STORAGE_KEY, tmdbKey);
    } else {
      safeLocalStorageRemove(TMDB_KEY_STORAGE_KEY);
    }
  }, [tmdbKey]);

  useEffect(() => {
    if (!isHydrated.current) return;
    if (mdblistKey) {
      safeLocalStorageSet(MDBLIST_KEY_STORAGE_KEY, mdblistKey);
    } else {
      safeLocalStorageRemove(MDBLIST_KEY_STORAGE_KEY);
    }
  }, [mdblistKey]);

  useEffect(() => {
    if (!isHydrated.current) return;
    if (simklClientId) {
      safeLocalStorageSet(SIMKL_CLIENT_ID_STORAGE_KEY, simklClientId);
    } else {
      safeLocalStorageRemove(SIMKL_CLIENT_ID_STORAGE_KEY);
    }
  }, [simklClientId]);

  useEffect(() => {
    if (!isHydrated.current) return;
    if (fanartKey) {
      safeLocalStorageSet(FANART_KEY_STORAGE_KEY, fanartKey);
    } else {
      safeLocalStorageRemove(FANART_KEY_STORAGE_KEY);
    }
  }, [fanartKey]);

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

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json();
      })
      .then((payload) => {
        if (cancelled || !payload || typeof payload !== 'object') return;
        if (typeof payload.userCount === 'number') {
          setUserCount(payload.userCount);
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
      isSimplePosterPreset
        ? 'plain'
        : previewType === 'poster'
          ? posterRatingStyle
          : previewType === 'backdrop'
            ? backdropRatingStyle
            : previewType === 'thumbnail'
              ? thumbnailRatingStyle
              : logoRatingStyle;
    const imageTextForType =
      isSimplePosterPreset ? 'clean' : previewType === 'backdrop' || previewType === 'thumbnail' ? backdropImageText : posterImageText;
    const streamBadgesForType =
      previewType === 'backdrop' || previewType === 'thumbnail' ? backdropStreamBadges : posterStreamBadges;
    const qualityBadgesStyleForType =
      previewType === 'backdrop' || previewType === 'thumbnail'
        ? backdropQualityBadgesStyle
        : isSimplePosterPreset
          ? 'plain'
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
      query.set('posterAnimeImageText', isSimplePosterPreset ? 'default' : posterAnimeImageText);
      if (isSimplePosterPreset && posterSimpleRatingSource !== 'average') {
        query.set('posterRatings', posterSimpleRatingSource);
      } else {
        query.set('posterRatings', ratingsQuery);
      }
      if (isSimplePosterPreset || shouldUsePosterAverageRatings) {
        query.set('posterRatingsMode', 'average');
      }
      if (posterGenrePosition !== 'off') {
        query.set('posterGenrePosition', posterGenrePosition);
      }
      if (isSimplePosterPreset) {
        query.set('posterConfiguratorPreset', 'simple');
      }
    } else if (previewType === 'backdrop') {
      if (backdropLang) {
        query.set('backdropLang', effectiveBackdropLang);
      }
      if (backdropAnimeLang) {
        query.set('backdropAnimeLang', effectiveBackdropAnimeLang);
      }
      query.set('backdropAnimeImageText', backdropAnimeImageText);
      query.set('backdropRatings', ratingsQuery);
      if (backdropRatingsMax !== null) {
        query.set('backdropRatingsMax', String(backdropRatingsMax));
      }
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
    if (fanartKey) {
      query.set('fanartKey', fanartKey);
    }
    if (tmdbKey) {
      query.set('tmdbKey', tmdbKey);
    }

    if (previewType === 'poster' || previewType === 'backdrop') {
      query.set('imageText', imageTextForType);
    }
    if (previewType === 'poster') {
      const effectivePosterRatingsLayout = posterRatingsLayout;
      query.set('posterRatingsLayout', effectivePosterRatingsLayout);
      if (isVerticalPosterRatingLayout(effectivePosterRatingsLayout) && posterRatingsMaxPerSide !== null) {
        query.set('posterRatingsMaxPerSide', String(posterRatingsMaxPerSide));
      }
      if (!isSimplePosterPreset && isVerticalPosterRatingLayout(posterRatingsLayout) && posterVerticalBadgeContent !== 'standard') {
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
    if (previewType === 'poster' && ranking !== 'off') {
      query.set('ranking', ranking);
      if (effectiveRankingCountry !== 'global') {
        query.set('rankingCountry', effectiveRankingCountry);
      }
      if (rankingNoBox) {
        query.set('rankingNoBox', 'on');
      }
      if (rankingCompact) {
        query.set('rankingCompact', 'on');
      }
      if (rankingPosition !== 'auto') {
        query.set('rankingPosition', rankingPosition);
      }
    }
    if (previewType === 'poster' && !posterVignetteEnabled) {
      query.set('posterVignette', 'off');
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
    backdropRatingsMax,
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
    fanartKey,
    tmdbKey,
    isSimplePosterPreset,
    shouldUsePosterAverageRatings,
    posterGenrePosition,
    posterSimpleRatingSource,
    ranking,
    effectiveRankingCountry,
    rankingNoBox,
    rankingCompact,
    rankingPosition,
    posterVignetteEnabled,
  ]);

  const configString = useMemo(() => {
    const tmdb = tmdbKey.trim();
    const mdb = mdblistKey.trim();
    const simkl = simklClientId.trim();
    const fanart = fanartKey.trim();
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
    if (fanart) {
      config.fanartKey = fanart;
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
      config.posterAnimeImageText = posterConfiguratorPreset === 'simple' ? 'default' : posterAnimeImageText;
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
    const effectivePosterStreamBadges = posterStreamBadges;
    if (effectivePosterStreamBadges !== 'auto') {
      config.posterStreamBadges = effectivePosterStreamBadges;
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
    if (posterConfiguratorPreset === 'simple') {
      config.posterQualityBadgesStyle = 'plain';
    } else if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.posterQualityBadgesStyle = posterQualityBadgesStyle;
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.backdropQualityBadgesStyle = backdropQualityBadgesStyle;
    }
    if (posterConfiguratorPreset !== 'simple' && posterRatingStyle) {
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
      config.posterImageText = posterConfiguratorPreset === 'simple' ? 'clean' : posterImageText;
    }
    if (backdropImageText) {
      config.backdropImageText = backdropImageText;
    }
    if (posterConfiguratorPreset === 'simple') {
      config.posterConfiguratorPreset = 'simple';
      config.posterRatingsMode = 'average';
      if (posterSimpleRatingSource !== 'average') {
        config.posterRatings = posterSimpleRatingSource;
      }
      config.posterRatingStyle = 'plain';
      config.posterRatingsLayout = posterRatingsLayout;
      if (posterGenrePosition !== 'off') {
        config.posterGenrePosition = posterGenrePosition;
      }
    } else if (posterRatingsLayout) {
      if (posterAverageRatingsEnabled) {
        config.posterRatingsMode = 'average';
      }
      config.posterRatingsLayout = posterRatingsLayout;
      if (posterGenrePosition !== 'off') {
        config.posterGenrePosition = posterGenrePosition;
      }
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = posterRatingsMaxPerSide;
    }
    if (logoRatingsMax !== null) {
      config.logoRatingsMax = logoRatingsMax;
    }
    if (backdropRatingsMax !== null) {
      config.backdropRatingsMax = backdropRatingsMax;
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
    if (ranking !== 'off') {
      config.ranking = ranking;
      if (effectiveRankingCountry !== 'global') {
        config.rankingCountry = effectiveRankingCountry;
      }
      if (rankingNoBox) {
        config.rankingNoBox = 'on';
      }
      if (rankingCompact) {
        config.rankingCompact = 'on';
      }
      if (rankingPosition !== 'auto') {
        config.rankingPosition = rankingPosition;
      }
    }
    if (!posterVignetteEnabled) {
      config.posterVignette = 'off';
    }

    return encodeBase64Url(JSON.stringify(config));
  }, [
    baseUrl,
    tmdbKey,
    mdblistKey,
    simklClientId,
    fanartKey,
    posterRatingPreferences,
    backdropRatingPreferences,
    thumbnailRatingPreferences,
    logoRatingPreferences,
    posterConfiguratorPreset,
    posterAverageRatingsEnabled,
    posterGenrePosition,
    posterSimpleRatingSource,
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
    backdropAnimeImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    backdropRatingsMax,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    thumbnailRatingStyle,
    ranking,
    effectiveRankingCountry,
    rankingNoBox,
    rankingCompact,
    rankingPosition,
    posterVignetteEnabled,
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
    config.posterAnimeImageText = posterConfiguratorPreset === 'simple' ? 'default' : posterAnimeImageText;
    config.backdropAnimeImageText = backdropAnimeImageText;
    const proxyEffectivePosterStreamBadges = posterStreamBadges;
    if (proxyEffectivePosterStreamBadges !== 'auto') {
      config.posterStreamBadges = proxyEffectivePosterStreamBadges;
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
    if (posterConfiguratorPreset === 'simple') {
      config.posterQualityBadgesStyle = 'plain';
    } else if (posterQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.posterQualityBadgesStyle = posterQualityBadgesStyle;
    }
    if (backdropQualityBadgesStyle !== DEFAULT_QUALITY_BADGES_STYLE) {
      config.backdropQualityBadgesStyle = backdropQualityBadgesStyle;
    }
    if (posterConfiguratorPreset === 'simple') {
      config.posterConfiguratorPreset = 'simple';
      config.posterRatingsMode = 'average';
      if (posterSimpleRatingSource !== 'average') {
        config.posterRatings = posterSimpleRatingSource;
      }
      config.posterRatingStyle = 'plain';
      config.posterRatingsLayout = posterRatingsLayout;
      if (posterGenrePosition !== 'off') {
        config.posterGenrePosition = posterGenrePosition;
      }
    } else {
      if (posterRatingStyle) config.posterRatingStyle = posterRatingStyle;
      if (posterRatingsLayout) {
        if (posterAverageRatingsEnabled) {
          config.posterRatingsMode = 'average';
        }
        config.posterRatingsLayout = posterRatingsLayout;
        if (posterGenrePosition !== 'off') {
          config.posterGenrePosition = posterGenrePosition;
        }
      }
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = posterRatingsMaxPerSide;
    }
    if (backdropRatingStyle) config.backdropRatingStyle = backdropRatingStyle;
    if (thumbnailRatingStyle) config.thumbnailRatingStyle = thumbnailRatingStyle;
    if (logoRatingStyle) config.logoRatingStyle = logoRatingStyle;
    config.logoMode = logoMode;
    config.logoFontVariant = logoFontVariant;
    config.logoPrimary = logoCustomPrimary;
    config.logoSecondary = logoCustomSecondary;
    config.logoOutline = logoCustomOutline;
    config.posterImageText = posterConfiguratorPreset === 'simple' ? 'clean' : posterImageText;
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

    if (posterConfiguratorPreset === 'simple') {
      config.posterConfiguratorPreset = 'simple';
      config.posterRatingsMode = 'average';
      if (posterSimpleRatingSource !== 'average') {
        config.posterRatings = posterSimpleRatingSource;
      }
      config.posterRatingStyle = 'plain';
      config.posterRatingsLayout = posterRatingsLayout;
      if (posterGenrePosition !== 'off') {
        config.posterGenrePosition = posterGenrePosition;
      }
    } else if (posterRatingsLayout) {
      if (posterAverageRatingsEnabled) {
        config.posterRatingsMode = 'average';
      }
      config.posterRatingsLayout = posterRatingsLayout;
      if (posterGenrePosition !== 'off') {
        config.posterGenrePosition = posterGenrePosition;
      }
    }
    if (isVerticalPosterRatingLayout(posterRatingsLayout) && posterRatingsMaxPerSide !== null) {
      config.posterRatingsMaxPerSide = String(posterRatingsMaxPerSide);
    }
    if (logoRatingsMax !== null) {
      config.logoRatingsMax = String(logoRatingsMax);
    }
    if (backdropRatingsMax !== null) {
      config.backdropRatingsMax = String(backdropRatingsMax);
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
    if (ranking !== 'off') {
      config.ranking = ranking;
      if (effectiveRankingCountry !== 'global') {
        config.rankingCountry = effectiveRankingCountry;
      }
      if (rankingNoBox) {
        config.rankingNoBox = 'on';
      }
      if (rankingCompact) {
        config.rankingCompact = 'on';
      }
      if (rankingPosition !== 'auto') {
        config.rankingPosition = rankingPosition;
      }
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
    posterAnimeImageText,
    backdropImageText,
    backdropAnimeImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    backdropRatingsMax,
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
    posterConfiguratorPreset,
    posterAverageRatingsEnabled,
    posterGenrePosition,
    posterSimpleRatingSource,
    ranking,
    effectiveRankingCountry,
    rankingNoBox,
    rankingCompact,
    rankingPosition,
  ]);

  const stremioInstallUrl = useMemo(() => {
    if (!proxyUrl) return '';
    return proxyUrl.replace(/^https?:\/\//, 'stremio://');
  }, [proxyUrl]);

  const aiometadataPatterns = useMemo(() => {
    const episodePattern = buildAiometadataPatternBlock({
      baseUrl,
      activeToken,
      imageType: 'thumbnail',
      configString,
      idPattern: buildEpisodeThumbnailIdPattern(aiometadataEpisodeProvider),
      ranking,
      rankingCountry: effectiveRankingCountry,
      rankingNoBox,
    });

    return {
      poster: buildAiometadataPatternBlock({
        baseUrl,
        activeToken,
        imageType: 'poster',
        configString,
        idPattern: 'tmdb:{type}:{tmdb_id}',
        ranking,
        rankingCountry: effectiveRankingCountry,
        rankingNoBox,
      }),
      background: buildAiometadataPatternBlock({
        baseUrl,
        activeToken,
        imageType: 'backdrop',
        configString,
        idPattern: 'tmdb:{type}:{tmdb_id}',
        ranking,
        rankingCountry: effectiveRankingCountry,
        rankingNoBox,
      }),
      logo: buildAiometadataPatternBlock({
        baseUrl,
        activeToken,
        imageType: 'logo',
        configString,
        idPattern: 'tmdb:{type}:{tmdb_id}',
        ranking,
        rankingCountry: effectiveRankingCountry,
        rankingNoBox,
      }),
      episodeThumbnail: episodePattern,
    };
  }, [
    baseUrl,
    activeToken,
    configString,
    aiometadataEpisodeProvider,
    ranking,
    effectiveRankingCountry,
    rankingNoBox,
    rankingCompact,
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
      posterGenrePosition,
      posterVignetteEnabled,
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
      backdropRatingsMax,
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
      ranking,
      rankingCountry: effectiveRankingCountry,
      rankingNoBox,
      rankingCompact,
      rankingPosition,
    };

    if (includeKeys) {
      payload.tmdbKey = tmdbKey;
      payload.mdblistKey = mdblistKey;
      payload.simklClientId = simklClientId;
      payload.fanartKey = fanartKey;
    }

    const filename = includeKeys ? 'erdb-config-with-keys.json' : 'erdb-config.json';
    downloadJsonFile(payload, filename);
    setExportStatus(includeKeys ? 'with' : 'without');
    setTimeout(() => setExportStatus('idle'), 2000);
  };

  const applyImportedConfig = useCallback((
    payload: Record<string, unknown>,
    options: { includeProxy?: boolean } = {}
  ) => {
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
    if (typeof payload.fanartKey === 'string') {
      setFanartKey(payload.fanartKey);
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
    if (payload.posterConfiguratorPreset === 'simple' || payload.posterRatingsMode === 'average') {
      if (payload.posterConfiguratorPreset === 'simple') {
        setPosterConfiguratorPreset('simple');
      } else {
        setPosterAverageRatingsEnabled(true);
      }
    } else if (payload.posterConfiguratorPreset === 'advanced') {
      setPosterConfiguratorPreset('advanced');
    }
    if (
      typeof payload.posterSimpleRatingSource === 'string' &&
      (payload.posterSimpleRatingSource === 'average' || isRatingProviderId(payload.posterSimpleRatingSource))
    ) {
      setPosterSimpleRatingSource(payload.posterSimpleRatingSource as 'average' | RatingPreference);
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
    if (typeof payload.posterConfiguratorPreset === 'string' && (payload.posterConfiguratorPreset === 'simple' || payload.posterConfiguratorPreset === 'advanced')) {
      setPosterConfiguratorPreset(payload.posterConfiguratorPreset);
    }
    if (typeof payload.posterAverageRatingsEnabled === 'boolean') {
      setPosterAverageRatingsEnabled(payload.posterAverageRatingsEnabled);
    } else if (typeof payload.posterRatingsMode === 'string' && (payload.posterRatingsMode === 'average' || payload.posterRatingsMode === 'separate')) {
      setPosterAverageRatingsEnabled(payload.posterRatingsMode === 'average');
    }
    if (typeof payload.posterGenrePosition === 'string' && isPosterGenrePosition(payload.posterGenrePosition)) {
      setPosterGenrePosition(payload.posterGenrePosition);
    }
    if (typeof payload.posterVignetteEnabled === 'boolean') {
      setPosterVignetteEnabled(payload.posterVignetteEnabled);
    } else if (payload.posterVignette === 'off') {
      setPosterVignetteEnabled(false);
    } else if (payload.posterVignette === 'on') {
      setPosterVignetteEnabled(true);
    }
    if (typeof payload.ranking === 'string') {
      setRanking(payload.ranking);
    }
    if (typeof payload.rankingCountry === 'string') {
      setRankingCountry(payload.rankingCountry);
    }
    if (typeof payload.rankingNoBox === 'boolean') {
      setRankingNoBox(payload.rankingNoBox);
    } else if (payload.rankingNoBox === 'on') {
      setRankingNoBox(true);
    }
    if (typeof payload.rankingCompact === 'boolean') {
      setRankingCompact(payload.rankingCompact);
    } else if (payload.rankingCompact === 'on') {
      setRankingCompact(true);
    }
    if (typeof payload.rankingPosition === 'string') {
      setRankingPosition(normalizeRankingPosition(payload.rankingPosition));
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
    if (payload.backdropRatingsMax === null) {
      setBackdropRatingsMax(null);
    } else if (typeof payload.backdropRatingsMax === 'number' || typeof payload.backdropRatingsMax === 'string') {
      setBackdropRatingsMax(normalizeBackdropRatingsMax(payload.backdropRatingsMax));
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
  }, [setPosterConfiguratorPreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPreviewConfig = safeLocalStorageGet(PREVIEW_CONFIG_STORAGE_KEY);
    if (!storedPreviewConfig) {
      isPreviewHydrated.current = true;
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      try {
        const parsed = JSON.parse(storedPreviewConfig) as Record<string, unknown>;
        applyImportedConfig(parsed);
      } catch {
        safeLocalStorageRemove(PREVIEW_CONFIG_STORAGE_KEY);
      }
      isPreviewHydrated.current = true;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [applyImportedConfig]);

  useEffect(() => {
    if (!initialConfig) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      applyImportedConfig(initialConfig, { includeProxy: false });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [applyImportedConfig, initialConfig]);

  useEffect(() => {
    if (!isPreviewHydrated.current) return;
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
      posterConfiguratorPreset,
      posterAverageRatingsEnabled,
      posterGenrePosition,
      posterVignette: posterVignetteEnabled ? 'on' : 'off',
      posterSimpleRatingSource,
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
      backdropRatingsMax,
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
      proxyCatalogNames: sanitizedProxyCatalogNames,
      proxyHiddenCatalogs: sanitizedProxyHiddenCatalogs,
      proxySearchDisabledCatalogs: sanitizedProxySearchDisabledCatalogs,
      proxyDiscoverOnlyCatalogs: sanitizedProxyDiscoverOnlyCatalogs,
      ranking,
      rankingCountry: effectiveRankingCountry,
      rankingNoBox: rankingNoBox ? 'on' : undefined,
      rankingCompact: rankingCompact ? 'on' : undefined,
      rankingPosition,
    };
    safeLocalStorageSet(PREVIEW_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  }, [
    previewType,
    mediaId,
    effectiveLang,
    posterSimpleRatingSource,
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
    posterConfiguratorPreset,
    posterAverageRatingsEnabled,
    posterGenrePosition,
    posterVignetteEnabled,
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
    backdropRatingsMax,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    thumbnailRatingStyle,
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
    ranking,
    effectiveRankingCountry,
    rankingNoBox,
    rankingCompact,
    rankingPosition,
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
      posterAverageRatingsEnabled,
      posterGenrePosition,
      posterVignetteEnabled,
      posterConfiguratorPreset,
      posterSimpleRatingSource,
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
      backdropRatingsMax,
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
      fanartKey,
      ranking,
      rankingCountry: effectiveRankingCountry,
      rankingNoBox,
      rankingCompact,
      rankingPosition,
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
      posterAverageRatingsEnabled,
      posterGenrePosition,
      posterVignetteEnabled,
      posterConfiguratorPreset,
      posterSimpleRatingSource,
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
      backdropRatingsMax,
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
      fanartKey,
      ranking,
      effectiveRankingCountry,
      rankingNoBox,
      rankingCompact,
      rankingPosition,
    ]
  );

  const persistedTokenConfigPayload = useMemo(
    () => ({
      version: EXPORT_CONFIG_VERSION,
      lang: effectiveLang,
      posterLang,
      posterAnimeLang,
      backdropLang,
      backdropAnimeLang,
      logoLang,
      logoAnimeLang,
      posterImageText,
      posterAnimeImageText,
      posterConfiguratorPreset,
      posterAverageRatingsEnabled,
      posterGenrePosition,
      posterVignette: posterVignetteEnabled ? 'on' : 'off',
      posterSimpleRatingSource,
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
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      backdropRatingsMax,
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
      fanartKey,
      ranking,
      rankingCountry: effectiveRankingCountry,
      rankingNoBox: rankingNoBox ? 'on' : undefined,
      rankingCompact: rankingCompact ? 'on' : undefined,
      rankingPosition,
    }),
    [
      effectiveLang,
      posterLang,
      posterAnimeLang,
      backdropLang,
      backdropAnimeLang,
      logoLang,
      logoAnimeLang,
      posterImageText,
      posterAnimeImageText,
      posterConfiguratorPreset,
      posterAverageRatingsEnabled,
      posterGenrePosition,
      posterVignetteEnabled,
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
      posterRatingsLayout,
      posterRatingsMaxPerSide,
      logoRatingsMax,
      backdropRatingsMax,
      backdropRatingsLayout,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      posterSimpleRatingSource,
      tmdbKey,
      mdblistKey,
      simklClientId,
      fanartKey,
      ranking,
      effectiveRankingCountry,
      rankingNoBox,
      rankingCompact,
      rankingPosition,
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
    isSimplePosterPreset
      ? 'plain'
      : previewType === 'poster'
        ? posterRatingStyle
        : previewType === 'backdrop'
          ? backdropRatingStyle
          : previewType === 'thumbnail'
            ? thumbnailRatingStyle
            : logoRatingStyle;
  const activeImageText =
    isSimplePosterPreset ? 'clean' : previewType === 'backdrop' || previewType === 'thumbnail' ? backdropImageText : posterImageText;
  const styleLabel =
    previewType === 'poster'
      ? 'Poster Ratings Style'
      : previewType === 'backdrop'
        ? 'Backdrop Ratings Style'
        : previewType === 'thumbnail'
          ? 'Thumbnail Ratings Style'
          : 'Logo Ratings Style';
  const textLabel =
    previewType === 'backdrop' ? 'Text on Backdrop' : previewType === 'thumbnail' ? 'Text on Thumbnail' : 'Text on Poster';
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
  const enabledRatingCount = visibleRatingProviderRows.filter(r => r.enabled).length;
  const tooManyRatings = previewType === 'poster'
    ? isVerticalPosterRatingLayout(posterRatingsLayout) &&
      !shouldUsePosterAverageRatings &&
      posterStreamBadges !== 'off' && ranking !== 'off' && posterGenrePosition !== 'off' &&
      posterRatingsMaxPerSide === null &&
      !(rankingPosition === 'top' && posterGenrePosition === 'bottom' && posterVerticalBadgeContent === 'stacked') &&
      !rankingCompact &&
      enabledRatingCount > (posterRatingsLayout === 'left-right'
        ? (posterVerticalBadgeContent === 'stacked' ? 4 : 8) + (posterImageText === 'clean' ? 0 : 2)
        : (posterVerticalBadgeContent === 'stacked' ? 2 : 4) + (posterImageText === 'clean' ? 0 : 1))
    : previewType === 'backdrop'
      ? backdropRatingsMax !== null && enabledRatingCount > backdropRatingsMax
      : previewType === 'logo'
        ? logoRatingsMax !== null && enabledRatingCount > logoRatingsMax
        : false;
  const previewNotice =
    !tmdbKey.trim()
      ? 'Enter a TMDB API Key to generate previews.'
      : !mdblistKey.trim()
        ? 'Enter an MDBList API Key to generate previews.'
        : previewType === 'thumbnail' && !EPISODE_ID_PATTERN.test(mediaId.trim())
          ? 'Movies are not supported for thumbnails.'
          : tooManyRatings
            ? `Too many ratings — set Max / Side to ${(posterVerticalBadgeContent === 'stacked' ? 2 : 4) + (posterImageText === 'clean' ? 0 : 1)} or fewer to avoid missing the Ranking badge.`
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
      fanartKey,
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
      backdropRatingsMax,
      backdropRatingsSize,
      thumbnailRatingsLayout,
      posterVerticalBadgeContent,
      backdropVerticalBadgeContent,
      thumbnailVerticalBadgeContent,
      thumbnailSize,
      posterConfiguratorPreset,
      posterAverageRatingsEnabled,
      posterVignetteEnabled,
      posterGenrePosition,
      posterSimpleRatingSource,
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
      ranking,
      rankingCountry: effectiveRankingCountry,
      rankingNoBox,
      rankingCompact,
      rankingPosition,
    },
    derived: {
      baseUrl,
      previewUrl,
      proxyUrl,
      stremioInstallUrl,
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
      userCount,
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
      setFanartKey,
      setPosterRatingsLayout,
      setPosterRatingsMaxPerSide,
      setLogoRatingsMax,
      setLogoMode,
      setLogoFontVariant,
      setLogoCustomPrimary,
      setLogoCustomSecondary,
      setLogoCustomOutline,
      setBackdropRatingsLayout,
      setBackdropRatingsMax,
      setBackdropRatingsSize,
      setThumbnailRatingsLayout,
      setPosterVerticalBadgeContent,
      setBackdropVerticalBadgeContent,
      setThumbnailVerticalBadgeContent,
      setThumbnailSize,
      setPosterConfiguratorPreset,
      setPosterAverageRatingsEnabled,
      setPosterVignetteEnabled,
      setPosterGenrePosition,
      setPosterSimpleRatingSource,
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
      setRanking,
      setRankingCountry: updateRankingCountry,
      setRankingNoBox,
      setRankingCompact,
      setRankingPosition,
    },
  };

  return { mode, viewProps };
}

