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
  if (interval === 'WEEKLY' || interval === 'MONTHLY') return '';
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    let label = rtf.format(0, 'day');
    if (!label) label = 'Today';
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return 'Today';
  }
};

export type FallbackBadge = {
  value: string;
  label: string;
  noBox?: boolean;
  compact?: boolean;
};

export const fetchTmdbTrending = async (
  tmdbKey: string,
  tmdbId: string,
  mediaType: 'movie' | 'tv',
  timeWindow: 'day' | 'week',
  phases: PhaseDurations
): Promise<number | null> => {
  if (!tmdbKey || !tmdbId) return null;
  const cacheKey = `tmdb:trending:${mediaType}:${timeWindow}`;
  const url = `https://api.themoviedb.org/3/trending/${mediaType}/${timeWindow}?api_key=${tmdbKey}`;

  const response = await fetchJsonCached(
    cacheKey,
    url,
    6 * 60 * 60 * 1000,
    phases,
    'tmdb'
  );

  const results = response.ok ? response.data?.results : [];
  if (!results || !Array.isArray(results)) return null;

  for (let i = 0; i < results.length; i++) {
    if (String(results[i].id) === tmdbId) {
      return i + 1;
    }
  }
  return null;
};

export const fetchCinemetaAwards = async (
  imdbId: string | null,
  mediaType: 'movie' | 'tv',
  phases: PhaseDurations
): Promise<string | null> => {
  if (!imdbId) return null;
  const type = mediaType === 'movie' ? 'movie' : 'tv';
  const cacheKey = `cinemeta:awards:${type}:${imdbId}`;
  const url = `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`;

  const response = await fetchJsonCached(
    cacheKey,
    url,
    24 * 60 * 60 * 1000,
    phases,
    'tmdb'
  );

  if (!response.ok || !response.data?.meta?.awards) return null;
  return String(response.data.meta.awards);
};

export const parseCinemetaAwards = (awards: string, language: string): FallbackBadge | null => {
  const langCode = language.split('-')[0].toLowerCase();
  const labels: Record<string, { oscarWin: string; oscarNom: string; emmyWin: string; emmyNom: string }> = {
    it: { oscarWin: 'Vincitore Oscar', oscarNom: 'Candidato Oscar', emmyWin: 'Vincitore Emmy', emmyNom: 'Candidato Emmy' },
    es: { oscarWin: 'Ganador Oscar', oscarNom: 'Nominado Oscar', emmyWin: 'Ganador Emmy', emmyNom: 'Nominado Emmy' },
    fr: { oscarWin: 'Vainqueur Oscar', oscarNom: 'Nommé Oscar', emmyWin: 'Vainqueur Emmy', emmyNom: 'Nommé Emmy' },
    de: { oscarWin: 'Oscar Gewinner', oscarNom: 'Oscar Nominiert', emmyWin: 'Emmy Gewinner', emmyNom: 'Emmy Nominiert' },
    pt: { oscarWin: 'Vencedor Oscar', oscarNom: 'Indicado Oscar', emmyWin: 'Vencedor Emmy', emmyNom: 'Indicado Emmy' },
    ru: { oscarWin: 'Лауреат Оскара', oscarNom: 'Номинант Оскара', emmyWin: 'Лауреат Эмми', emmyNom: 'Номинант Эмми' },
    ja: { oscarWin: 'オスカー受賞', oscarNom: 'オスカー候補', emmyWin: 'エミー受賞', emmyNom: 'エミー候補' },
    ko: { oscarWin: '오스카 수상', oscarNom: '오스카 후보', emmyWin: '에미 수상', emmyNom: '에미 후보' },
    zh: { oscarWin: '奥斯卡获奖', oscarNom: '奥斯卡提名', emmyWin: '艾美奖获奖', emmyNom: '艾美奖提名' },
    ar: { oscarWin: 'فائز بأوسكار', oscarNom: 'مرشح لأوسكار', emmyWin: 'فائز بإيمي', emmyNom: 'مرشح لإيمي' },
    hi: { oscarWin: 'ऑस्कर विजेता', oscarNom: 'ऑस्कर नामांकित', emmyWin: 'एमी विजेता', emmyNom: 'एमी नामांकित' },
    tr: { oscarWin: 'Oscar Kazananı', oscarNom: 'Oscar Adayı', emmyWin: 'Emmy Kazananı', emmyNom: 'Emmy Adayı' },
    nl: { oscarWin: 'Oscar Winnaar', oscarNom: 'Oscar Genomineerd', emmyWin: 'Emmy Winnaar', emmyNom: 'Emmy Genomineerd' },
    pl: { oscarWin: 'Laureat Oscar', oscarNom: 'Nominacja Oscar', emmyWin: 'Laureat Emmy', emmyNom: 'Nominacja Emmy' },
    sv: { oscarWin: 'Oscar Vinnare', oscarNom: 'Oscar Nominerad', emmyWin: 'Emmy Vinnare', emmyNom: 'Emmy Nominerad' },
    da: { oscarWin: 'Oscar Vinder', oscarNom: 'Oscar Nomineret', emmyWin: 'Emmy Vinder', emmyNom: 'Emmy Nomineret' },
    fi: { oscarWin: 'Oscar Voittaja', oscarNom: 'Oscar Ehdokas', emmyWin: 'Emmy Voittaja', emmyNom: 'Emmy Ehdokas' },
    no: { oscarWin: 'Oscar Vinner', oscarNom: 'Oscar Nominert', emmyWin: 'Emmy Vinner', emmyNom: 'Emmy Nominert' },
    cs: { oscarWin: 'Vítěz Oscar', oscarNom: 'Nominován Oscar', emmyWin: 'Vítěz Emmy', emmyNom: 'Nominován Emmy' },
    el: { oscarWin: 'Νικητής Oscar', oscarNom: 'Υποψήφιος Oscar', emmyWin: 'Νικητής Emmy', emmyNom: 'Υποψήφιος Emmy' },
    he: { oscarWin: 'זוכה אוסקר', oscarNom: 'מועמד אוסקר', emmyWin: 'זוכה אמי', emmyNom: 'מועמד אמי' },
    th: { oscarWin: 'ผู้ชนะออสการ์', oscarNom: 'ผู้เข้าชิงออสการ์', emmyWin: 'ผู้ชนะเอ็มมี่', emmyNom: 'ผู้เข้าชิงเอ็มมี่' },
    id: { oscarWin: 'Pemenang Oscar', oscarNom: 'Nominasi Oscar', emmyWin: 'Pemenang Emmy', emmyNom: 'Nominasi Emmy' },
    uk: { oscarWin: 'Лауреат Оскара', oscarNom: 'Номінант Оскара', emmyWin: 'Лауреат Еммі', emmyNom: 'Номінант Еммі' },
    ro: { oscarWin: 'Câștigător Oscar', oscarNom: 'Nominalizat Oscar', emmyWin: 'Câștigător Emmy', emmyNom: 'Nominalizat Emmy' },
    hu: { oscarWin: 'Oscar Nyertes', oscarNom: 'Oscar Jelölt', emmyWin: 'Emmy Nyertes', emmyNom: 'Emmy Jelölt' },
  };
  const l = labels[langCode] || { oscarWin: 'Oscar Winner', oscarNom: 'Oscar Nominee', emmyWin: 'Emmy Winner', emmyNom: 'Emmy Nominee' };

  if (/\bwon\s+\d+\s+oscars?\b/i.test(awards)) {
    return { value: l.oscarWin, label: l.oscarWin, noBox: false, compact: true };
  }
  if (/\bnominated for\s+\d+\s+oscars?\b/i.test(awards)) {
    return { value: l.oscarNom, label: l.oscarNom, noBox: false, compact: true };
  }
  if (/\bwon\s+\d+\s+(?:primetime\s+)?emmys?\b/i.test(awards)) {
    return { value: l.emmyWin, label: l.emmyWin, noBox: false, compact: true };
  }
  if (/\bnominated for\s+\d+\s+(?:primetime\s+)?emmys?\b/i.test(awards)) {
    return { value: l.emmyNom, label: l.emmyNom, noBox: false, compact: true };
  }
  return null;
};

