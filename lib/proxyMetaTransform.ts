import { buildErdbImageUrl, normalizeErdbId, type ProxyConfig } from '@/lib/addonProxy';
import { fetchWithRetry } from '@/lib/request';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const tmdbFetchCache = new Map<string, Promise<any>>();
export const textFetchCache = new Map<string, Promise<string | null>>();
export type TmdbRef = { id: number; type: 'movie' | 'tv'; season?: number | null; episode?: number | null; isAnime?: boolean };

export const fetchTmdbJson = async (url: string) => {
  const cached = tmdbFetchCache.get(url);
  if (cached) return cached;
  const promise = fetch(url, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return null;
      try {
        return await response.json();
      } catch {
        return null;
      }
    })
    .catch(() => null);
  tmdbFetchCache.set(url, promise);
  return promise;
};

export const fetchText = async (url: string) => {
  const cached = textFetchCache.get(url);
  if (cached) return cached;
  const promise = fetchWithRetry(url, { cache: 'no-store', redirect: 'follow' })
    .then(async (response) => {
      if (!response.ok) return null;
      try {
        return await response.text();
      } catch {
        return null;
      }
    })
    .catch(() => null);
  textFetchCache.set(url, promise);
  return promise;
};

export const extractTvdbEpisodeIdFromAiredOrder = async (
  seriesId: string,
  season: string,
  episode: string,
) => {
  const seasonNumber = parseInt(season, 10);
  const episodeNumber = parseInt(episode, 10);
  if (!Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) return null;

  const seriesUrl = `https://thetvdb.com/dereferrer/series/${encodeURIComponent(seriesId)}`;
  const seriesResponse = await fetchWithRetry(seriesUrl, { cache: 'no-store', redirect: 'follow' }).catch(() => null);
  const seriesPageUrl = seriesResponse?.url;
  if (!seriesPageUrl) return null;

  const airedOrderUrl = `${seriesPageUrl.replace(/\/+$/, '')}/allseasons/official`;
  const html = await fetchText(airedOrderUrl);
  if (!html) return null;

  const escapedSeriesSlug = seriesPageUrl
    .replace(/^https?:\/\/thetvdb\.com/i, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const episodeCode = `S${String(seasonNumber).padStart(2, '0')}E${String(episodeNumber).padStart(2, '0')}`;
  const matcher = new RegExp(
    `${episodeCode}[\\s\\S]{0,1200}?href="${escapedSeriesSlug}/episodes/(\\d+)"`,
    'i'
  );
  const match = html.match(matcher);
  return match?.[1] || null;
};

export const normalizeStremioType = (value: unknown): 'movie' | 'tv' | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'movie' || normalized === 'film') return 'movie';
  if (normalized === 'series' || normalized === 'tv' || normalized === 'show') return 'tv';
  return null;
};

export const fetchAnimemappingJson = async (url: string) => {
  return fetchTmdbJson(url); // Reuse the same simple fetch mechanism
};

export const extractTmdbIdFromAnimemapping = (payload: any) => {
  const candidates = [
    payload?.mappings?.ids?.tmdb,
    payload?.data?.mappings?.ids?.tmdb,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
    if (typeof candidate === 'string') {
      const match = candidate.match(/\d+/);
      if (match) return match[0];
    }
  }

  return null;
};

export const resolveAnimeToTmdb = async (
  provider: string,
  externalId: string,
) => {
  const url = `https://animemapping.realbestia.com/${provider}/${encodeURIComponent(externalId)}?ep=1`;
  const data = await fetchAnimemappingJson(url);
  if (!data) return null;
  
  const tmdbId = extractTmdbIdFromAnimemapping(data);
  if (!tmdbId) return null;

  const seasonValue = data?.mappings?.tmdb_episode?.season || data?.data?.mappings?.tmdb_episode?.season;
  const season = typeof seasonValue === 'number' ? seasonValue : typeof seasonValue === 'string' ? parseInt(seasonValue, 10) : null;

  // Most anime are series/tv, but movies should be handled too.
  // The animemapping response usually contains subtype info.
  const subtype = (data?.requested?.subtype || data?.subtype || data?.kitsu?.subtype || '').toLowerCase();
  const type: 'movie' | 'tv' = (subtype === 'movie' || subtype === 'special') ? 'movie' : 'tv';

  return { id: Number(tmdbId), type, season: Number.isFinite(season) ? (season as number) : null, isAnime: true };
};

