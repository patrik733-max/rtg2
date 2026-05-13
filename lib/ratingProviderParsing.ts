import { normalizeRatingPreference } from '@/lib/ratingPreferences';
import { formatRatingNumber } from '@/lib/ratingBadgeLogic';
import type { RatingPreference } from '@/lib/ratingPreferences';
export const normalizeRatingValue = (value: unknown): string | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return formatRatingNumber(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = Number(trimmed.replace(',', '.'));
    if (!Number.isNaN(normalized) && Number.isFinite(normalized)) {
      return formatRatingNumber(normalized);
    }
  }

  if (value && typeof value === 'object') {
    const nested = value as { value?: unknown; rating?: unknown; score?: unknown };
    return normalizeRatingValue(nested.value ?? nested.rating ?? nested.score);
  }

  return null;
};

export const isNegativeRatingValue = (value: string | null | undefined) => {
  if (!value) return false;
  const numericCandidate = value
    .replace('%', '')
    .split('/')[0]
    .replace(',', '.')
    .trim();
  const numericValue = Number(numericCandidate);
  return !Number.isNaN(numericValue) && numericValue < 0;
};

export const collectMDBListRatings = (payload: any) => {
  const result = new Map<RatingPreference, string>();
  const items = payload?.ratings;
  if (!Array.isArray(items)) {
    const directMdbListScore = normalizeRatingValue(
      payload?.score ?? payload?.mdblist_score ?? payload?.mdblist ?? null
    );
    if (directMdbListScore && !isNegativeRatingValue(directMdbListScore)) {
      result.set('mdblist', directMdbListScore);
    }
    return result;
  }

  for (const item of items) {
    const sourceRaw = String(item?.source || item?.name || item?.provider || '');
    const source = normalizeRatingPreference(sourceRaw);
    if (!source || result.has(source)) continue;
    const rating = normalizeRatingValue(item?.value ?? item?.rating ?? item?.score);
    if (rating && !(source === 'mdblist' && isNegativeRatingValue(rating))) {
      result.set(source, rating);
    }
  }

  if (!result.has('mdblist')) {
    const directMdbListScore = normalizeRatingValue(
      payload?.score ?? payload?.mdblist_score ?? payload?.mdblist ?? null
    );
    if (directMdbListScore && !isNegativeRatingValue(directMdbListScore)) {
      result.set('mdblist', directMdbListScore);
    }
  }

  return result;
};


