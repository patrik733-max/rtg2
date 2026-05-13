import { getMetadata, setMetadata } from '@/lib/metadataCache';
import { fetchWithRetry } from '@/lib/request';
import { measurePhase, withDedupe } from '@/lib/routeShared';
import type {
  CachedJsonNetworkObserver,
  CachedJsonResponse,
  CachedTextResponse,
  PhaseDurations,
} from '@/lib/routeTypes';

const jsonMetadataInFlight = new Map<string, Promise<CachedJsonResponse>>();
const textMetadataInFlight = new Map<string, Promise<CachedTextResponse>>();

export const fetchJsonCached = async (
  key: string,
  url: string,
  ttlMs: number,
  phases: PhaseDurations,
  phase: keyof PhaseDurations,
  init?: RequestInit,
  observer?: CachedJsonNetworkObserver
): Promise<CachedJsonResponse> => {
  const cached = getMetadata<CachedJsonResponse>(key);
  if (cached) {
    return cached;
  }

  return withDedupe(jsonMetadataInFlight, key, async () => {
    const fromCache = getMetadata<CachedJsonResponse>(key);
    if (fromCache) return fromCache;

    const fetchStartedAt = Date.now();
    let response: Response;
    try {
      response = await measurePhase(phases, phase, () =>
        fetchWithRetry(url, {
          cache: 'no-store',
          ...init,
        })
      );
    } catch (error) {
      if (observer?.onNetworkError) {
        try {
          await observer.onNetworkError({
            key,
            url,
            errorMessage: error instanceof Error ? error.message : 'Network error',
            durationMs: Date.now() - fetchStartedAt,
          });
        } catch {
          // Ignore observer failures for monitoring hooks.
        }
      }
      throw error;
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    const payload: CachedJsonResponse = {
      ok: response.ok,
      status: response.status,
      data,
    };
    if (observer?.onNetworkResponse) {
      try {
        await observer.onNetworkResponse({
          key,
          url,
          status: response.status,
          ok: response.ok,
          data,
          durationMs: Date.now() - fetchStartedAt,
        });
      } catch {
        // Ignore observer failures for monitoring hooks.
      }
    }

    const failureTtlMs = Math.min(ttlMs, 2 * 60 * 1000);
    setMetadata(key, payload, response.ok ? ttlMs : failureTtlMs);
    return payload;
  });
};

export const fetchTextCached = async (
  key: string,
  url: string,
  ttlMs: number,
  phases: PhaseDurations,
  phase: keyof PhaseDurations,
  init?: RequestInit
): Promise<CachedTextResponse> => {
  const cached = getMetadata<CachedTextResponse>(key);
  if (cached) {
    return cached;
  }

  return withDedupe(textMetadataInFlight, key, async () => {
    const fromCache = getMetadata<CachedTextResponse>(key);
    if (fromCache) return fromCache;

    const response = await measurePhase(phases, phase, () =>
      fetchWithRetry(url, {
        cache: 'no-store',
        redirect: 'follow',
        ...init,
      })
    );

    let data: string | null = null;
    try {
      data = await response.text();
    } catch {
      data = null;
    }

    const payload: CachedTextResponse = {
      ok: response.ok,
      status: response.status,
      data,
    };
    const failureTtlMs = Math.min(ttlMs, 2 * 60 * 1000);
    setMetadata(key, payload, response.ok ? ttlMs : failureTtlMs);
    return payload;
  });
};
