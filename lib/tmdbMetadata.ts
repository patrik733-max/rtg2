import { fetchJsonCached } from '@/lib/cachedFetch';
import {
  GET_STREAMING_CHART_INFO_QUERY,
  JUSTWATCH_GRAPHQL_URL,
  TMDB_ANIMATION_GENRE_ID,
  TMDB_CACHE_TTL_MS,
  type RankingInterval,
} from '@/lib/routeConfig';
import type { PhaseDurations } from '@/lib/routeTypes';

export const fetchTmdbGenres = async (
  tmdbKey: string,
  language: string,
  mediaType: 'movie' | 'tv',
  phases: PhaseDurations
): Promise<Map<number, string>> => {
  const cacheKey = `tmdb:genres:${mediaType}:${language}`;
  const url = `https://api.themoviedb.org/3/genre/${mediaType}/list?api_key=${tmdbKey}&language=${language}`;

  const response = await fetchJsonCached(
    cacheKey,
    url,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );

  const genreMap = new Map<number, string>();
  if (response.ok && Array.isArray(response.data?.genres)) {
    for (const genre of response.data.genres) {
      const id = Number(genre?.id);
      const name = String(genre?.name || '').trim();
      if (Number.isFinite(id) && name) {
        genreMap.set(id, name);
      }
    }
  }
  return genreMap;
};

export const isTmdbAnimationTitle = (media: any) => {
  const genreIds = Array.isArray(media?.genre_ids) ? media.genre_ids : [];
  if (genreIds.some((genreId: any) => Number(genreId) === TMDB_ANIMATION_GENRE_ID)) {
    return true;
  }

  const genres = Array.isArray(media?.genres) ? media.genres : [];
  return genres.some((genre: any) => {
    if (Number(genre?.id) === TMDB_ANIMATION_GENRE_ID) {
      return true;
    }

    return String(genre?.name || '').trim().toLowerCase() === 'animation';
  });
};

export const getFirstTmdbGenreName = async (
  media: any,
  mediaType: 'movie' | 'tv' | null,
  tmdbKey: string,
  language: string,
  phases: PhaseDurations
) => {
  const genres = Array.isArray(media?.genres) ? media.genres : [];
  for (const genre of genres) {
    const name = String(genre?.name || '').trim();
    if (name) return name;
  }

  if (!tmdbKey || !mediaType || (mediaType !== 'movie' && mediaType !== 'tv')) return null;

  const genreIds = Array.isArray(media?.genre_ids) ? media.genre_ids : [];
  if (genreIds.length === 0) return null;

  const genreMap = await fetchTmdbGenres(tmdbKey, language, mediaType, phases);
  for (const genreId of genreIds) {
    const numericGenreId = Number(genreId);
    if (!Number.isFinite(numericGenreId)) continue;
    const mappedGenre = genreMap.get(numericGenreId);
    if (mappedGenre) return mappedGenre;
  }

  return null;
};

export const normalizeRankingInterval = (value: string): RankingInterval | null => {
  const v = value.toLowerCase();
  if (v === 'daily' || v === 'on') return 'DAILY';
  if (v === 'weekly') return 'WEEKLY';
  if (v === 'monthly') return 'MONTHLY';
  return null;
};

export const fetchRanking = async (
  tmdbId: string | null,
  imdbId: string | null,
  mediaType: 'movie' | 'tv',
  interval: RankingInterval,
  country: string,
  language: string,
  phases: PhaseDurations
): Promise<number | null> => {
  if (!tmdbId && !imdbId) return null;

  let normalizedCountry = country.toUpperCase();
  if (normalizedCountry === 'GLOBAL') {
    normalizedCountry = 'US';
  }
  const cacheKey = `justwatch:ranking:${mediaType}:${interval}:${normalizedCountry}:${language}`;
  const categoryMap: Record<string, string> = {
    DAILY: 'DAILY_POPULARITY_SAME_CONTENT_TYPE',
    WEEKLY: 'WEEKLY_POPULARITY_SAME_CONTENT_TYPE',
    MONTHLY: 'MONTHLY_POPULARITY_SAME_CONTENT_TYPE',
  };
  const category = categoryMap[interval] || 'DAILY_POPULARITY_SAME_CONTENT_TYPE';

  const response = await fetchJsonCached(
    cacheKey,
    JUSTWATCH_GRAPHQL_URL,
    1 * 60 * 60 * 1000,
    phases,
    'tmdb',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': 'WEB',
      },
      body: JSON.stringify({
        operationName: 'GetStreamingChartInfo',
        variables: {
          country: normalizedCountry,
          countryStreamingCharts: normalizedCountry,
          language,
          first: 100,
          filter: {
            objectType: mediaType === 'movie' ? 'MOVIE' : 'SHOW',
            category,
          },
        },
        query: GET_STREAMING_CHART_INFO_QUERY,
      }),
    }
  );

  const rankingList = response.ok ? response.data?.data?.streamingCharts?.edges : [];

  if (!rankingList || !Array.isArray(rankingList)) {
    return null;
  }

  for (const edge of rankingList) {
    const item = edge.node;
    const externalIds = item.content?.externalIds;
    if (
      (tmdbId && String(externalIds?.tmdbId) === tmdbId) ||
      (imdbId && externalIds?.imdbId === imdbId)
    ) {
      return edge.streamingChartInfo?.rank || null;
    }
  }

  return null;
};

export const getRankingLabel = (interval: RankingInterval, lang: string) => {
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    let label = '';
    if (interval === 'DAILY') {
      label = rtf.format(0, 'day');
    } else if (interval === 'WEEKLY') {
      label = rtf.format(0, 'week');
    } else if (interval === 'MONTHLY') {
      label = rtf.format(0, 'month');
    } else {
      return 'Rank';
    }
    if (!label) return interval === 'DAILY' ? 'Today' : interval === 'WEEKLY' ? 'This Week' : 'This Month';
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    if (interval === 'DAILY') return 'Today';
    if (interval === 'WEEKLY') return 'This Week';
    if (interval === 'MONTHLY') return 'This Month';
    return 'Rank';
  }
};
