import { buildGeneratedLogoVariantDataUrl } from '@/lib/imageAssetPipeline';
import { buildGeneratedLogoDataUrl, buildTransparentLogoDataUrl } from '@/lib/imageSvgText';
import { fetchJsonCached } from '@/lib/cachedFetch';
import { type LogoFontVariant } from '@/lib/logoFontVariant';
import { type LogoMode } from '@/lib/logoMode';
import { normalizeRatingValue } from '@/lib/ratingProviderParsing';
import { type RatingPreference } from '@/lib/ratingPreferences';
import { KITSU_CACHE_TTL_MS } from '@/lib/routeConfig';
import { type PhaseDurations, type RenderImageType } from '@/lib/routeTypes';
import { FALLBACK_IMAGE_LANGUAGE } from '@/lib/routeUtils';
import { getTmdbLanguageBase, normalizeTmdbLanguageCode } from '@/lib/tmdbLanguage';
export type AnimeMappingProvider = 'mal' | 'anilist' | 'imdb' | 'tmdb' | 'anidb';
export type AiometadataEpisodeProvider = 'tvdb' | 'realimdb';

const ANIME_MAPPING_PROVIDER_SET = new Set<AnimeMappingProvider>([
  'mal',
  'anilist',
  'imdb',
  'tmdb',
  'anidb',
]);
const AIOMETADATA_EPISODE_PROVIDER_SET = new Set<AiometadataEpisodeProvider>(['tvdb', 'realimdb']);
export const ANIME_NATIVE_INPUT_ID_PREFIX_SET = new Set(['kitsu', 'mal', 'anilist', 'anidb']);
export const toAnimeMappingProvider = (value?: string | null): AnimeMappingProvider | null => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  return ANIME_MAPPING_PROVIDER_SET.has(normalized as AnimeMappingProvider)
    ? (normalized as AnimeMappingProvider)
    : null;
};
export const normalizeAiometadataEpisodeProvider = (value?: string | null): AiometadataEpisodeProvider | null => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return null;
  return AIOMETADATA_EPISODE_PROVIDER_SET.has(normalized as AiometadataEpisodeProvider)
    ? (normalized as AiometadataEpisodeProvider)
    : null;
};
export const normalizeKitsuId = (value: unknown) => {
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

export const normalizeTmdbId = (value: unknown) => {
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

export const extractKitsuIdFromAnimemapping = (payload: any) => {
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

export const normalizeNumericAnimeSiteId = (value: unknown) => {
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

export const extractAnilistIdFromAnimemapping = (payload: any) => {
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

export const extractMalIdFromAnimemapping = (payload: any) => {
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

export const fetchAnimemappingPayload = async ({
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

export const extractTmdbIdFromAnimemapping = (payload: any) => {
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

export const extractAnimeSubtypeFromAnimemapping = (payload: any) => {
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

export const fetchKitsuIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractKitsuIdFromAnimemapping(payload);
};

export const fetchTmdbIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractTmdbIdFromAnimemapping(payload);
};

export const fetchAnilistIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractAnilistIdFromAnimemapping(payload);
};

export const fetchMalIdFromReverseMapping = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  season?: string | null;
  phases: PhaseDurations;
}) => {
  const payload = await fetchAnimemappingPayload(args);
  if (!payload) return null;
  return extractMalIdFromAnimemapping(payload);
};

export const fetchKitsuAnimeAttributes = async (kitsuId: string, phases: PhaseDurations) => {
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

export const pickKitsuImageUrl = (image: any) => {
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

export const normalizeKitsuTitleCandidate = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
};

export const pickKitsuOriginalTitle = (attributes: any) => {
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

export const pickPosterTitleFromMedia = (
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

export const fetchKitsuFallbackAsset = async (
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

  if (imageType === 'thumbnail') {
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

export const fetchKitsuRating = async (kitsuId: string, phases: PhaseDurations) => {
  const attributes = await fetchKitsuAnimeAttributes(kitsuId, phases);
  return normalizeRatingValue(attributes?.averageRating);
};

export const fetchJikanAnimeData = async (malId: string, phases: PhaseDurations) => {
  const normalized = normalizeNumericAnimeSiteId(malId);
  if (!normalized) return null;
  try {
    const response = await fetchJsonCached(
      `jikan:anime:${normalized}:v4`,
      `https://api.jikan.moe/v4/anime/${encodeURIComponent(normalized)}`,
      KITSU_CACHE_TTL_MS,
      phases,
      'mdb'
    );
    if (!response.ok) return null;
    return response.data?.data ?? null;
  } catch {
    return null;
  }
};

export const pickJikanPosterUrl = (data: any) => {
  const candidates = [
    data?.images?.webp?.large_image_url,
    data?.images?.webp?.image_url,
    data?.images?.jpg?.large_image_url,
    data?.images?.jpg?.image_url,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim();
    if (normalized) return normalized;
  }
  return null;
};

export const pickMalTitleForFallback = (data: any) => {
  const candidates = [data?.title_japanese, data?.title, data?.title_english];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }
  return null;
};

export const fetchMalJikanFallbackAsset = async (
  malId: string,
  imageType: RenderImageType,
  logoMode: LogoMode,
  logoFontVariant: LogoFontVariant,
  logoPrimary: string,
  logoSecondary: string,
  logoOutline: string,
  phases: PhaseDurations
) => {
  const data = await fetchJikanAnimeData(malId, phases);
  if (!data) return null;

  const posterUrl = pickJikanPosterUrl(data);
  const rating = normalizeRatingValue(data?.score);
  const originalTitle = pickMalTitleForFallback(data);

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
      imageUrl: posterUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  if (imageType === 'backdrop') {
    return {
      imageUrl: posterUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  if (imageType === 'thumbnail') {
    return {
      imageUrl: posterUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  return {
    imageUrl: posterUrl,
    rating,
    title: originalTitle,
    logoAspectRatio: null,
  };
};

export const pickAnilistCoverUrl = (media: any) => {
  const cover = media?.coverImage;
  const candidates = [cover?.extraLarge, cover?.large, cover?.medium];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim();
    if (normalized) return normalized;
  }
  return null;
};

export const pickAnilistTitleForFallback = (media: any) => {
  const title = media?.title;
  const candidates = [title?.native, title?.romaji, title?.english];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }
  return null;
};

export const fetchAnilistMediaExtended = async (anilistId: string, phases: PhaseDurations) => {
  const normalized = normalizeNumericAnimeSiteId(anilistId);
  if (!normalized) return null;
  const numericId = Number(normalized);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;

  try {
    const response = await fetchJsonCached(
      `anilist:media:${normalized}:extended`,
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
          query: `query ($id: Int) {
            Media(id: $id) {
              averageScore
              title { romaji native english }
              bannerImage
              coverImage { extraLarge large medium }
            }
          }`,
          variables: { id: Math.trunc(numericId) },
        }),
      }
    );
    if (!response.ok) return null;
    return response.data?.data?.Media ?? null;
  } catch {
    return null;
  }
};

export const fetchAnilistFallbackAsset = async (
  anilistId: string,
  imageType: RenderImageType,
  logoMode: LogoMode,
  logoFontVariant: LogoFontVariant,
  logoPrimary: string,
  logoSecondary: string,
  logoOutline: string,
  phases: PhaseDurations
) => {
  const media = await fetchAnilistMediaExtended(anilistId, phases);
  if (!media) return null;

  const coverUrl = pickAnilistCoverUrl(media);
  const bannerUrl = typeof media?.bannerImage === 'string' ? media.bannerImage.trim() : '';
  const posterUrl = coverUrl;
  const backdropUrl = bannerUrl || coverUrl;
  const rating = normalizeRatingValue(media?.averageScore);
  const originalTitle = pickAnilistTitleForFallback(media);

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
      imageUrl: posterUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  if (imageType === 'backdrop') {
    return {
      imageUrl: backdropUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  if (imageType === 'thumbnail') {
    return {
      imageUrl: backdropUrl,
      rating,
      title: originalTitle,
      logoAspectRatio: null,
    };
  }

  return {
    imageUrl: posterUrl || backdropUrl,
    rating,
    title: originalTitle,
    logoAspectRatio: null,
  };
};

export type NativeAnimeDirectFallback = {
  imageUrl: string | null;
  rating: string | null;
  title: string | null;
  logoAspectRatio: number | null;
  ratingProvider: RatingPreference;
};

export const fetchNativeAnimeDirectFallbackAsset = async (args: {
  provider: AnimeMappingProvider;
  externalId: string;
  imageType: RenderImageType;
  logoMode: LogoMode;
  logoFontVariant: LogoFontVariant;
  logoPrimary: string;
  logoSecondary: string;
  logoOutline: string;
  phases: PhaseDurations;
}): Promise<NativeAnimeDirectFallback | null> => {
  const {
    provider,
    externalId,
    imageType,
    logoMode,
    logoFontVariant,
    logoPrimary,
    logoSecondary,
    logoOutline,
    phases,
  } = args;

  if (provider === 'mal') {
    const asset = await fetchMalJikanFallbackAsset(
      externalId,
      imageType,
      logoMode,
      logoFontVariant,
      logoPrimary,
      logoSecondary,
      logoOutline,
      phases
    );
    if (!asset?.imageUrl) return null;
    return { ...asset, ratingProvider: 'myanimelist' };
  }

  if (provider === 'anilist') {
    const asset = await fetchAnilistFallbackAsset(
      externalId,
      imageType,
      logoMode,
      logoFontVariant,
      logoPrimary,
      logoSecondary,
      logoOutline,
      phases
    );
    if (!asset?.imageUrl) return null;
    return { ...asset, ratingProvider: 'anilist' };
  }

  return null;
};

// Older proxy URLs may still include a placeholder season: `kitsu:id:season:episode`.
export const parseKitsuInputParts = (parts: string[]) => {
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

export const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

export const fetchAnilistRating = async (anilistId: string, phases: PhaseDurations) => {
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

export const fetchMyAnimeListRating = async (malId: string, phases: PhaseDurations) => {
  const data = await fetchJikanAnimeData(malId, phases);
  if (!data) return null;
  const score = data.score;
  if (score == null || typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return null;
  return normalizeRatingValue(score);
};