export const resolveTmdbFromErdbId = async (
  erdbId: string,
  metaType: unknown,
  tmdbKey: string,
  lang: string | null,
): Promise<TmdbRef | null> => {
  if (!erdbId) return null;
  const stremioType = normalizeStremioType(metaType);

  if (erdbId.startsWith('tmdb:')) {
    const parts = erdbId.split(':');
    if (parts.length >= 3 && (parts[1] === 'movie' || parts[1] === 'tv')) {
      const id = Number(parts[2]);
      if (Number.isFinite(id)) {
        return { id, type: parts[1] as 'movie' | 'tv' };
      }
    }
    if (parts.length >= 2) {
      const id = Number(parts[1]);
      if (Number.isFinite(id) && stremioType) {
        return { id, type: stremioType };
      }
    }
    return null;
  }

  if (erdbId.startsWith('tt')) {
    const findUrl = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(erdbId)}`);
    findUrl.searchParams.set('api_key', tmdbKey);
    findUrl.searchParams.set('external_source', 'imdb_id');
    if (lang) {
      findUrl.searchParams.set('language', lang);
    }
    const data = await fetchTmdbJson(findUrl.toString());
    if (!data || typeof data !== 'object') return null;

    const movieResults = Array.isArray(data.movie_results) ? data.movie_results : [];
    const tvResults = Array.isArray(data.tv_results) ? data.tv_results : [];
    const episodeResult = Array.isArray(data.tv_episode_results) ? data.tv_episode_results[0] : null;

    if (stremioType === 'movie' && movieResults[0]?.id) {
      return { id: Number(movieResults[0].id), type: 'movie' };
    }
    if (stremioType === 'tv' && tvResults[0]?.id) {
      return { id: Number(tvResults[0].id), type: 'tv' };
    }
    if (stremioType === 'tv' && episodeResult?.show_id) {
      return {
        id: Number(episodeResult.show_id),
        type: 'tv',
        season: Number.isFinite(Number(episodeResult.season_number)) ? Number(episodeResult.season_number) : null,
      };
    }

    if (movieResults[0]?.id) {
      return { id: Number(movieResults[0].id), type: 'movie' };
    }
    if (tvResults[0]?.id) {
      return { id: Number(tvResults[0].id), type: 'tv' };
    }
    if (episodeResult?.show_id) {
      return {
        id: Number(episodeResult.show_id),
        type: 'tv',
        season: Number.isFinite(Number(episodeResult.season_number)) ? Number(episodeResult.season_number) : null,
      };
    }
  }

  if (erdbId.startsWith('tvdb:')) {
    const parts = erdbId.split(':');
    const seriesId = parts[1];
    const season = parts[2];
    const episode = parts[3];
    if (!seriesId) return null;

    if (season && episode) {
      const tvdbEpisodeId = await extractTvdbEpisodeIdFromAiredOrder(seriesId, season, episode);
      if (!tvdbEpisodeId) return null;

      const findUrl = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(tvdbEpisodeId)}`);
      findUrl.searchParams.set('api_key', tmdbKey);
      findUrl.searchParams.set('external_source', 'tvdb_id');
      if (lang) {
        findUrl.searchParams.set('language', lang);
      }

      const data = await fetchTmdbJson(findUrl.toString());
      const episodeResult = Array.isArray(data?.tv_episode_results) ? data.tv_episode_results[0] : null;
      const showId = Number(episodeResult?.show_id);
      const resolvedSeason = Number(episodeResult?.season_number);
      if (Number.isFinite(showId)) {
        return {
          id: showId,
          type: 'tv',
          season: Number.isFinite(resolvedSeason) ? resolvedSeason : null,
        };
      }
      return null;
    }

    const findUrl = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(seriesId)}`);
    findUrl.searchParams.set('api_key', tmdbKey);
    findUrl.searchParams.set('external_source', 'tvdb_id');
    if (lang) {
      findUrl.searchParams.set('language', lang);
    }
    const data = await fetchTmdbJson(findUrl.toString());
    const tvResult = Array.isArray(data?.tv_results) ? data.tv_results[0] : null;
    const id = Number(tvResult?.id);
    if (Number.isFinite(id)) {
      return { id, type: 'tv' };
    }
  }

  if (erdbId.startsWith('realimdb:')) {
    const parts = erdbId.split(':');
    const imdbId = parts[1];
    if (!imdbId) return null;

    const findUrl = new URL(`${TMDB_BASE_URL}/find/${encodeURIComponent(imdbId)}`);
    findUrl.searchParams.set('api_key', tmdbKey);
    findUrl.searchParams.set('external_source', 'imdb_id');
    if (lang) {
      findUrl.searchParams.set('language', lang);
    }

    const data = await fetchTmdbJson(findUrl.toString());
    const episodeResult = Array.isArray(data?.tv_episode_results) ? data.tv_episode_results[0] : null;
    if (episodeResult?.show_id) {
      return {
        id: Number(episodeResult.show_id),
        type: 'tv',
        season: Number.isFinite(Number(episodeResult.season_number)) ? Number(episodeResult.season_number) : null,
      };
    }

    const tvResult = Array.isArray(data?.tv_results) ? data.tv_results[0] : null;
    if (tvResult?.id) {
      return { id: Number(tvResult.id), type: 'tv' };
    }
  }

  // Handle anime site IDs
  const animePrefixes = ['kitsu', 'anilist', 'mal', 'myanimelist', 'anidb'];
  for (const prefix of animePrefixes) {
    if (erdbId.startsWith(`${prefix}:`)) {
      const externalId = erdbId.split(':')[1];
      if (externalId) {
        const provider = prefix === 'myanimelist' ? 'mal' : prefix;
        return resolveAnimeToTmdb(provider, externalId);
      }
    }
  }

  return null;
};

export const resolveTmdbEpisodeFromVideo = async (
  baseErdbId: string,
  metaType: unknown,
  tmdbKey: string,
  lang: string | null,
  seasonValue: number,
  episodeValue: number,
) => {
  if (!Number.isFinite(seasonValue) || !Number.isFinite(episodeValue)) return null;

  if (baseErdbId.startsWith('realimdb:') || baseErdbId.startsWith('tvdb:')) {
    return resolveTmdbFromErdbId(
      `${baseErdbId}:${seasonValue}:${episodeValue}`,
      metaType,
      tmdbKey,
      lang,
    );
  }

  const baseRef = await resolveTmdbFromErdbId(baseErdbId, metaType, tmdbKey, lang);
  if (!baseRef || baseRef.type !== 'tv') return null;

  return {
    ...baseRef,
    season: seasonValue,
    episode: episodeValue,
  };
};

export const translateTextFields = (
  target: Record<string, unknown>,
  translatedTitle: string | null,
  translatedOverview: string | null,
) => {
  if (translatedTitle) {
    if (typeof target.name === 'string') {
      target.name = translatedTitle;
    }
    if (typeof target.title === 'string') {
      target.title = translatedTitle;
    }
    if (typeof target.name !== 'string' && typeof target.title !== 'string') {
      target.name = translatedTitle;
    }
  }

  if (translatedOverview) {
    if (typeof target.description === 'string') {
      target.description = translatedOverview;
    }
    if (typeof target.overview === 'string') {
      target.overview = translatedOverview;
    }
    if (typeof target.plot === 'string') {
      target.plot = translatedOverview;
    }
    if (typeof target.synopsis === 'string') {
      target.synopsis = translatedOverview;
    }
    if (
      typeof target.description !== 'string' &&
      typeof target.overview !== 'string' &&
      typeof target.plot !== 'string' &&
      typeof target.synopsis !== 'string'
    ) {
      target.description = translatedOverview;
    }
  }
};

export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
};

export const translateMetaPayload = async (
  meta: Record<string, unknown>,
  requestUrl: URL,
  config: ProxyConfig,
  requestedType?: string | null,
) => {
  if (!config.translateMeta) return meta;
  const lang = config.lang || requestUrl.searchParams.get('lang');
  if (!lang) return meta;

  const rawId = typeof meta.id === 'string' ? meta.id : null;
  const rawType = typeof meta.type === 'string' ? meta.type : null;
  const erdbId = normalizeProxyErdbId(rawId, rawType, config, meta, requestedType);
  if (!erdbId) return meta;

  const tmdbRef = await resolveTmdbFromErdbId(erdbId, rawType, config.tmdbKey, lang);
  if (!tmdbRef) return meta;

  const detailsUrl = new URL(`${TMDB_BASE_URL}/${tmdbRef.type}/${tmdbRef.id}`);
  detailsUrl.searchParams.set('api_key', config.tmdbKey);
  detailsUrl.searchParams.set('language', lang);
  const details = await fetchTmdbJson(detailsUrl.toString());
  if (!details || typeof details !== 'object') return meta;

  let translatedOverview = typeof details.overview === 'string' ? details.overview : null;

  // For non-anime content, also translate titles
  let translatedTitle: string | null = null;
  if (!tmdbRef.isAnime) {
    translatedTitle =
      typeof details.title === 'string'
        ? details.title
        : typeof details.name === 'string'
          ? details.name
          : null;
  }

  // Use season-specific metadata if available for anime seasons
  if (tmdbRef.type === 'tv' && typeof tmdbRef.season === 'number' && tmdbRef.season > 0) {
    const seasonUrl = new URL(`${TMDB_BASE_URL}/tv/${tmdbRef.id}/season/${tmdbRef.season}`);
    seasonUrl.searchParams.set('api_key', config.tmdbKey);
    seasonUrl.searchParams.set('language', lang);
    const seasonDetails = await fetchTmdbJson(seasonUrl.toString());
    if (seasonDetails && typeof seasonDetails === 'object') {
      const seasonOverview = typeof seasonDetails.overview === 'string' ? seasonDetails.overview : null;
      if (seasonOverview) {
        translatedOverview = seasonOverview;
      }
    }
  }

  const nextMeta: Record<string, unknown> = { ...meta };
  translateTextFields(nextMeta, translatedTitle, translatedOverview);

  if (tmdbRef.type === 'tv' && Array.isArray(nextMeta.videos) && nextMeta.videos.length > 0) {
    const videos = nextMeta.videos as Array<Record<string, unknown>>;
    const translatedVideos = await mapWithConcurrency(videos, 6, async (video) => {
      const seasonValue = typeof video.season === 'number' ? video.season : parseInt(String(video.season || ''), 10);
      const episodeValue = typeof video.episode === 'number' ? video.episode : parseInt(String(video.episode || ''), 10);
      if (!Number.isFinite(seasonValue) || !Number.isFinite(episodeValue)) {
        return video;
      }

      const episodeTmdbRef = await resolveTmdbEpisodeFromVideo(
        erdbId,
        rawType,
        config.tmdbKey,
        lang,
        seasonValue,
        episodeValue,
      );
      if (!episodeTmdbRef || episodeTmdbRef.type !== 'tv') {
        return video;
      }

      const resolvedSeason =
        typeof episodeTmdbRef.season === 'number' && episodeTmdbRef.season > 0
          ? episodeTmdbRef.season
          : seasonValue;
      const resolvedEpisode =
        typeof episodeTmdbRef.episode === 'number' && episodeTmdbRef.episode > 0
          ? episodeTmdbRef.episode
          : episodeValue;

      const episodeUrl = new URL(
        `${TMDB_BASE_URL}/tv/${episodeTmdbRef.id}/season/${resolvedSeason}/episode/${resolvedEpisode}`,
      );
      episodeUrl.searchParams.set('api_key', config.tmdbKey);
      episodeUrl.searchParams.set('language', lang);
      const episodeData = await fetchTmdbJson(episodeUrl.toString());
      if (!episodeData || typeof episodeData !== 'object') {
        return video;
      }

      const episodeTitle = typeof episodeData.name === 'string' ? episodeData.name : null;
      const episodeOverview = typeof episodeData.overview === 'string' ? episodeData.overview : null;
      if (!episodeTitle && !episodeOverview) return video;

      const nextVideo = { ...video };
      translateTextFields(nextVideo, episodeTitle, episodeOverview);
      return nextVideo;
    });

    nextMeta.videos = translatedVideos;
  }

  return nextMeta;
};

export const isCinemetaManifestUrl = (value: string) => {
  try {
    const url = new URL(value);
    return /(^|[-.])cinemeta\.strem\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
};

export const isAiometadataManifestUrl = (value: string) => value.toLowerCase().includes('aiometadata');

export const isAnimeMeta = (meta: Record<string, unknown>, rawType: string | null, rawId: string | null) => {
  const normalizedType = String(rawType || '').trim().toLowerCase();
  if (normalizedType.startsWith('anime')) return true;

  const normalizedId = String(rawId || '').trim().toLowerCase();
  if (
    normalizedId.startsWith('kitsu:') ||
    normalizedId.startsWith('mal:') ||
    normalizedId.startsWith('anilist:') ||
    normalizedId.startsWith('anidb:')
  ) {
    return true;
  }

  const genres = Array.isArray(meta.genres) ? meta.genres : [];
  return genres.some((genre) => typeof genre === 'string' && genre.trim().toLowerCase() === 'anime');
};

export const applyConfiguredSeriesProvider = (
  normalized: string,
  normalizedType: 'movie' | 'tv' | null,
  provider: string | undefined
) => {
  if (normalizedType !== 'tv') return normalized;
  if (!provider) return normalized;
  if (provider === 'custom') return normalized;
  if ((provider === 'realimdb' || provider === 'imdb') && /^tt\d+$/i.test(normalized)) {
    return `realimdb:${normalized}`;
  }
  return normalized;
};

export const normalizeProxyErdbId = (
  rawId: string | null,
  rawType: string | null,
  config: ProxyConfig,
  meta?: Record<string, unknown>,
  requestedType?: string | null
) => {
  const normalizedType = normalizeStremioType(rawType) || normalizeStremioType(requestedType);
  const normalized = normalizeErdbId(rawId, normalizedType || rawType || requestedType);
  if (!normalized) return null;
  if (isAiometadataManifestUrl(config.url)) {
    if (normalizedType === 'movie') {
      return normalized;
    }
    const provider = config.aiometadataProvider;
    return applyConfiguredSeriesProvider(normalized, normalizedType, provider);
  }

  const configuredSeriesId = applyConfiguredSeriesProvider(
    normalized,
    normalizedType,
    config.seriesMetadataProvider
  );
  if (configuredSeriesId !== normalized) {
    return configuredSeriesId;
  }
  if (!isCinemetaManifestUrl(config.url)) return normalized;

  if (normalizedType === 'tv' && /^tt\d+$/i.test(normalized)) {
    return `realimdb:${normalized}`;
  }
  return normalized;
};

export const isTypeEnabled = (config: ProxyConfig, type: 'poster' | 'backdrop' | 'logo' | 'thumbnail') => {
  if (type === 'poster') return config.posterEnabled !== false;
  if (type === 'backdrop') return config.backdropEnabled !== false;
  if (type === 'logo') return config.logoEnabled !== false;
  return config.thumbnailEnabled !== false;
};

// Kitsu episode thumbnails use a seasonless `kitsu:id:episode` shape.
export const buildEpisodeErdbId = (baseErdbId: string, seasonValue: number, episodeValue: number) => {
  if (baseErdbId.toLowerCase().startsWith('kitsu:')) {
    return `${baseErdbId}:${episodeValue}`;
  }
  return `${baseErdbId}:${seasonValue}:${episodeValue}`;
};

export const rewriteMetaVideoThumbnails = (
  meta: Record<string, unknown>,
  requestUrl: URL,
  config: ProxyConfig,
  requestedType?: string | null,
) => {
  if (!isTypeEnabled(config, 'thumbnail')) return meta;
  if (!Array.isArray(meta.videos) || meta.videos.length === 0) return meta;

  const rawId = typeof meta.id === 'string' ? meta.id : null;
  const rawType = typeof meta.type === 'string' ? meta.type : null;
  const erdbId = normalizeProxyErdbId(rawId, rawType, config, meta, requestedType);
  if (!erdbId) return meta;

  const nextVideos = meta.videos.map((video) => {
    if (!video || typeof video !== 'object') return video;
    const typedVideo = video as Record<string, unknown>;
    const seasonValue =
      typeof typedVideo.season === 'number'
        ? typedVideo.season
        : parseInt(String(typedVideo.season || ''), 10);
    const episodeValue =
      typeof typedVideo.episode === 'number'
        ? typedVideo.episode
        : parseInt(String(typedVideo.episode || ''), 10);
    if (!Number.isFinite(seasonValue) || !Number.isFinite(episodeValue)) {
      return video;
    }

    const episodeErdbId = buildEpisodeErdbId(erdbId, seasonValue, episodeValue);
    return {
      ...typedVideo,
      thumbnail: buildErdbImageUrl({
        reqUrl: requestUrl,
        imageType: 'thumbnail',
        erdbId: episodeErdbId,
        tmdbKey: config.tmdbKey,
        mdblistKey: config.mdblistKey,
        simklClientId: config.simklClientId,
        config,
      }),
    };
  });

  return {
    ...meta,
    videos: nextVideos,
  };
};


export const rewriteMetaImages = (
  meta: Record<string, unknown>,
  requestUrl: URL,
  config: ProxyConfig,
  requestedType?: string | null,
) => {
  if (!meta || typeof meta !== 'object') return meta;
  const rawId = typeof meta.id === 'string' ? meta.id : null;
  const rawType = typeof meta.type === 'string' ? meta.type : null;
  const erdbId = normalizeProxyErdbId(rawId, rawType, config, meta, requestedType);
  if (!erdbId) return meta;

  const nextMeta: Record<string, unknown> = { ...meta };

  if (isTypeEnabled(config, 'poster')) {
    nextMeta.poster = buildErdbImageUrl({
      reqUrl: requestUrl,
      imageType: 'poster',
      erdbId,
      tmdbKey: config.tmdbKey,
      mdblistKey: config.mdblistKey,
      simklClientId: config.simklClientId,
      config,
    });
  }

  if (isTypeEnabled(config, 'backdrop')) {
    nextMeta.background = buildErdbImageUrl({
      reqUrl: requestUrl,
      imageType: 'backdrop',
      erdbId,
      tmdbKey: config.tmdbKey,
      mdblistKey: config.mdblistKey,
      simklClientId: config.simklClientId,
      config,
    });
  }

  if (isTypeEnabled(config, 'logo')) {
    nextMeta.logo = buildErdbImageUrl({
      reqUrl: requestUrl,
      imageType: 'logo',
      erdbId,
      tmdbKey: config.tmdbKey,
      mdblistKey: config.mdblistKey,
      simklClientId: config.simklClientId,
      config,
    });
  }

  return rewriteMetaVideoThumbnails(nextMeta, requestUrl, config, requestedType);
};

