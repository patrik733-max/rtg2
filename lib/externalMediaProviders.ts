import { fetchJsonCached, fetchTextCached } from '@/lib/cachedFetch';
import { TMDB_CACHE_TTL_MS } from '@/lib/routeConfig';
import { measurePhase } from '@/lib/routeShared';
import type { PhaseDurations } from '@/lib/routeTypes';
export const extractTvdbEpisodeIdFromAiredOrderHtml = (
  html: string,
  seriesPageUrl: string,
  season: string,
  episode: string
) => {
  const seasonNumber = parseInt(season, 10);
  const episodeNumber = parseInt(episode, 10);
  if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return null;

  const escapedSeriesSlug = seriesPageUrl
    .replace(/^https?:\/\/thetvdb\.com/i, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const episodeCode = `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`;
  const matcher = new RegExp(
    `${episodeCode}[\\s\\S]{0,1200}?href="${escapedSeriesSlug}/episodes/(\\d+)"`,
    'i'
  );
  return html.match(matcher)?.[1] || null;
};

export const resolveTvdbEpisodeToTmdb = async (
  seriesId: string,
  season: string,
  episode: string,
  tmdbKey: string,
  phases: PhaseDurations
) => {
  const seriesUrl = `https://thetvdb.com/dereferrer/series/${encodeURIComponent(seriesId)}`;
  const seriesPageUrl = await measurePhase(phases, 'tmdb', async () => {
    const response = await fetch(seriesUrl, { cache: 'no-store', redirect: 'follow' });
    return response.ok ? response.url : null;
  }).catch(() => null);
  if (!seriesPageUrl) return null;

  const airedOrderUrl = `${seriesPageUrl.replace(/\/+$/, '')}/allseasons/official`;
  const airedOrderResponse = await fetchTextCached(
    `tvdb:series:${seriesId}:aired-order`,
    airedOrderUrl,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  if (!airedOrderResponse.ok || !airedOrderResponse.data) return null;

  const tvdbEpisodeId = extractTvdbEpisodeIdFromAiredOrderHtml(
    airedOrderResponse.data,
    seriesPageUrl,
    season,
    episode
  );
  if (!tvdbEpisodeId) return null;

  const findResponse = await fetchJsonCached(
    `tmdb:find:tvdb-episode:${tvdbEpisodeId}`,
    `https://api.themoviedb.org/3/find/${tvdbEpisodeId}?api_key=${tmdbKey}&external_source=tvdb_id`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  const episodeResult = Array.isArray(findResponse.data?.tv_episode_results)
    ? findResponse.data.tv_episode_results[0]
    : null;
  const showId = Number(episodeResult?.show_id);
  const seasonNumber = Number(episodeResult?.season_number);
  const episodeNumber = Number(episodeResult?.episode_number);
  if (!Number.isFinite(showId)) return null;

  return {
    showId: String(showId),
    season: Number.isFinite(seasonNumber) ? String(seasonNumber) : null,
    episode: Number.isFinite(episodeNumber) ? String(episodeNumber) : null,
  };
};

export const resolveImdbEpisodeWithTvdbOrderToTmdb = async (
  imdbSeriesId: string,
  season: string,
  episode: string,
  tmdbKey: string,
  phases: PhaseDurations
) => {
  const findResponse = await fetchJsonCached(
    `tmdb:find:imdb-series:${imdbSeriesId}`,
    `https://api.themoviedb.org/3/find/${imdbSeriesId}?api_key=${tmdbKey}&external_source=imdb_id`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  const tvResult = Array.isArray(findResponse.data?.tv_results) ? findResponse.data.tv_results[0] : null;
  const tmdbShowId = Number(tvResult?.id);
  if (!Number.isFinite(tmdbShowId)) return null;

  const externalIdsResponse = await fetchJsonCached(
    `tmdb:tv:${tmdbShowId}:external_ids`,
    `https://api.themoviedb.org/3/tv/${tmdbShowId}/external_ids?api_key=${tmdbKey}`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  const rawTvdbSeriesId = externalIdsResponse.data?.tvdb_id;
  const tvdbSeriesId =
    typeof rawTvdbSeriesId === 'number' && Number.isFinite(rawTvdbSeriesId)
      ? String(rawTvdbSeriesId)
      : typeof rawTvdbSeriesId === 'string' && rawTvdbSeriesId.trim().length > 0
        ? rawTvdbSeriesId.trim()
        : null;
  if (!tvdbSeriesId) return null;

  const mappedEpisode = await resolveTvdbEpisodeToTmdb(tvdbSeriesId, season, episode, tmdbKey, phases);
  if (!mappedEpisode?.showId) return null;

  return {
    ...mappedEpisode,
    tvdbSeriesId,
  };
};

export const resolveTmdbEpisodeByYearBucket = async (
  tmdbShowId: string,
  requestedBucketSeason: string,
  requestedBucketEpisode: string,
  tmdbKey: string,
  phases: PhaseDurations
) => {
  const bucketSeason = parseInt(requestedBucketSeason, 10);
  const bucketEpisode = parseInt(requestedBucketEpisode, 10);
  if (!Number.isFinite(bucketSeason) || !Number.isFinite(bucketEpisode) || bucketSeason < 1 || bucketEpisode < 1) {
    return null;
  }

  const showResponse = await fetchJsonCached(
    `tmdb:tv:${tmdbShowId}`,
    `https://api.themoviedb.org/3/tv/${tmdbShowId}?api_key=${tmdbKey}`,
    TMDB_CACHE_TTL_MS,
    phases,
    'tmdb'
  );
  if (!showResponse.ok) return null;

  const numberOfSeasons = Number(showResponse.data?.number_of_seasons);
  if (!Number.isFinite(numberOfSeasons) || numberOfSeasons < 1) return null;

  const yearBuckets = new Map<number, Array<{ tmdbSeason: number; tmdbEpisode: number }>>();
  for (let seasonIndex = 1; seasonIndex <= numberOfSeasons; seasonIndex += 1) {
    const seasonResponse = await fetchJsonCached(
      `tmdb:tv:${tmdbShowId}:season:${seasonIndex}`,
      `https://api.themoviedb.org/3/tv/${tmdbShowId}/season/${seasonIndex}?api_key=${tmdbKey}`,
      TMDB_CACHE_TTL_MS,
      phases,
      'tmdb'
    );
    if (!seasonResponse.ok || !Array.isArray(seasonResponse.data?.episodes)) continue;

    for (const episodeData of seasonResponse.data.episodes) {
      const airDate = typeof episodeData?.air_date === 'string' ? episodeData.air_date : '';
      const year = parseInt(airDate.slice(0, 4), 10);
      const tmdbEpisode = Number(episodeData?.episode_number);
      if (!Number.isFinite(year) || !Number.isFinite(tmdbEpisode)) continue;
      const bucket = yearBuckets.get(year) || [];
      bucket.push({ tmdbSeason: seasonIndex, tmdbEpisode });
      yearBuckets.set(year, bucket);
    }
  }

  const orderedYears = [...yearBuckets.keys()].sort((a, b) => a - b);
  const targetYear = orderedYears[bucketSeason - 1];
  if (!Number.isFinite(targetYear)) return null;
  const bucketEpisodes = yearBuckets.get(targetYear) || [];
  const targetEpisode = bucketEpisodes[bucketEpisode - 1];
  if (!targetEpisode) return null;

  return {
    showId: tmdbShowId,
    season: String(targetEpisode.tmdbSeason),
    episode: String(targetEpisode.tmdbEpisode),
  };
};

export const FANART_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const fetchFanartImages = async (
  tmdbId: string,
  tvdbId: string | null,
  mediaType: 'movie' | 'tv',
  fanartKey: string,
  phases: PhaseDurations
): Promise<{ posters: string[]; backdrops: string[] }> => {
  const empty = { posters: [], backdrops: [] };
  if (!fanartKey) return empty;

  try {
    let fanartUrl: string;
    let cacheKey: string;
    if (mediaType === 'movie') {
      fanartUrl = `https://webservice.fanart.tv/v3.2/movies/${tmdbId}?api_key=${fanartKey}`;
      cacheKey = `fanart:movie:${tmdbId}`;
    } else {
      if (!tvdbId) return empty;
      fanartUrl = `https://webservice.fanart.tv/v3.2/tv/${tvdbId}?api_key=${fanartKey}`;
      cacheKey = `fanart:tv:${tvdbId}`;
    }

    const response = await fetchJsonCached(cacheKey, fanartUrl, FANART_CACHE_TTL_MS, phases, 'tmdb');
    if (!response.ok || !response.data) return empty;

    const data = response.data;
    const rawPosters: any[] = mediaType === 'movie'
      ? (Array.isArray(data.movieposter) ? data.movieposter : [])
      : (Array.isArray(data.tvposter) ? data.tvposter : []);
    const rawBackdrops: any[] = mediaType === 'movie'
      ? (Array.isArray(data.moviebackground) ? data.moviebackground : [])
      : (Array.isArray(data.showbackground) ? data.showbackground : []);

    const byLikes = (a: any, b: any) => parseInt(b.likes || '0', 10) - parseInt(a.likes || '0', 10);

    const sortedPosters = rawPosters
      .filter((item: any) => typeof item?.url === 'string')
      .sort(byLikes)
      .map((item: any) => item.url as string);

    const sortedBackdrops = rawBackdrops
      .filter((item: any) => typeof item?.url === 'string')
      .sort(byLikes)
      .map((item: any) => item.url as string);

    return { posters: sortedPosters, backdrops: sortedBackdrops };
  } catch {
    return empty;
  }
};

