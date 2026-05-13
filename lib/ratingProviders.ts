import { fetchJsonCached } from '@/lib/cachedFetch';
import { collectMDBListRatings, isNegativeRatingValue, normalizeRatingValue } from '@/lib/ratingProviderParsing';
import {
  FILMWEB_CACHE_TTL_MS,
  MDBLIST_CACHE_TTL_MS,
  MDBLIST_OLD_MOVIE_AGE_DAYS,
  MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
  MDBLIST_RATE_LIMIT_COOLDOWN_MS,
} from '@/lib/routeConfig';
import { sha1Hex } from '@/lib/routeShared';
import type { CachedJsonResponse, PhaseDurations } from '@/lib/routeTypes';
import { getDeterministicTtlMs, parseApiKeyList } from '@/lib/routeUtils';

export const MDBLIST_API_KEYS = parseApiKeyList(process.env.MDBLIST_API_KEYS, process.env.MDBLIST_API_KEY);
const mdbListRateLimitedUntil = new Map<string, number>();
let mdbListApiKeyCursor = 0;
export const buildMdbListCacheSeed = (manualApiKey?: string | null) => {
  const normalizedManual = String(manualApiKey || '').trim();
  if (normalizedManual) {
    return `mdblist:manual:${sha1Hex(normalizedManual).slice(0, 12)}`;
  }
  if (!MDBLIST_API_KEYS.length) {
    return 'mdblist:none';
  }
  return `mdblist:pool:${sha1Hex(MDBLIST_API_KEYS.join('|')).slice(0, 12)}`;
};

export const getMdbListApiKeysInPriorityOrder = () => {
  if (!MDBLIST_API_KEYS.length) return [];

  const now = Date.now();
  const availableKeys = MDBLIST_API_KEYS.filter((apiKey) => {
    const limitedUntil = mdbListRateLimitedUntil.get(apiKey) || 0;
    return limitedUntil <= now;
  });
  const candidates = availableKeys.length ? availableKeys : MDBLIST_API_KEYS;
  const startIndex = mdbListApiKeyCursor % candidates.length;
  mdbListApiKeyCursor = (mdbListApiKeyCursor + 1) % candidates.length;

  return [...candidates.slice(startIndex), ...candidates.slice(0, startIndex)];
};

export const markMdbListApiKeyRateLimited = (apiKey: string) => {
  mdbListRateLimitedUntil.set(apiKey, Date.now() + MDBLIST_RATE_LIMIT_COOLDOWN_MS);
};

