import { getTmdbLanguageBase, normalizeTmdbLanguageCode } from '@/lib/tmdbLanguage';

export type PosterTextPreference = 'default' | 'clean' | 'alternative';
export const getImageLanguageTag = (item: any) => {
  if (!item?.iso_639_1) return null;
  if (typeof item?.iso_3166_1 === 'string' && item.iso_3166_1.trim()) {
    return `${item.iso_639_1}-${item.iso_3166_1}`;
  }

  return item.iso_639_1;
};

export const pickByLanguageWithFallback = (
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

export const matchesImageLanguage = (item: any, language: string | null | undefined) => {
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

export const isTextlessPosterSelection = (posters: any[] = [], selectedPoster?: any | null) => {
  if (!Array.isArray(posters) || posters.length === 0 || !selectedPoster?.file_path) return false;

  return posters.some(
    (poster: any) =>
      poster?.file_path === selectedPoster.file_path && normalizeTmdbLanguageCode(getImageLanguageTag(poster)) === null
  );
};

export const pickPosterByPreference = (
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

export const pickBackdropByPreference = (
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