export const buildFallbackBadge = async (params: {
  tmdbKey: string | null;
  tmdbId: string | null;
  imdbId: string | null;
  mediaType: 'movie' | 'tv';
  voteAverage: number | null;
  language: string;
  phases: PhaseDurations;
}): Promise<FallbackBadge | null> => {
  const { tmdbKey, tmdbId, imdbId, mediaType, voteAverage, language, phases } = params;

  if (imdbId) {
    const awards = await fetchCinemetaAwards(imdbId, mediaType, phases);
    if (awards) {
      const awardBadge = parseCinemetaAwards(awards, language);
      if (awardBadge) return awardBadge;
    }
  }

  if (voteAverage != null && voteAverage >= 8.0) {
    const topRatedLabels: Record<string, string> = {
      it: 'Top Voti',
      es: 'Mejor Valorados',
      fr: 'Mieux Notés',
      de: 'Top Bewertet',
      pt: 'Melhor Avaliados',
      ru: 'Топ Рейтинг',
      ja: '高評価',
      ko: '최고 평점',
      zh: '最高评分',
      ar: 'الأعلى تقييماً',
      hi: 'टॉप रेटेड',
      tr: 'En Yüksek Puan',
      nl: 'Top Beoordeeld',
      pl: 'Najwyżej Oceniane',
      sv: 'Toppbetyg',
      da: 'Topbedømt',
      fi: 'Parhaiten Arvostellut',
      no: 'Topp Vurdert',
      cs: 'Nejlépe Hodnocené',
      el: 'Κορυφαία Βαθμολογία',
      he: 'הכי מדורג',
      th: 'ที่ได้รับการให้คะแนนสูงสุด',
      id: 'Terbaik Dinilai',
      uk: 'Топ Рейтинг',
      ro: 'Cel Mai Bine Cotat',
      hu: 'Legjobban Értékelt',
    };
    const langCode = language.split('-')[0].toLowerCase();
    const topRatedLabel = topRatedLabels[langCode] || 'Top Rated';
    return {
      value: topRatedLabel,
      label: topRatedLabel,
      noBox: false,
      compact: true,
    };
  }

  return null;
};
