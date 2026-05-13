import { getTmdbLanguageBase, normalizeTmdbLanguageCode } from '@/lib/tmdbLanguage';

export const FALLBACK_IMAGE_LANGUAGE = 'en';

export const parseApiKeyList = (...values: Array<string | undefined>) => {
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

export const parseCacheTtlMs = (value: string | undefined, fallbackMs: number, minMs: number, maxMs: number) => {
  if (!value) return fallbackMs;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return Math.min(maxMs, Math.max(minMs, parsed));
};

export const parseNonNegativeInt = (value?: string | null, max = Number.MAX_SAFE_INTEGER) => {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(max, Math.floor(parsed));
};

export const getTmdbLanguageFallbackChain = (requestedLanguage?: string | null, fallbackLanguage: string = FALLBACK_IMAGE_LANGUAGE) => {
  const requested = normalizeTmdbLanguageCode(requestedLanguage);
  const requestedBase = getTmdbLanguageBase(requested);
  const fallback = normalizeTmdbLanguageCode(fallbackLanguage);
  const fallbackBase = getTmdbLanguageBase(fallback);

  return [...new Set([requested, requestedBase, fallback, fallbackBase].filter(Boolean) as string[])];
};

export const isOriginalLanguageSetting = (value?: string | null) =>
  String(value || '').trim().toLowerCase() === 'original';

export const resolveRequestedImageLanguage = (input: {
  configuredLanguage?: string | null;
  requestLanguage?: string | null;
  fallbackLanguage: string;
}) =>
  normalizeTmdbLanguageCode(
    isOriginalLanguageSetting(input.configuredLanguage)
      ? input.requestLanguage
      : input.configuredLanguage || input.requestLanguage
  ) || input.fallbackLanguage;

export const resolveOriginalAwareImageLanguage = (input: {
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

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isImdbId = (value?: string | null) => {
  if (!value) return false;
  return /^tt\d+$/.test(value.trim());
};

export const getDeterministicTtlMs = (baseTtlMs: number, seed: string) => {
  const normalizedSeed = String(seed || '').trim();
  if (!normalizedSeed) return baseTtlMs;

  const jitterWindowMs = Math.min(12 * 60 * 60 * 1000, Math.floor(baseTtlMs * 0.15));
  if (jitterWindowMs <= 0) return baseTtlMs;

  let hashValue = 0;
  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hashValue = (hashValue * 31 + normalizedSeed.charCodeAt(index)) >>> 0;
  }

  const offsetMs = (hashValue % (jitterWindowMs + 1)) - Math.floor(jitterWindowMs / 2);
  return Math.max(60 * 1000, baseTtlMs + offsetMs);
};

export const getCacheTtlMsFromCacheControl = (value: string | null | undefined, fallbackMs: number) => {
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