export const getMdbListResponseMessage = (payload: any) =>
  [
    payload?.error,
    payload?.message,
    payload?.detail,
    payload?.description,
    payload?.status_message,
    payload?.response,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .toLowerCase();

export const isMdbListRateLimitedResponse = (response: CachedJsonResponse) => {
  if (response.status === 429) return true;

  const message = getMdbListResponseMessage(response.data);
  if (!message) return false;

  return ['rate limit', 'too many requests', 'quota', 'limit reached', 'limit exceeded', 'throttle'].some(
    (token) => message.includes(token)
  );
};

export const shouldRetryMdbListWithAnotherKey = (response: CachedJsonResponse) => {
  if (isMdbListRateLimitedResponse(response)) return true;
  return response.status === 401 || response.status === 403 || response.status >= 500;
};

export const getRatingCacheTtlMs = ({
  id,
  mediaType,
  releaseDate,
  defaultTtlMs,
  oldTtlMs,
}: {
  id: string;
  mediaType: 'movie' | 'tv';
  releaseDate?: string | null;
  defaultTtlMs: number;
  oldTtlMs: number;
}) => {
  let ttlMs = defaultTtlMs;

  if (mediaType === 'movie') {
    const normalizedReleaseDate = String(releaseDate || '').trim();
    if (normalizedReleaseDate) {
      const releaseTimestamp = Date.parse(`${normalizedReleaseDate}T00:00:00Z`);
      if (Number.isFinite(releaseTimestamp)) {
        const movieAgeMs = Date.now() - releaseTimestamp;
        if (movieAgeMs >= MDBLIST_OLD_MOVIE_AGE_DAYS * 24 * 60 * 60 * 1000) {
          ttlMs = Math.max(defaultTtlMs, oldTtlMs);
        }
      }
    }
  }

  return getDeterministicTtlMs(ttlMs, id);
};

export const getMdbListCacheTtlMs = ({
  imdbId,
  mediaType,
  releaseDate,
}: {
  imdbId: string;
  mediaType: 'movie' | 'tv';
  releaseDate?: string | null;
}) => {
  return getRatingCacheTtlMs({
    id: imdbId,
    mediaType,
    releaseDate,
    defaultTtlMs: MDBLIST_CACHE_TTL_MS,
    oldTtlMs: MDBLIST_OLD_MOVIE_CACHE_TTL_MS,
  });
};


export const fetchMdbListRatings = async ({
  imdbId,
  cacheTtlMs,
  phases,
  requestSource,
  imageType,
  cleanId,
  manualApiKey,
}: {
  imdbId: string;
  cacheTtlMs: number;
  phases: PhaseDurations;
  requestSource?: string;
  imageType?: string;
  cleanId?: string;
  manualApiKey?: string | null;
}) => {
  const normalizedImdbId = String(imdbId || '').trim();
  const apiKeys = manualApiKey ? [manualApiKey] : getMdbListApiKeysInPriorityOrder();

  if (!normalizedImdbId || !apiKeys.length) return null;

  for (const apiKey of apiKeys) {
    try {
      const apiKeyHash = sha1Hex(apiKey).slice(0, 12);
      const response = await fetchJsonCached(
        `mdblist:${normalizedImdbId}:key:${sha1Hex(apiKey)}`,
        `https://mdblist.com/api/?apikey=${encodeURIComponent(apiKey)}&i=${encodeURIComponent(normalizedImdbId)}`,
        cacheTtlMs,
        phases,
        'mdb'
      );

      if (isMdbListRateLimitedResponse(response)) {
        markMdbListApiKeyRateLimited(apiKey);
        continue;
      }

      if (!response.ok) {
        if (shouldRetryMdbListWithAnotherKey(response)) {
          continue;
        }
        return null;
      }

      return collectMDBListRatings(response.data);
    } catch {
      // Try the next key before giving up on MDBList entirely.
    }
  }

  return null;
};

export const fetchSimklRating = async ({
  clientId,
  imdbId,
  tmdbId,
  mediaType,
  anilistId,
  malId,
  kitsuId,
  cacheTtlMs,
  phases,
}: {
  clientId: string;
  imdbId?: string | null;
  tmdbId?: string | null;
  mediaType: 'movie' | 'tv';
  anilistId?: string | null;
  malId?: string | null;
  kitsuId?: string | null;
  cacheTtlMs: number;
  phases: PhaseDurations;
}) => {
  const normalizedClientId = String(clientId || '').trim();
  const normalizedImdbId = String(imdbId || '').trim();
  const normalizedTmdbId = String(tmdbId || '').trim();
  const normalizedAnilistId = String(anilistId || '').trim();
  const normalizedMalId = String(malId || '').trim();
  const normalizedKitsuId = String(kitsuId || '').trim();

  if (!normalizedClientId) return null;

  const query = new URLSearchParams();
  query.set('client_id', normalizedClientId);
  query.set('fields', 'simkl');

  if (normalizedImdbId) {
    query.set('imdb', normalizedImdbId);
  } else if (normalizedTmdbId) {
    query.set('tmdb', normalizedTmdbId);
    query.set('type', mediaType);
  } else if (normalizedAnilistId) {
    query.set('anilist', normalizedAnilistId);
  } else if (normalizedMalId) {
    query.set('mal', normalizedMalId);
  } else if (normalizedKitsuId) {
    query.set('kitsu', normalizedKitsuId);
  } else {
    return null;
  }

  const cacheIdSource =
    normalizedImdbId ||
    (normalizedTmdbId ? `tmdb:${mediaType}:${normalizedTmdbId}` : '') ||
    (normalizedAnilistId ? `anilist:${normalizedAnilistId}` : '') ||
    (normalizedMalId ? `mal:${normalizedMalId}` : '') ||
    (normalizedKitsuId ? `kitsu:${normalizedKitsuId}` : '');

  const response = await fetchJsonCached(
    `simkl:ratings:${cacheIdSource}:client:${sha1Hex(normalizedClientId)}`,
    `https://api.simkl.com/ratings?${query.toString()}`,
    cacheTtlMs,
    phases,
    'mdb',
    {
      headers: {
        'Content-Type': 'application/json',
        'simkl-api-key': normalizedClientId,
      },
    }
  );

  if (!response.ok) return null;

  const rating = normalizeRatingValue(response.data?.simkl?.rating);
  return rating && !isNegativeRatingValue(rating) ? rating : null;
};

export const fetchFilmwebIdFromWikidata = async ({
  imdbId,
  tmdbId,
  mediaType,
  phases,
}: {
  imdbId?: string | null;
  tmdbId?: string | null;
  mediaType: 'movie' | 'tv';
  phases: PhaseDurations;
}) => {
  const normalizedImdbId = String(imdbId || '').trim();
  const normalizedTmdbId = String(tmdbId || '').trim();

  let query: string | null = null;
  let cacheKey: string | null = null;

  if (normalizedImdbId) {
    query = `SELECT ?filmwebId WHERE { ?item wdt:P345 "${normalizedImdbId}". ?item wdt:P5032 ?filmwebId. } LIMIT 1`;
    cacheKey = `wikidata:filmweb:imdb:${normalizedImdbId}`;
  } else if (normalizedTmdbId) {
    const tmdbProperty = mediaType === 'tv' ? 'P4983' : 'P4947';
    query = `SELECT ?filmwebId WHERE { ?item wdt:${tmdbProperty} "${normalizedTmdbId}". ?item wdt:P5032 ?filmwebId. } LIMIT 1`;
    cacheKey = `wikidata:filmweb:tmdb:${mediaType}:${normalizedTmdbId}`;
  }

  if (!query || !cacheKey) return null;

  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const response = await fetchJsonCached(
    cacheKey,
    url,
    FILMWEB_CACHE_TTL_MS,
    phases,
    'mdb',
    {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'ERDB/filmweb-provider',
      },
    }
  );

  if (!response.ok) return null;

  const candidate = response.data?.results?.bindings?.[0]?.filmwebId?.value;
  if (typeof candidate !== 'string') return null;

  const normalized = candidate.trim();
  return /^\d+$/.test(normalized) ? normalized : null;
};

