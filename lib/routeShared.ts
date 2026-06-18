import { createHash, timingSafeEqual } from 'node:crypto';
import type { PhaseDurations, RenderedImagePayload } from '@/lib/routeTypes';

export const sha1Hex = (value: string) => createHash('sha1').update(value).digest('hex');

export const safeCompareText = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
};

export const measurePhase = async <T,>(phases: PhaseDurations, phase: keyof PhaseDurations, fn: () => Promise<T>) => {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    phases[phase] += performance.now() - start;
  }
};

const DEDUPE_TIMEOUT_MS = 30_000;

export const withDedupe = async <T,>(
  inFlightMap: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
  timeoutMs: number = DEDUPE_TIMEOUT_MS
) => {
  const existing = inFlightMap.get(key);
  if (existing) return existing;

  const fetchPromise = factory();

  // Attach a silent catch handler to prevent unhandled rejection warnings in Node.js
  // if fetchPromise rejects after Promise.race has already settled due to a timeout.
  fetchPromise.catch(() => {
    // Handle silently as the caller will have already received the timeout error
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = Promise.race([
    fetchPromise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Dedupe timeout: ${key}`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
    inFlightMap.delete(key);
  });
  inFlightMap.set(key, promise);
  return promise;
};

export const buildServerTimingHeader = (phases: PhaseDurations, totalMs: number) => {
  const parts = [
    `auth;dur=${phases.auth.toFixed(1)}`,
    `tmdb;dur=${phases.tmdb.toFixed(1)}`,
    `mdb;dur=${phases.mdb.toFixed(1)}`,
    `stream;dur=${phases.stream.toFixed(1)}`,
    `render;dur=${phases.render.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ];
  return parts.join(', ');
};

export const createImageHttpResponse = (
  payload: RenderedImagePayload,
  serverTiming: string,
  cacheStatus: 'hit' | 'miss' | 'shared'
) =>
  new Response(payload.body.slice(0), {
    status: 200,
    headers: {
      'Content-Type': payload.contentType,
      'Cache-Control': payload.cacheControl,
      Vary: 'Accept',
      'Server-Timing': serverTiming,
      'X-ERDB-Cache': cacheStatus,
    },
  });
