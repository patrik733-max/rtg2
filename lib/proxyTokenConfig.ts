import { stringifyRatingPreferencesAllowEmpty } from '@/lib/ratingPreferences';
import type { ProxyConfig } from '@/lib/addonProxy';

export const buildProxyConfigFromToken = (
  t: Record<string, any>,
  manifestUrlOverride?: string | null,
  proxyOverrides?: Record<string, any> | null
): ProxyConfig | null => {
  const url =
    (typeof manifestUrlOverride === 'string' && manifestUrlOverride) ||
    (typeof t.proxyManifestUrl === 'string' ? t.proxyManifestUrl : t.url);
  if (!url || typeof url !== 'string') return null;
  const tmdbKey = typeof t.tmdbKey === 'string' ? t.tmdbKey : null;
  const mdblistKey = typeof t.mdblistKey === 'string' ? t.mdblistKey : null;
  if (!tmdbKey || !mdblistKey) return null;

  const config: ProxyConfig = { url, tmdbKey, mdblistKey };
  
  if (typeof proxyOverrides?.baseUrl === 'string') config.baseUrl = proxyOverrides.baseUrl;
  else if (typeof t.baseUrl === 'string') config.baseUrl = t.baseUrl;
  if (typeof proxyOverrides?.erdbBase === 'string') config.erdbBase = proxyOverrides.erdbBase;
  else if (typeof t.erdbBase === 'string') config.erdbBase = t.erdbBase; // fallback
  if (typeof t.simklClientId === 'string') config.simklClientId = t.simklClientId;
  if (typeof t.lang === 'string') config.lang = t.lang;
  if (typeof t.posterLang === 'string') config.posterLang = t.posterLang;
  if (typeof t.posterAnimeLang === 'string') config.posterAnimeLang = t.posterAnimeLang;
  if (typeof t.backdropLang === 'string') config.backdropLang = t.backdropLang;
  if (typeof t.backdropAnimeLang === 'string') config.backdropAnimeLang = t.backdropAnimeLang;
  if (typeof t.logoLang === 'string') config.logoLang = t.logoLang;
  if (typeof t.logoAnimeLang === 'string') config.logoAnimeLang = t.logoAnimeLang;

  if (Array.isArray(t.posterRatingPreferences)) {
    const pQ = stringifyRatingPreferencesAllowEmpty(t.posterRatingPreferences);
    const bQ = stringifyRatingPreferencesAllowEmpty(Array.isArray(t.backdropRatingPreferences) ? t.backdropRatingPreferences : []);
    const tQ = stringifyRatingPreferencesAllowEmpty(Array.isArray(t.thumbnailRatingPreferences) ? t.thumbnailRatingPreferences : []);
    const lQ = stringifyRatingPreferencesAllowEmpty(Array.isArray(t.logoRatingPreferences) ? t.logoRatingPreferences : []);
    if (pQ === bQ && pQ === tQ && pQ === lQ) config.ratings = pQ;
    else {
      config.posterRatings = pQ;
      config.backdropRatings = bQ;
      config.thumbnailRatings = tQ;
      config.logoRatings = lQ;
    }
  }

  const mapStr = (tk: string, pk: keyof ProxyConfig | 'thumbnailRatingStyle') => { if (typeof t[tk] === 'string') (config as any)[pk] = t[tk]; };
  mapStr('posterStreamBadges', 'posterStreamBadges');
  mapStr('backdropStreamBadges', 'backdropStreamBadges');
  mapStr('qualityBadgesSide', 'qualityBadgesSide');
  mapStr('posterQualityBadgesPosition', 'posterQualityBadgesPosition');
  mapStr('posterQualityBadgesStyle', 'posterQualityBadgesStyle');
  mapStr('backdropQualityBadgesStyle', 'backdropQualityBadgesStyle');
  mapStr('posterRatingStyle', 'posterRatingStyle');
  mapStr('backdropRatingStyle', 'backdropRatingStyle');
  mapStr('thumbnailRatingStyle', 'thumbnailRatingStyle');
  mapStr('logoRatingStyle', 'logoRatingStyle');
  mapStr('logoMode', 'logoMode');
  mapStr('logoFontVariant', 'logoFontVariant');
  mapStr('logoCustomPrimary', 'logoPrimary');
  mapStr('logoCustomSecondary', 'logoSecondary');
  mapStr('logoCustomOutline', 'logoOutline');
  mapStr('posterImageText', 'posterImageText');
  mapStr('posterAnimeImageText', 'posterAnimeImageText');
  mapStr('backdropImageText', 'backdropImageText');
  mapStr('backdropAnimeImageText', 'backdropAnimeImageText');
  mapStr('posterRatingsLayout', 'posterRatingsLayout');
  mapStr('posterGenrePosition', 'posterGenrePosition');
  mapStr('backdropRatingsLayout', 'backdropRatingsLayout');
  mapStr('backdropRatingsSize', 'backdropRatingsSize');
  mapStr('thumbnailRatingsLayout', 'thumbnailRatingsLayout');
  mapStr('posterVerticalBadgeContent', 'posterVerticalBadgeContent');
  mapStr('backdropVerticalBadgeContent', 'backdropVerticalBadgeContent');
  mapStr('thumbnailVerticalBadgeContent', 'thumbnailVerticalBadgeContent');
  mapStr('thumbnailSize', 'thumbnailSize');
  mapStr('ranking', 'ranking');
  mapStr('rankingCountry', 'rankingCountry');
  mapStr('rankingPosition', 'rankingPosition');
  mapStr('posterSimpleRatingSource', 'posterSimpleRatingSource');

  if (typeof t.posterAverageRatingsEnabled === 'boolean' || typeof t.posterAverageRatingsEnabled === 'string') {
    config.posterAverageRatingsEnabled = t.posterAverageRatingsEnabled;
  }
  if (typeof t.posterVignette === 'boolean' || typeof t.posterVignette === 'string') {
    config.posterVignette = t.posterVignette;
  }
  if (typeof t.rankingNoBox === 'boolean' || typeof t.rankingNoBox === 'string') {
    config.rankingNoBox = t.rankingNoBox;
  }
  if (typeof t.rankingCompact === 'boolean' || typeof t.rankingCompact === 'string') {
    config.rankingCompact = t.rankingCompact;
  }

  if (typeof t.posterRatingsMaxPerSide === 'number') config.posterRatingsMaxPerSide = String(t.posterRatingsMaxPerSide);
  if (typeof t.logoRatingsMax === 'number') config.logoRatingsMax = String(t.logoRatingsMax);
  if (typeof t.backdropRatingsMax === 'number') config.backdropRatingsMax = String(t.backdropRatingsMax);
  if (typeof t.fanartKey === 'string' && t.fanartKey.length > 0) config.fanartKey = t.fanartKey;

  if (proxyOverrides && typeof proxyOverrides === 'object') {
    if (typeof proxyOverrides.posterEnabled === 'boolean') config.posterEnabled = proxyOverrides.posterEnabled;
    if (typeof proxyOverrides.backdropEnabled === 'boolean') config.backdropEnabled = proxyOverrides.backdropEnabled;
    if (typeof proxyOverrides.logoEnabled === 'boolean') config.logoEnabled = proxyOverrides.logoEnabled;
    if (typeof proxyOverrides.thumbnailEnabled === 'boolean') config.thumbnailEnabled = proxyOverrides.thumbnailEnabled;
  } else if (t.proxyEnabledTypes && typeof t.proxyEnabledTypes === 'object') {
    if (typeof t.proxyEnabledTypes.poster === 'boolean') config.posterEnabled = t.proxyEnabledTypes.poster;
    if (typeof t.proxyEnabledTypes.backdrop === 'boolean') config.backdropEnabled = t.proxyEnabledTypes.backdrop;
    if (typeof t.proxyEnabledTypes.logo === 'boolean') config.logoEnabled = t.proxyEnabledTypes.logo;
    if (typeof t.proxyEnabledTypes.thumbnail === 'boolean') config.thumbnailEnabled = t.proxyEnabledTypes.thumbnail;
  }

  if (proxyOverrides?.translateMeta || t.translateMeta || t.proxyTranslateMeta) config.translateMeta = true;

  if (proxyOverrides?.catalogNames || t.proxyCatalogNames || t.catalogNames) {
    config.catalogNames = proxyOverrides?.catalogNames || t.proxyCatalogNames || t.catalogNames;
  }
  if (proxyOverrides?.hiddenCatalogs || t.proxyHiddenCatalogs || t.hiddenCatalogs) {
    config.hiddenCatalogs = proxyOverrides?.hiddenCatalogs || t.proxyHiddenCatalogs || t.hiddenCatalogs;
  }
  if (proxyOverrides?.searchDisabledCatalogs || t.proxySearchDisabledCatalogs || t.searchDisabledCatalogs) {
    config.searchDisabledCatalogs =
      proxyOverrides?.searchDisabledCatalogs || t.proxySearchDisabledCatalogs || t.searchDisabledCatalogs;
  }
  if (proxyOverrides?.discoverOnlyCatalogs || t.proxyDiscoverOnlyCatalogs || t.discoverOnlyCatalogs) {
    config.discoverOnlyCatalogs =
      proxyOverrides?.discoverOnlyCatalogs || t.proxyDiscoverOnlyCatalogs || t.discoverOnlyCatalogs;
  }

  const isAiometadataManifest = config.url.toLowerCase().includes('aiometadata');
  try {
    const isCinemetaManifest = /(^|[-.])cinemeta\.strem\.io$/i.test(new URL(config.url).hostname);
    if (isAiometadataManifest) {
      if (typeof proxyOverrides?.aiometadataProvider === 'string') config.aiometadataProvider = proxyOverrides.aiometadataProvider;
      else if (typeof t.proxyAiometadataProvider === 'string') config.aiometadataProvider = t.proxyAiometadataProvider;
      else if (typeof t.aiometadataProvider === 'string') config.aiometadataProvider = t.aiometadataProvider;
    } else if (!isCinemetaManifest) {
      if (proxyOverrides?.seriesMetadataProvider === 'imdb' || t.proxySeriesMetadataProvider === 'imdb' || t.seriesMetadataProvider === 'imdb') {
        config.seriesMetadataProvider = 'imdb';
      }
    }
  } catch (err) {
    // ignore
  }

  return config;
};