export const fetchFilmwebRating = async ({
  filmwebId,
  cacheTtlMs,
  phases,
}: {
  filmwebId: string;
  cacheTtlMs: number;
  phases: PhaseDurations;
}) => {
  const normalizedFilmwebId = String(filmwebId || '').trim();
  if (!/^\d+$/.test(normalizedFilmwebId)) return null;

  const response = await fetchJsonCached(
    `filmweb:rating:${normalizedFilmwebId}`,
    `https://www.filmweb.pl/api/v1/film/${encodeURIComponent(normalizedFilmwebId)}/rating`,
    cacheTtlMs,
    phases,
    'mdb',
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    }
  );

  if (!response.ok) return null;

  const rating = normalizeRatingValue(response.data?.rate);
  return rating && !isNegativeRatingValue(rating) ? rating : null;
};

export const fetchFilmwebCriticsRating = async ({
  filmwebId,
  cacheTtlMs,
  phases,
}: {
  filmwebId: string;
  cacheTtlMs: number;
  phases: PhaseDurations;
}) => {
  const normalizedFilmwebId = String(filmwebId || '').trim();
  if (!/^\d+$/.test(normalizedFilmwebId)) return null;

  const response = await fetchJsonCached(
    `filmweb:critics:rating:${normalizedFilmwebId}`,
    `https://www.filmweb.pl/api/v1/film/${encodeURIComponent(normalizedFilmwebId)}/critics/rating`,
    cacheTtlMs,
    phases,
    'mdb',
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    }
  );

  if (!response.ok) return null;

  const rating = normalizeRatingValue(response.data?.rate);
  return rating && !isNegativeRatingValue(rating) ? rating : null;
};

export const fetchFilmwebIdBySearch = async ({
  title,
  originalTitle,
  year,
  mediaType,
  phases,
}: {
  title?: string | null;
  originalTitle?: string | null;
  year?: string | null;
  mediaType: 'movie' | 'tv';
  phases: PhaseDurations;
}) => {
  const normalizedTitle = String(title || '').trim();
  const normalizedOriginalTitle = String(originalTitle || '').trim();
  const normalizedYear = String(year || '').trim().slice(0, 4);

  const queryCandidates = [
    [normalizedOriginalTitle, normalizedYear].filter(Boolean).join(' '),
    [normalizedTitle, normalizedYear].filter(Boolean).join(' '),
    normalizedOriginalTitle,
    normalizedTitle,
  ]
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  for (const query of [...new Set(queryCandidates)]) {
    const cacheKey = `filmweb:search:v1:${mediaType}:${sha1Hex(query.toLowerCase())}`;
    const url = `https://www.filmweb.pl/api/v1/live/search?query=${encodeURIComponent(query)}&pageSize=12`;

    const response = await fetchJsonCached(
      cacheKey,
      url,
      FILMWEB_CACHE_TTL_MS,
      phases,
      'mdb',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok || !Array.isArray(response.data?.searchHits)) continue;

    const hits = response.data.searchHits.filter((hit: any) => hit.type === 'film' || hit.type === 'serial');

    for (const hit of hits.slice(0, 5)) {
      const infoUrl = `https://www.filmweb.pl/api/v1/title/${hit.id}/info`;
      const infoCacheKey = `filmweb:title:info:v1:${hit.id}`;

      const infoResponse = await fetchJsonCached(
        infoCacheKey,
        infoUrl,
        FILMWEB_CACHE_TTL_MS,
        phases,
        'mdb',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
          },
        }
      );

      if (!infoResponse.ok || !infoResponse.data) continue;

      const info = infoResponse.data;
      const infoYear = String(info.year || '').trim();
      const yearMatch = !normalizedYear || infoYear === normalizedYear;

      if (!yearMatch) continue;

      const infoTitles = [
        String(info.title || '').trim().toLowerCase(),
        String(info.originalTitle || '').trim().toLowerCase(),
      ].filter(Boolean);

      const targetNames = [
        normalizedTitle.toLowerCase(),
        normalizedOriginalTitle.toLowerCase(),
      ].filter(Boolean);

      if (targetNames.some((t) => infoTitles.includes(t))) {
        return String(hit.id);
      }
    }
  }

  return null;
};


