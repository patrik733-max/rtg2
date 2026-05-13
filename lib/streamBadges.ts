import { getMetadata, setMetadata } from '@/lib/metadataCache';
import {
  buildStreamBadgesFromFlags,
  buildTorrentioUrl,
  collectStreamFlags,
  createEmptyStreamFlags,
  extractTorrentioFilenames,
} from '@/lib/ratingBadgeLogic';
import { fetchWithRetry } from '@/lib/request';
import { STREAM_BADGES_CACHE_TTL_MS } from '@/lib/routeConfig';
import { measurePhase, withDedupe } from '@/lib/routeShared';
import type { PhaseDurations, StreamBadgesCache, StreamBadgesResult } from '@/lib/routeTypes';
import { getDeterministicTtlMs } from '@/lib/routeUtils';

const streamBadgesInFlight = new Map<string, Promise<StreamBadgesResult>>();

export const fetchStreamBadges = async (input: {
  type: 'movie' | 'series';
  id: string;
  phases: PhaseDurations;
  cacheTtlMs?: number;
}): Promise<StreamBadgesResult> => {
  const trimmedId = input.id.trim();
  if (!trimmedId) {
    return { badges: [], cacheTtlMs: STREAM_BADGES_CACHE_TTL_MS };
  }
  const cacheKey = `streambadges:${input.type}:${trimmedId}`;
  const ttlMs =
    typeof input.cacheTtlMs === 'number' && Number.isFinite(input.cacheTtlMs) && input.cacheTtlMs > 0
      ? input.cacheTtlMs
      : getDeterministicTtlMs(STREAM_BADGES_CACHE_TTL_MS, cacheKey);
  const cached = getMetadata<StreamBadgesCache>(cacheKey);
  if (cached) {
    return { badges: buildStreamBadgesFromFlags(cached.flags), cacheTtlMs: ttlMs };
  }

  return withDedupe(streamBadgesInFlight, cacheKey, async () => {
    const warm = getMetadata<StreamBadgesCache>(cacheKey);
    if (warm) {
      return { badges: buildStreamBadgesFromFlags(warm.flags), cacheTtlMs: ttlMs };
    }

    let response: Response | null = null;
    try {
      response = await measurePhase(input.phases, 'stream', () =>
        fetchWithRetry(buildTorrentioUrl(input.type, trimmedId), {
          cache: 'no-store',
          timeout: 10000,
        })
      );
    } catch {
      const failureTtl = Math.min(ttlMs, 2 * 60 * 1000);
      setMetadata(cacheKey, { flags: createEmptyStreamFlags() }, failureTtl);
      return { badges: [], cacheTtlMs: failureTtl };
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const flags = collectStreamFlags(extractTorrentioFilenames(payload));
    const targetTtl = response.ok ? ttlMs : Math.min(ttlMs, 2 * 60 * 1000);
    setMetadata(cacheKey, { flags }, targetTtl);
    return { badges: buildStreamBadgesFromFlags(flags), cacheTtlMs: targetTtl };
  });
};
