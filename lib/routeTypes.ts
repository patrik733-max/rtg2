import type { PosterGenrePosition, RatingBadge, RankingBadge, RankingPosition, StreamQualityFlags } from '@/lib/ratingBadgeLogic';
import type { BackdropRatingLayout } from '@/lib/backdropRatingLayout';
import type { ThumbnailRatingLayout } from '@/lib/thumbnailRatingLayout';
import type { BackdropRatingsSize } from '@/lib/backdropRatingsSize';
import type { ThumbnailSize } from '@/lib/thumbnailSize';
import type { PosterRatingLayout } from '@/lib/posterRatingLayout';
import type { RatingStyle } from '@/lib/ratingStyle';

export type RenderImageType = 'poster' | 'backdrop' | 'logo' | 'thumbnail';
export type QualityBadgesSide = 'left' | 'right';
export type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;

export type CachedJsonResponse = {
  ok: boolean;
  status: number;
  data: any;
};

export type CachedTextResponse = {
  ok: boolean;
  status: number;
  data: string | null;
};

export type CachedJsonNetworkObserver = {
  onNetworkResponse?: (input: {
    key: string;
    url: string;
    status: number;
    ok: boolean;
    data: any;
    durationMs: number;
  }) => Promise<void> | void;
  onNetworkError?: (input: {
    key: string;
    url: string;
    errorMessage: string;
    durationMs: number;
  }) => Promise<void> | void;
};

export type StreamBadgesCache = {
  flags: StreamQualityFlags;
};

export type StreamBadgesResult = {
  badges: RatingBadge[];
  cacheTtlMs: number;
};

export type RenderedImagePayload = {
  body: ArrayBuffer;
  contentType: string;
  cacheControl: string;
};

export type PhaseDurations = {
  auth: number;
  tmdb: number;
  mdb: number;
  stream: number;
  render: number;
};

export type FastRenderInput = {
  imageType: RenderImageType;
  outputFormat: import('@/lib/ratingBadgeLogic').OutputFormat;
  imgUrl: string;
  outputWidth: number;
  outputHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  finalOutputHeight: number;
  logoBadgeTopGap: number;
  logoBadgeBandHeight: number;
  logoBadgeMaxWidth: number;
  logoBadgesPerRow: number;
  posterRowHorizontalInset: number;
  posterTitleText?: string | null;
  posterLogoUrl?: string | null;
  posterReferenceBadgeHeight?: number;
  posterReferenceVerticalBadgeHeight?: number;
  posterReferenceBadgeGap?: number;
  thumbnailFallbackEpisodeText?: string | null;
  thumbnailFallbackEpisodeCode?: string | null;
  badgeIconSize: number;
  badgeFontSize: number;
  badgePaddingX: number;
  badgePaddingY: number;
  badgeGap: number;
  qualityBadgeIconSize?: number;
  qualityBadgeFontSize?: number;
  qualityBadgePaddingX?: number;
  qualityBadgePaddingY?: number;
  qualityBadgeGap?: number;
  badgeTopOffset: number;
  badgeBottomOffset: number;
  badges: RatingBadge[];
  qualityBadges: RatingBadge[];
  qualityBadgesSide: QualityBadgesSide;
  posterQualityBadgesPosition: PosterQualityBadgesPosition;
  qualityBadgesStyle: RatingStyle;
  posterRatingsLayout: PosterRatingLayout;
  posterRatingsMaxPerSide: number | null;
  backdropRatingsLayout: BackdropRatingLayout | ThumbnailRatingLayout;
  backdropRatingsSize: BackdropRatingsSize;
  thumbnailRatingsLayout: ThumbnailRatingLayout;
  thumbnailSize: ThumbnailSize;
  verticalBadgeContent: 'standard' | 'stacked';
  ratingStyle: RatingStyle;
  topBadges: RatingBadge[];
  bottomBadges: RatingBadge[];
  leftBadges: RatingBadge[];
  rightBadges: RatingBadge[];
  backdropColumns?: RatingBadge[][];
  backdropRows?: RatingBadge[][];
  posterGenreBadge?: RatingBadge | null;
  posterGenrePosition: PosterGenrePosition;
  rankingBadge?: RankingBadge | null;
  rankingPosition: RankingPosition;
  posterConfiguratorPreset?: string | null;
  posterVignetteEnabled?: boolean;
  cacheControl: string;
};

export class HttpError extends Error {
  status: number;
  headers?: HeadersInit;

  constructor(message: string, status: number, headers?: HeadersInit) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}
