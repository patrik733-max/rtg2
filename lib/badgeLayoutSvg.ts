import { getPosterRatingLayoutLimit, getPosterRatingLayoutMaxBadges, isVerticalPosterRatingLayout, type PosterRatingLayout } from '@/lib/posterRatingLayout';
import { isVerticalThumbnailRatingLayout, type ThumbnailRatingLayout } from '@/lib/thumbnailRatingLayout';
import type { BackdropRatingLayout } from '@/lib/backdropRatingLayout';
import type { RatingStyle } from '@/lib/ratingStyle';
import { DEFAULT_QUALITY_BADGES_STYLE, STREAM_BADGE_META, type RatingBadge, type StreamBadgeKey } from '@/lib/ratingBadgeLogic';
import { LOGO_BASE_HEIGHT, LOGO_FALLBACK_ASPECT_RATIO, LOGO_MAX_WIDTH, LOGO_MIN_WIDTH } from '@/lib/ratingBadgeLogic';
import { STAR_RATING_ICON } from '@/lib/routeConfig';
import { escapeXml } from '@/lib/imageSvgText';
export const chunkBy = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

export type BadgeLayoutMetrics = {
  iconSize: number;
  fontSize: number;
  paddingX: number;
  paddingY: number;
  gap: number;
};
export type PosterBadgeGroups = {
  topBadges: RatingBadge[];
  bottomBadges: RatingBadge[];
  leftBadges: RatingBadge[];
  rightBadges: RatingBadge[];
};
export type BackdropBadgeRegion = {
  left: number;
  width: number;
};

export type BackdropBadgePlacement = BackdropBadgeRegion & {
  align: 'left' | 'center' | 'right';
  vertical: 'top' | 'center' | 'bottom';
  stack: 'row' | 'column';
};
export const DEFAULT_BADGE_MIN_METRICS: BadgeLayoutMetrics = {
  iconSize: 24,
  fontSize: 18,
  paddingX: 8,
  paddingY: 6,
  gap: 6,
};
export const normalizeVerticalBadgeContent = (value?: string | null): 'standard' | 'stacked' => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === 'stacked' ? 'stacked' : 'standard';
};
export const getBadgeTextRightInset = (
  value: string,
  fontSize: number,
  paddingX: number,
  compactText = false
) => {
  const normalized = value.trim();
  const baseInset = Math.max(
    compactText ? 7 : 12,
    Math.round(fontSize * (compactText ? 0.28 : 0.38)) + Math.round(paddingX * 0.75)
  );
  const trailingPercentInset =
    normalized.endsWith('%')
      ? Math.max(
        compactText ? 9 : 12,
        Math.round(fontSize * (compactText ? 0.3 : 0.28))
      )
      : 0;
  return baseInset + trailingPercentInset;
};

export const estimateBadgeTextWidth = (
  value: string,
  fontSize: number,
  compactText = false,
  noMinWidth = false
) => {
  const normalized = value.trim();
  if (!normalized) {
    return Math.round(fontSize * (compactText ? 1.14 : 1.3));
  }
  const measureChar = (ch: string) => {
    if (/[0-9]/.test(ch)) return fontSize * (compactText ? 0.51 : 0.56);
    if (ch === '%') return fontSize * (compactText ? 0.56 : 0.62);
    if (ch === '/' || ch === '|') return fontSize * (compactText ? 0.34 : 0.40);
    if (ch === '.' || ch === ',' || ch === ':') return fontSize * (compactText ? 0.22 : 0.28);
    if (ch === ' ') return fontSize * (compactText ? 0.24 : 0.30);
    if (ch === ' ' || ch === ' ') return fontSize * (compactText ? 0.14 : 0.18); // thin / narrow no-break space
    if (ch === '★') return fontSize * 0.88;
    if (ch === '•') return fontSize * (compactText ? 0.34 : 0.40);
    if (/[mwMW]/.test(ch)) return fontSize * (compactText ? 0.76 : 0.82);
    if (/[A-Z]/.test(ch)) return fontSize * (compactText ? 0.62 : 0.68);
    if (/[ilI1jt]/.test(ch)) return fontSize * (compactText ? 0.26 : 0.32);
    return fontSize * (compactText ? 0.54 : 0.58);
  };
  const measuredTextWidth = [...normalized].reduce((acc, ch) => acc + measureChar(ch), 0);
  const safetyRightPadding = Math.max(
    compactText ? 1 : 2,
    Math.round(
      fontSize *
      (normalized.endsWith('%') || normalized.includes('/')
        ? compactText ? 0.20 : 0.28
        : compactText ? 0.04 : 0.06)
    )
  );
  const structureWidth = Math.round(normalized.length * fontSize * (compactText ? 0.38 : 0.44));
  const isShortDecimalValue = !noMinWidth && /^\d+(?:[.,]\d)?$/.test(normalized) && !normalized.includes('/');
  const shortDecimalMinWidth = isShortDecimalValue
    ? Math.round(fontSize * (compactText ? 1.52 : 1.68))
    : 0;
  return Math.max(
    shortDecimalMinWidth,
    Math.round(fontSize * (compactText ? 0.92 : 1.00)),
    Math.round(measuredTextWidth + safetyRightPadding),
    structureWidth
  );
};

export const estimateBadgeWidth = (
  value: string,
  fontSize: number,
  paddingX: number,
  iconSize: number,
  gap: number,
  compactText = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const isStacked = contentLayout === 'stacked';
  const isStackedStarPromotion = isStacked && value.includes('★');
  const displayValue = isStackedStarPromotion ? value.replace('★ ', '').replace('★', '').trim() : value;
  const textWidth = estimateBadgeTextWidth(displayValue, fontSize, compactText, isStacked);
  const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
  const innerGap = outerPadding;
  if (contentLayout === 'stacked') {
    return Math.max(
      outerPadding * 2 + iconSize,
      outerPadding * 2 + textWidth,
      outerPadding * 2 + Math.round(fontSize * (compactText ? 1.12 : 1.25))
    );
  }
  const effectiveGap = iconSize > 0 ? innerGap : 0;
  return Math.max(
    outerPadding + iconSize + effectiveGap + textWidth + outerPadding,
    outerPadding + iconSize + effectiveGap + outerPadding + Math.round(fontSize * (compactText ? 1.12 : 1.25))
  );
};
export const estimateBadgeHeight = (
  fontSize: number,
  paddingX: number,
  paddingY: number,
  iconSize: number,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  if (contentLayout === 'stacked') {
    const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
    const innerGap = Math.max(6, Math.round(paddingY));
    const textBlockHeight = Math.max(Math.round(fontSize * 1.24), fontSize + 6);
    const bottomPadding = Math.max(outerPadding + 2, paddingY + 4);
    return outerPadding + iconSize + innerGap + textBlockHeight + bottomPadding;
  }
  return Math.max(iconSize, Math.round(fontSize * 1.15)) + paddingY * 2;
};
export const getMinimumCompressedBadgeWidth = (
  value: string,
  fontSize: number,
  paddingX: number,
  iconSize: number,
  gap: number,
  compactText = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
  if (contentLayout === 'stacked') {
    return Math.max(outerPadding * 2 + iconSize, outerPadding * 2 + Math.round(fontSize * (compactText ? 0.82 : 0.92)));
  }
  return (
    outerPadding +
    iconSize +
    outerPadding +
    outerPadding +
    Math.round(fontSize * (compactText ? 0.82 : 0.92))
  );
};

export const measureBadgeRowWidth = (
  rowBadges: RatingBadge[],
  metrics: BadgeLayoutMetrics,
  compactText = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  if (rowBadges.length === 0) return 0;
  return (
    rowBadges.reduce(
      (acc, badge) =>
        acc +
        estimateBadgeWidth(
          badge.value,
          metrics.fontSize,
          metrics.paddingX,
          metrics.iconSize,
          metrics.gap,
          compactText,
          contentLayout
        ),
      0
    ) +
    Math.max(0, rowBadges.length - 1) * metrics.gap
  );
};

export const getLogoCanvasWidth = (aspectRatio?: number | null) => {
  const normalizedAspectRatio = Math.max(
    LOGO_FALLBACK_ASPECT_RATIO,
    aspectRatio || LOGO_FALLBACK_ASPECT_RATIO
  );
  return Math.min(
    LOGO_MAX_WIDTH,
    Math.max(LOGO_MIN_WIDTH, Math.round(LOGO_BASE_HEIGHT * normalizedAspectRatio))
  );
};


export const fitPosterBadgeMetricsToWidth = (
  rows: RatingBadge[][],
  outputWidth: number,
  initialMetrics: BadgeLayoutMetrics,
  minMetrics: BadgeLayoutMetrics = DEFAULT_BADGE_MIN_METRICS,
  compactText = false,
  preserveContent = false,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const maxRowWidth = Math.max(0, outputWidth - 24);
  const metrics: BadgeLayoutMetrics = { ...initialMetrics };

  const measureWidestRow = () =>
    rows.reduce((maxWidth, row) => Math.max(maxWidth, measureBadgeRowWidth(row, metrics, compactText, contentLayout)), 0);

  let widestRow = measureWidestRow();
  let attempts = 0;

  while (widestRow > maxRowWidth && attempts < 20) {
    const ratio = Math.max(0.84, Math.min(0.96, maxRowWidth / widestRow));
    if (preserveContent) {
      const chromeRatio = Math.max(0.68, ratio * ratio);
      const verticalRatio = Math.max(0.76, ratio * ratio);
      const iconRatio = Math.max(0.88, Math.min(0.97, ratio + 0.05));
      const fontRatio = Math.max(0.92, Math.min(0.98, ratio + 0.09));
      metrics.paddingX = Math.max(minMetrics.paddingX, Math.floor(metrics.paddingX * chromeRatio));
      metrics.paddingY = Math.max(minMetrics.paddingY, Math.floor(metrics.paddingY * verticalRatio));
      metrics.gap = Math.max(minMetrics.gap, Math.floor(metrics.gap * chromeRatio));
      metrics.iconSize = Math.max(minMetrics.iconSize, Math.floor(metrics.iconSize * iconRatio));
      metrics.fontSize = Math.max(minMetrics.fontSize, Math.floor(metrics.fontSize * fontRatio));
    } else {
      metrics.iconSize = Math.max(minMetrics.iconSize, Math.floor(metrics.iconSize * ratio));
      metrics.fontSize = Math.max(minMetrics.fontSize, Math.floor(metrics.fontSize * ratio));
      metrics.paddingX = Math.max(minMetrics.paddingX, Math.floor(metrics.paddingX * ratio));
      metrics.paddingY = Math.max(minMetrics.paddingY, Math.floor(metrics.paddingY * ratio));
      metrics.gap = Math.max(minMetrics.gap, Math.floor(metrics.gap * ratio));
    }

    // When the ratio stalls near the minimums, force a small extra shrink.
    if (widestRow > maxRowWidth) {
      if (metrics.paddingX > minMetrics.paddingX) metrics.paddingX -= 1;
      else if (metrics.gap > minMetrics.gap) metrics.gap -= 1;
      else if (metrics.paddingY > minMetrics.paddingY) metrics.paddingY -= 1;
      else if (!preserveContent && metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
      else if (metrics.iconSize > minMetrics.iconSize) metrics.iconSize -= 1;
      else if (metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
      else break;
    }

    widestRow = measureWidestRow();
    attempts += 1;
  }

  while (widestRow > maxRowWidth) {
    if (metrics.gap > minMetrics.gap) metrics.gap -= 1;
    else if (metrics.paddingX > minMetrics.paddingX) metrics.paddingX -= 1;
    else if (metrics.paddingY > minMetrics.paddingY) metrics.paddingY -= 1;
    else if (metrics.iconSize > minMetrics.iconSize) metrics.iconSize -= 1;
    else if (metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
    else break;
    widestRow = measureWidestRow();
  }

  return metrics;
};

export const measureBadgeColumnHeight = (
  columnBadges: RatingBadge[],
  metrics: BadgeLayoutMetrics,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  if (columnBadges.length === 0) return 0;
  const badgeHeight = estimateBadgeHeight(
    metrics.fontSize,
    metrics.paddingX,
    metrics.paddingY,
    metrics.iconSize,
    contentLayout
  );
  return columnBadges.length * badgeHeight + Math.max(0, columnBadges.length - 1) * metrics.gap;
};

export const getMaxBadgeColumnCount = (
  outputHeight: number,
  metrics: BadgeLayoutMetrics,
  topOffset: number,
  bottomOffset: number,
  reservedTopRows = 0,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const badgeHeight = estimateBadgeHeight(
    metrics.fontSize,
    metrics.paddingX,
    metrics.paddingY,
    metrics.iconSize,
    contentLayout
  );
  const step = badgeHeight + metrics.gap;
  const reservedTopHeight = reservedTopRows > 0 ? reservedTopRows * step : 0;
  const availableHeight = Math.max(0, outputHeight - topOffset - bottomOffset - reservedTopHeight);
  if (badgeHeight <= 0 || step <= 0) return 1;
  return Math.max(1, Math.floor((availableHeight + metrics.gap) / step));
};

export const fitPosterBadgeMetricsToHeight = (
  columns: RatingBadge[][],
  outputHeight: number,
  initialMetrics: BadgeLayoutMetrics,
  topOffset: number,
  bottomOffset: number,
  minMetrics: BadgeLayoutMetrics = DEFAULT_BADGE_MIN_METRICS,
  reservedTopRows = 0,
  contentLayout: 'standard' | 'stacked' = 'standard'
) => {
  const metrics: BadgeLayoutMetrics = { ...initialMetrics };
  const getMaxColumnHeight = () => {
    const badgeHeight = estimateBadgeHeight(
      metrics.fontSize,
      metrics.paddingX,
      metrics.paddingY,
      metrics.iconSize,
      contentLayout
    );
    const reservedTopHeight =
      reservedTopRows > 0 ? reservedTopRows * (badgeHeight + metrics.gap) : 0;
    return Math.max(0, outputHeight - topOffset - bottomOffset - reservedTopHeight);
  };

  const measureTallestColumn = () =>
    columns.reduce((maxHeight, column) => Math.max(maxHeight, measureBadgeColumnHeight(column, metrics, contentLayout)), 0);

  let tallestColumn = measureTallestColumn();
  let attempts = 0;

  while (tallestColumn > getMaxColumnHeight() && attempts < 12) {
    const maxColumnHeight = getMaxColumnHeight();
    const ratio = Math.max(0.84, Math.min(0.96, maxColumnHeight / tallestColumn));
    metrics.iconSize = Math.max(minMetrics.iconSize, Math.floor(metrics.iconSize * ratio));
    metrics.fontSize = Math.max(minMetrics.fontSize, Math.floor(metrics.fontSize * ratio));
    metrics.paddingX = Math.max(minMetrics.paddingX, Math.floor(metrics.paddingX * ratio));
    metrics.paddingY = Math.max(minMetrics.paddingY, Math.floor(metrics.paddingY * ratio));
    metrics.gap = Math.max(minMetrics.gap, Math.floor(metrics.gap * ratio));

    if (tallestColumn > getMaxColumnHeight()) {
      if (metrics.paddingY > minMetrics.paddingY) metrics.paddingY -= 1;
      else if (metrics.gap > minMetrics.gap) metrics.gap -= 1;
      else if (metrics.fontSize > minMetrics.fontSize) metrics.fontSize -= 1;
      else if (metrics.iconSize > minMetrics.iconSize) metrics.iconSize -= 1;
      else if (metrics.paddingX > minMetrics.paddingX) metrics.paddingX -= 1;
      else break;
    }
    tallestColumn = measureTallestColumn();
    attempts += 1;
  }

  return metrics;
};

export const splitPosterBadgesByLayout = (
  badges: RatingBadge[],
  layout: PosterRatingLayout,
  maxPerColumn?: number
): PosterBadgeGroups => {
  const totalLimit = getPosterRatingLayoutMaxBadges(layout, maxPerColumn);
  const limitedBadges = typeof totalLimit === 'number' ? badges.slice(0, totalLimit) : badges;
  const columnLimit = typeof maxPerColumn === 'number' ? Math.max(1, maxPerColumn) : null;
  if (layout === 'top') {
    return { topBadges: limitedBadges, bottomBadges: [], leftBadges: [], rightBadges: [] };
  }
  if (layout === 'bottom') {
    return { topBadges: [], bottomBadges: limitedBadges, leftBadges: [], rightBadges: [] };
  }
  if (layout === 'left') {
    return {
      topBadges: [],
      bottomBadges: [],
      leftBadges: columnLimit ? limitedBadges.slice(0, columnLimit) : limitedBadges,
      rightBadges: [],
    };
  }
  if (layout === 'right') {
    return {
      topBadges: [],
      bottomBadges: [],
      leftBadges: [],
      rightBadges: columnLimit ? limitedBadges.slice(0, columnLimit) : limitedBadges,
    };
  }

  if (layout === 'left-right') {
    const effectiveLimit = columnLimit || Math.ceil(limitedBadges.length / 2);
    const leftBadges: RatingBadge[] = [];
    const rightBadges: RatingBadge[] = [];

    for (const badge of limitedBadges) {
      if (leftBadges.length <= rightBadges.length && leftBadges.length < effectiveLimit) {
        leftBadges.push(badge);
      } else if (rightBadges.length < effectiveLimit) {
        rightBadges.push(badge);
      } else if (leftBadges.length < effectiveLimit) {
        leftBadges.push(badge);
      }
    }

    return {
      topBadges: [],
      bottomBadges: [],
      leftBadges,
      rightBadges,
    };
  }

  const primary = limitedBadges.slice(0, 3);
  const secondary = limitedBadges.slice(3, 6);
  return { topBadges: primary, bottomBadges: secondary, leftBadges: [], rightBadges: [] };
};



export const getBackdropBadgePlacement = (
  outputWidth: number,
  layout: BackdropRatingLayout | ThumbnailRatingLayout,
  imageType: 'backdrop' | 'thumbnail' = 'backdrop'
): BackdropBadgePlacement => {
  const isVertical =
    imageType === 'thumbnail'
      ? isVerticalThumbnailRatingLayout(layout as ThumbnailRatingLayout)
      : layout === 'right-vertical';
  const baseLayout =
    imageType === 'thumbnail' && isVertical ? layout.replace(/-vertical$/, '') : layout;
  const isRight = baseLayout.startsWith('right');
  const isLeft = baseLayout.startsWith('left');
  const isTop = baseLayout.endsWith('-top');
  const isBottom = baseLayout.endsWith('-bottom');
  const vertical =
    imageType === 'backdrop' ? 'top' : isTop ? 'top' : isBottom ? 'bottom' : 'center';

  if (!isRight && !isLeft) {
    return {
      left: 0,
      width: outputWidth,
      align: 'center',
      vertical,
      stack: isVertical ? 'column' : 'row',
    };
  }

  if (imageType === 'thumbnail' && !isVertical) {
    return {
      left: 12,
      width: Math.max(0, outputWidth - 24),
      align: isRight ? 'right' : 'left',
      vertical,
      stack: 'row',
    };
  }

  const width = Math.min(outputWidth - 24, Math.max(280, Math.floor(outputWidth * 0.46)));
  return {
    left: isRight ? Math.max(12, outputWidth - width - 12) : 12,
    width,
    align: isRight ? 'right' : 'left',
    vertical,
    stack: isVertical ? 'column' : 'row',
  };
};

export const splitBackdropVerticalBadgesIntoColumns = (
  badges: RatingBadge[],
  placement: BackdropBadgePlacement,
  metrics: BadgeLayoutMetrics,
  maxPerColumn: number,
  contentLayout: 'standard' | 'stacked' = 'standard',
  maxColumns = 3
) => {
  if (badges.length === 0 || maxPerColumn <= 0) return [];
  const effectiveMaxColumns = Math.max(1, maxColumns);
  const columnGap = Math.max(12, metrics.gap);
  const estimateColumnMaxWidth = (columnBadges: RatingBadge[]) =>
    columnBadges.reduce(
      (maxWidth, badge) =>
        Math.max(
          maxWidth,
          estimateBadgeWidth(
            badge.value,
            metrics.fontSize,
            metrics.paddingX,
            metrics.iconSize,
            metrics.gap,
            false,
            contentLayout
          )
        ),
      0
    );
  const requestedColumnCount = Math.max(1, Math.ceil(badges.length / maxPerColumn));
  const startingColumnCount = Math.min(effectiveMaxColumns, requestedColumnCount);

  for (let columnCount = startingColumnCount; columnCount >= 1; columnCount -= 1) {
    const visibleBadges = badges.slice(0, columnCount * maxPerColumn);
    const orderedColumns = Array.from({ length: columnCount }, (_, index) =>
      visibleBadges.slice(index * maxPerColumn, (index + 1) * maxPerColumn)
    ).filter((column) => column.length > 0);
    const visualColumns =
      placement.align === 'right' ? [...orderedColumns].reverse() : orderedColumns;
    const totalWidth =
      visualColumns.reduce((sum, column) => sum + estimateColumnMaxWidth(column), 0) +
      Math.max(0, visualColumns.length - 1) * columnGap;
    if (totalWidth <= placement.width) {
      return visualColumns;
    }
  }

  return [badges.slice(0, maxPerColumn)];
};

export const getBadgeOuterRadius = (height: number, ratingStyle: RatingStyle) =>
  ratingStyle === 'square' ? Math.max(10, Math.round(height * 0.24)) : Math.round(height / 2);

export const getBadgeIconRadius = (iconSize: number, ratingStyle: RatingStyle) =>
  ratingStyle === 'square' ? Math.max(6, Math.round(iconSize * 0.22)) : Math.round(iconSize / 2);

export const buildQualityBadgeSvg = (
  key: StreamBadgeKey,
  height: number,
  widthOverride?: number,
  style: RatingStyle = DEFAULT_QUALITY_BADGES_STYLE,
  iconDataUri?: string | null,
  colorMode: 'colored' | 'white' = 'white'
) => {
  const h = Math.max(32, height);
  const isReferencePlain = style === 'plain';
  const radius =
    style === 'glass'
      ? Math.round(h / 2)
      : Math.round(h * 0.18);
  const strokeWidth =
    style === 'glass'
      ? 1
      : style === 'square'
        ? Math.max(1, Math.round(h * 0.05))
        : Math.max(2, Math.round(h * 0.08));
  const innerPadding = Math.max(10, Math.round(h * 0.16));
  const fontFamily = `'Noto Sans','DejaVu Sans','Arial Black',Arial,sans-serif`;
  const baseRect = (width: number, stroke: string, fill: string, extra = '') =>
    `<rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${Math.max(0, width - strokeWidth)}" height="${Math.max(0, h - strokeWidth)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${extra}/>`;
  const resolveChrome = (accentColor: string) => {
    if (style === 'plain') return null;
    if (style === 'glass') {
      return {
        stroke: accentColor,
        strokeOpacity: '0.58',
        fill: 'rgba(17,24,39,0.70)',
      };
    }
    return { stroke: accentColor, strokeOpacity: '1', fill: '#0b0b0b' };
  };
  const buildRect = (width: number, accentColor: string, extra = '') => {
    if (style === 'plain') return '';
    if (style === 'glass') {
      const gradientId = `apple-glass-q-${key.replace(/[^a-z0-9]/gi, '-')}-${Math.round(accentColor.length)}`;
      const isWhite = accentColor.toLowerCase() === '#ffffff' || colorMode === 'white';
      const fillOpacityStart = isWhite ? '0.12' : '0.22';
      const fillOpacityEnd = isWhite ? '0.04' : '0.10';
      const borderOpacityStart = isWhite ? '0.25' : '0.42';
      const borderOpacityEnd = isWhite ? '0.10' : '0.20';
      return `
<defs>
  <clipPath id="capsule-clip-${gradientId}">
    <rect x="0" y="0" width="${width}" height="${h}" rx="${radius}" />
  </clipPath>
  <linearGradient id="apple-glass-fill-${gradientId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${accentColor}" stop-opacity="${fillOpacityStart}" />
    <stop offset="100%" stop-color="${accentColor}" stop-opacity="${fillOpacityEnd}" />
  </linearGradient>
  <linearGradient id="apple-glass-border-${gradientId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${accentColor}" stop-opacity="${borderOpacityStart}" />
    <stop offset="100%" stop-color="${accentColor}" stop-opacity="${borderOpacityEnd}" />
  </linearGradient>
  <filter id="apple-glass-shadow-${gradientId}" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" />
    <feOffset dx="0" dy="3.2" result="offsetblur" />
    <feFlood flood-color="#000000" flood-opacity="0.54" result="glowcolor" />
    <feComposite in="glowcolor" in2="offsetblur" operator="in" result="glow" />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
<rect x="0.5" y="0.5" width="${width - 1}" height="${h - 1}" rx="${radius}" fill="url(#apple-glass-fill-${gradientId})" filter="url(#apple-glass-shadow-${gradientId})" ${extra} />
<rect x="0.5" y="0.5" width="${width - 1}" height="${h - 1}" rx="${radius}" fill="none" stroke="url(#apple-glass-border-${gradientId})" stroke-width="1" ${extra} />
`.trim();
    }
    const chrome = resolveChrome(accentColor);
    if (!chrome) return '';
    return baseRect(width, chrome.stroke, chrome.fill, extra);
  };
  const universalStroke = ' stroke="rgba(0,0,0,0.80)" stroke-width="1.8" paint-order="stroke fill"';
  const qualityBadgeColor = '#ffffff';

  const textShadowFilter = `
    <filter id="text-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="blur" />
      <feOffset dx="0" dy="1.2" in="blur" result="offsetBlur" />
      <feComponentTransfer in="offsetBlur" result="shadow">
        <feFuncA type="linear" slope="0.85" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="shadow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `.trim();

  const premiumGlowFilter = `
    <filter id="premium-glow" x="-50%" y="-50%" width="200%" height="200%">
      <!-- Wide ambient shadow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="6.5" result="blurWide" />
      <feComponentTransfer in="blurWide" result="glowWide">
        <feFuncA type="linear" slope="1.2" />
      </feComponentTransfer>

      <!-- Medium soft shadow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="3.6" result="blurMed" />
      <feComponentTransfer in="blurMed" result="glowMed">
        <feFuncA type="linear" slope="2.0" />
      </feComponentTransfer>

      <!-- Core dark shadow -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blurCore" />
      <feComponentTransfer in="blurCore" result="glowCore">
        <feFuncA type="linear" slope="3.0" />
      </feComponentTransfer>

      <!-- Sharp drop shadow for depth -->
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="blurSharp" />
      <feOffset dx="0" dy="1.5" in="blurSharp" result="offsetSharp" />
      <feComponentTransfer in="offsetSharp" result="shadowSharp">
        <feFuncA type="linear" slope="3.0" />
      </feComponentTransfer>

      <feMerge>
        <feMergeNode in="glowWide" />
        <feMergeNode in="glowMed" />
        <feMergeNode in="glowCore" />
        <feMergeNode in="shadowSharp" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `.trim();

  const getTextColor = () => {
    if (colorMode === 'white') return '#ffffff';
    if (key === '4k') return '#f7c948';
    if (key === 'hdr') return '#ffbe01';
    const meta = STREAM_BADGE_META.get(key);
    return meta?.accentColor || '#ffffff';
  };
  const textColor = getTextColor();

  const generateGlowText = (attrs: string, content: string) => {
    if (isReferencePlain) {
      const glowLayers = Array.from({ length: 10 }, (_, i) => {
        const strokeWidth = 18 - i * 1.6;
        const opacity = 0.03 + (i * 0.04);
        return `<text ${attrs} fill="none" stroke="black" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${content}</text>`;
      }).join('\n');
      return `${glowLayers}\n<text ${attrs} fill="${textColor}" stroke="black" stroke-width="1.8" paint-order="stroke fill" filter="url(#premium-glow)">${content}</text>`;
    }
    return `<text ${attrs} fill="${textColor}"${universalStroke} filter="url(#premium-glow)">${content}</text>`;
  };

  const wrapSvg = (content: string, width: number, height: number) => {
    const vbWidth = width + 8;
    const vbHeight = height + 8;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-4 -4 ${vbWidth} ${vbHeight}">
${textShadowFilter}
${premiumGlowFilter}
<g>
${content}
</g>
</svg>`;
  };

  const wrapSvgPadded = (content: string, width: number, height: number) => {
    const parentWidth = width + 24;
    const parentHeight = height + 24;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${parentWidth}" height="${parentHeight}" viewBox="-12 -12 ${parentWidth} ${parentHeight}">
${textShadowFilter}
${premiumGlowFilter}
<g>
${content}
</g>
</svg>`;
  };

  const iconMeta = STREAM_BADGE_META.get(key);
  if (iconMeta && iconDataUri) {
    const width = widthOverride ?? Math.round(h * (iconMeta.iconWidthRatio ?? Math.max(1.35, 0.72 + iconMeta.label.length * 0.34)));
    const imageHref = escapeXml(iconDataUri);
    const rectColor = colorMode === 'white' ? '#ffffff' : (iconMeta.accentColor || '#ffffff');
    const rect = isReferencePlain ? '' : buildRect(width, rectColor);
    const imagePaddingX = Math.max(2, Math.round(h * 0.04));
    const imagePaddingY = Math.max(2, Math.round(h * 0.04));
    const imageWidth = Math.max(1, width - imagePaddingX * 2);
    const imageHeight = Math.max(1, h - imagePaddingY * 2);

    if (isReferencePlain) {
      const content = `<image href="${imageHref}" x="${imagePaddingX}" y="${imagePaddingY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet" filter="url(#premium-glow)"/>`;
      return { svg: wrapSvgPadded(content, width, h), width, height: h, isPadded: true };
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
<image href="${imageHref}" x="${imagePaddingX}" y="${imagePaddingY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;
    return { svg, width, height: h };
  }

  if (key === '4k') {
    const width = widthOverride ?? Math.round(h * 1.3);
    if (isReferencePlain) {
      const bigSize = Math.round(h * 0.46);
      const bigY = Math.round(h * 0.64);
      const content = generateGlowText(`x="${width / 2}" y="${bigY}" font-family="${fontFamily}" font-size="${bigSize}" font-weight="900" text-anchor="middle"`, '4K');
      return { svg: wrapSvgPadded(content, width, h), width, height: h, isPadded: true };
    }
    const bigSize = Math.round(h * 0.56);
    const smallSize = Math.round(h * 0.2);
    const bigY = Math.round(h * 0.58);
    const smallY = Math.round(h * 0.86);
    const color = colorMode === 'white' ? '#ffffff' : '#f7c948';
    const rect = buildRect(width, color);
    const clipStart = style === 'glass' ? `<g clip-path="url(#capsule-clip-apple-glass-q-4k-${Math.round(color.length)})">` : '';
    const clipEnd = style === 'glass' ? '</g>' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
${clipStart}
<text x="${width / 2}" y="${bigY}" font-family="${fontFamily}" font-size="${bigSize}" font-weight="800" text-anchor="middle" fill="${color}"${universalStroke}>4K</text>
<text x="${width / 2}" y="${smallY}" font-family="${fontFamily}" font-size="${smallSize}" font-weight="700" text-anchor="middle" fill="${color}" letter-spacing="0.06em"${universalStroke}>ULTRA HD</text>
${clipEnd}
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'hdr') {
    const width = widthOverride ?? Math.round(h * 1.45);
    if (isReferencePlain) {
      const textSize = Math.round(h * 0.46);
      const textY = Math.round(h * 0.64);
      const content = generateGlowText(`x="${width / 2}" y="${textY}" font-family="${fontFamily}" font-size="${textSize}" font-weight="900" text-anchor="middle"`, 'HDR');
      return { svg: wrapSvgPadded(content, width, h), width, height: h, isPadded: true };
    }
    const bigSize = Math.round(h * 0.5);
    const smallSize = Math.round(h * 0.2);
    const bigY = Math.round(h * 0.57);
    const smallY = Math.round(h * 0.86);
    const rectBorder = colorMode === 'white' ? '#ffffff' : 'url(#hdrBorder)';
    const nonSquareAccent = colorMode === 'white' ? '#ffffff' : '#ffbe01';
    const smallTextColor = colorMode === 'white' ? '#ffffff' : '#a7f3d0';
    const rect =
      style === 'square'
        ? baseRect(width, rectBorder, '#0b0b0b')
        : buildRect(width, nonSquareAccent);
    const clipStart = style === 'glass' ? `<g clip-path="url(#capsule-clip-apple-glass-q-hdr-7)">` : '';
    const clipEnd = style === 'glass' ? '</g>' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
<defs>
  <linearGradient id="hdrBorder" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#22c55e"/>
    <stop offset="50%" stop-color="#22d3ee"/>
    <stop offset="100%" stop-color="#facc15"/>
  </linearGradient>
</defs>
${rect}
${clipStart}
<text x="${width / 2}" y="${bigY}" font-family="${fontFamily}" font-size="${bigSize}" font-weight="800" text-anchor="middle" fill="white"${universalStroke}>HDR</text>
<text x="${width / 2}" y="${smallY}" font-family="${fontFamily}" font-size="${smallSize}" font-weight="700" text-anchor="middle" fill="${smallTextColor}" letter-spacing="0.05em"${universalStroke}>TRUE COLOR</text>
${clipEnd}
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'dolbyvision') {
    const width = widthOverride ?? Math.round(h * 1.7);
    if (isReferencePlain) {
      const topSize = Math.round(h * 0.24);
      const bottomSize = Math.round(h * 0.34);
      const topY = Math.round(h * 0.35);
      const bottomY = Math.round(h * 0.78);
      const content = `${generateGlowText(`x="${width / 2}" y="${topY}" font-family="${fontFamily}" font-size="${topSize}" font-weight="900" text-anchor="middle"`, 'DOLBY')}
${generateGlowText(`x="${width / 2}" y="${bottomY}" font-family="${fontFamily}" font-size="${bottomSize}" font-weight="900" text-anchor="middle" letter-spacing="0.04em"`, 'VISION')}`;
      return { svg: wrapSvgPadded(content, width, h), width, height: h, isPadded: true };
    }
    const topSize = Math.round(h * 0.22);
    const bottomSize = Math.round(h * 0.42);
    const topY = Math.round(h * 0.36);
    const bottomY = Math.round(h * 0.73);
    const textLength = Math.max(40, Math.floor(width - innerPadding * 2));
    const rect = buildRect(width, '#ffffff');
    const clipStart = style === 'glass' ? `<g clip-path="url(#capsule-clip-apple-glass-q-dolbyvision-7)">` : '';
    const clipEnd = style === 'glass' ? '</g>' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
${clipStart}
<text x="${width / 2}" y="${topY}" font-family="${fontFamily}" font-size="${topSize}" font-weight="700" text-anchor="middle" fill="#ffffff" letter-spacing="0.18em" textLength="${textLength}" lengthAdjust="spacingAndGlyphs"${universalStroke}>DOLBY</text>
<text x="${width / 2}" y="${bottomY}" font-family="${fontFamily}" font-size="${bottomSize}" font-weight="800" text-anchor="middle" fill="#ffffff" textLength="${textLength}" lengthAdjust="spacingAndGlyphs"${universalStroke}>VISION</text>
${clipEnd}
</svg>`;
    return { svg, width, height: h };
  }

  if (key === 'remux') {
    const width = widthOverride ?? Math.round(h * 1.5);
    if (isReferencePlain) {
      const textSize = Math.round(h * 0.42);
      const textY = Math.round(h * 0.63);
      const content = generateGlowText(`x="${width / 2}" y="${textY}" font-family="${fontFamily}" font-size="${textSize}" font-weight="900" text-anchor="middle"`, 'REMUX');
      return { svg: wrapSvgPadded(content, width, h), width, height: h, isPadded: true };
    }
    const textSize = Math.round(h * 0.42);
    const textY = Math.round(h * 0.63);
    const color = colorMode === 'white' ? '#ffffff' : '#27c04f';
    const rect = buildRect(width, color);
    const clipStart = style === 'glass' ? `<g clip-path="url(#capsule-clip-apple-glass-q-remux-${Math.round(color.length)})">` : '';
    const clipEnd = style === 'glass' ? '</g>' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
${clipStart}
<text x="${width / 2}" y="${textY}" font-family="${fontFamily}" font-size="${textSize}" font-weight="800" text-anchor="middle" fill="${color}" letter-spacing="0.08em"${universalStroke}>REMUX</text>
${clipEnd}
</svg>`;
    return { svg, width, height: h };
  }

  const meta = STREAM_BADGE_META.get(key);
  if (meta) {
    const label = escapeXml(meta.label);
    const width = widthOverride ?? Math.max(Math.round(h * 1.35), Math.round(h * (0.72 + label.length * 0.34)));
    const textSize = Math.max(12, Math.round(h * (label.length > 6 ? 0.32 : 0.42)));
    const textY = Math.round(h * 0.63);
    if (isReferencePlain) {
      const content = generateGlowText(`x="${width / 2}" y="${textY}" font-family="${fontFamily}" font-size="${textSize}" font-weight="900" text-anchor="middle"`, label);
      return { svg: wrapSvgPadded(content, width, h), width, height: h, isPadded: true };
    }
    const accentColor = colorMode === 'white' ? '#ffffff' : meta.accentColor;
    const rect = buildRect(width, accentColor);
    const clipStart = style === 'glass' ? `<g clip-path="url(#capsule-clip-apple-glass-q-${key.replace(/[^a-z0-9]/gi, '-')}-${Math.round(accentColor.length)})">` : '';
    const clipEnd = style === 'glass' ? '</g>' : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}">
${rect}
${clipStart}
<text x="${width / 2}" y="${textY}" font-family="${fontFamily}" font-size="${textSize}" font-weight="800" text-anchor="middle" fill="${accentColor}" textLength="${Math.max(20, width - innerPadding * 2)}" lengthAdjust="spacingAndGlyphs"${universalStroke}>${label}</text>
${clipEnd}
</svg>`;
    return { svg, width, height: h };
  }

  return null;
};

export const buildBadgeSvg = ({
  width,
  height,
  iconSize,
  fontSize,
  paddingX,
  gap,
  accentColor,
  monogram,
  iconDataUri: initialIconDataUri,
  iconCornerRadius = 0,
  iconScale,
  value: initialValue,
  ratingStyle: initialRatingStyle,
  ratingsColorMode = 'colored',
  compactText = false,
  contentLayout = 'standard',
}: {
  width: number;
  height: number;
  iconSize: number;
  fontSize: number;
  paddingX: number;
  gap: number;
  accentColor: string;
  monogram: string;
  iconDataUri?: string | null;
  iconCornerRadius?: number;
  iconScale?: number;
  value: string;
  ratingStyle: RatingStyle;
  ratingsColorMode?: 'colored' | 'transparent';
  compactText?: boolean;
  contentLayout?: 'standard' | 'stacked';
}) => {
  const ratingStyle = initialRatingStyle === 'solid-light' ? 'glass' : initialRatingStyle;
  let value = initialValue;
  let iconDataUri = initialIconDataUri;
  const clipPathId = `clip-${(monogram + value).replace(/[^a-zA-Z0-9]/g, '')}-${Math.round(accentColor.length)}`;

  if (
    contentLayout === 'stacked' &&
    !iconDataUri &&
    monogram === '' &&
    value.includes('★')
  ) {
    iconDataUri = STAR_RATING_ICON;
    value = value.replace('★ ', '').replace('★', '').trim();
  }

  const radius = getBadgeOuterRadius(height, ratingStyle);
  const outerRadius =
    contentLayout === 'stacked' && ratingStyle === 'glass'
      ? Math.max(16, Math.round(iconSize * 0.78))
      : radius;
  const iconRadius = getBadgeIconRadius(iconSize, ratingStyle);
  const outerPadding = Math.max(6, Math.round(paddingX * 0.7));
  const innerGap = contentLayout === 'stacked' ? Math.max(4, Math.round(outerPadding * 0.65)) : outerPadding;
  const iconX =
    contentLayout === 'stacked'
      ? Math.max(outerPadding, Math.round((width - iconSize) / 2))
      : outerPadding;
  const hideIcon = !iconDataUri && monogram === '';
  const iconY =
    contentLayout === 'stacked'
      ? outerPadding
      : Math.round((height - iconSize) / 2);
  const iconCx = iconX + Math.round(iconSize / 2);
  const iconCy = iconY + Math.round(iconSize / 2);
  const iconFontSize = Math.max(12, Math.round(iconSize * 0.42));
  const resolvedIconScale =
    typeof iconScale === 'number' && Number.isFinite(iconScale)
      ? Math.max(0.5, Math.min(1.15, iconScale))
      : 1;
  const baseRenderedIconSize = ratingStyle === 'plain' ? iconSize - 2 : iconSize - 3;
  const renderedIconSize = Math.max(1, Math.round(baseRenderedIconSize * resolvedIconScale));
  const iconImageOffset = (baseRenderedIconSize - renderedIconSize) / 2;
  const iconImageX = (ratingStyle === 'plain' ? iconX + 1 : iconX + 1.5) + iconImageOffset;
  const iconImageY = (ratingStyle === 'plain' ? iconY + 1 : iconY + 1.5) + iconImageOffset;
  const valueX = contentLayout === 'stacked'
    ? Math.round(width / 2)
    : hideIcon
      ? Math.round(width / 2)
      : iconX + iconSize + innerGap;
  const valueY =
    contentLayout === 'stacked'
      ? iconY + iconSize + innerGap + fontSize
      : Math.round(height / 2 + fontSize * 0.36);
  const valueTextWidth = estimateBadgeTextWidth(value, fontSize, compactText);
  const valueRightInset = outerPadding;
  const valueAvailableWidth =
    contentLayout === 'stacked'
      ? Math.max(0, width - outerPadding * 2)
      : Math.max(0, width - valueX - valueRightInset);
  const valueTextLength =
    compactText && valueTextWidth > valueAvailableWidth
      ? ` textLength="${valueAvailableWidth}" lengthAdjust="spacingAndGlyphs"`
      : '';
  const valueFontFamily = compactText
    ? `'Noto Sans','DejaVu Sans','Arial Narrow','Liberation Sans Narrow','Nimbus Sans Narrow','Roboto Condensed',Arial,sans-serif`
    : `'Noto Sans','DejaVu Sans',Arial,sans-serif`;
  const valueLetterSpacing = compactText ? ' letter-spacing="-0.04em"' : '';
  const iconShape =
    hideIcon || ratingStyle === 'plain' || iconDataUri
      ? ''
      : ratingStyle === 'square'
        ? `<rect x="${iconX + 0.75}" y="${iconY + 0.75}" width="${Math.max(0, iconSize - 1.5)}" height="${Math.max(0, iconSize - 1.5)}" rx="${Math.max(4, iconCornerRadius || iconRadius)}" fill="rgb(10,10,10)" />`
        : `<circle cx="${iconCx}" cy="${iconCy}" r="${iconRadius}" fill="${accentColor}" stroke="rgba(255,255,255,0.45)" />`;
  const iconClipPath =
    ratingStyle === 'plain'
      ? ''
      : ratingStyle === 'square'
        ? `<rect x="${iconX + 1.5}" y="${iconY + 1.5}" width="${Math.max(0, iconSize - 3)}" height="${Math.max(0, iconSize - 3)}" rx="${Math.max(4, iconCornerRadius || iconRadius - 1)}" />`
        : `<circle cx="${iconCx}" cy="${iconCy}" r="${Math.max(1, iconRadius - 1)}" />`;
  const iconBorder =
    hideIcon || ratingStyle === 'plain' || iconDataUri
      ? ''
      : ratingStyle === 'square'
        ? iconCornerRadius > 0
          ? `<rect x="${iconX + 1.5}" y="${iconY + 1.5}" width="${Math.max(0, iconSize - 3)}" height="${Math.max(0, iconSize - 3)}" rx="${Math.max(4, iconCornerRadius || iconRadius - 1)}" fill="none" stroke="rgba(255,255,255,0.18)" />`
          : ''
        : `<circle cx="${iconCx}" cy="${iconCy}" r="${iconRadius}" fill="none" stroke="rgba(255,255,255,0.45)" />`;
  const glassColor = ratingsColorMode === 'transparent' ? '#ffffff' : accentColor;
  const glassFillOpacityStart = ratingsColorMode === 'transparent' ? '0.12' : '0.22';
  const glassFillOpacityEnd = ratingsColorMode === 'transparent' ? '0.04' : '0.10';
  const glassBorderOpacityStart = ratingsColorMode === 'transparent' ? '0.25' : '0.42';
  const glassBorderOpacityEnd = ratingsColorMode === 'transparent' ? '0.10' : '0.20';

  const outerRect =
    ratingStyle === 'plain'
      ? ''
      : ratingStyle === 'square'
        ? `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${outerRadius}" fill="#0b0b0b" stroke="${accentColor}" />`
        : `
<defs>
  <clipPath id="capsule-clip-${clipPathId}">
    <rect x="0" y="0" width="${width}" height="${height}" rx="${outerRadius}" />
  </clipPath>
  <linearGradient id="apple-glass-fill-${clipPathId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${glassColor}" stop-opacity="${glassFillOpacityStart}" />
    <stop offset="100%" stop-color="${glassColor}" stop-opacity="${glassFillOpacityEnd}" />
  </linearGradient>
  <linearGradient id="apple-glass-border-${clipPathId}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${glassColor}" stop-opacity="${glassBorderOpacityStart}" />
    <stop offset="100%" stop-color="${glassColor}" stop-opacity="${glassBorderOpacityEnd}" />
  </linearGradient>
  <filter id="apple-glass-shadow-${clipPathId}" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.8" />
    <feOffset dx="0" dy="3.2" result="offsetblur" />
    <feFlood flood-color="#000000" flood-opacity="0.54" result="glowcolor" />
    <feComposite in="glowcolor" in2="offsetblur" operator="in" result="glow" />
    <feMerge>
      <feMergeNode in="glow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${outerRadius}" fill="url(#apple-glass-fill-${clipPathId})" filter="url(#apple-glass-shadow-${clipPathId})" />
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${outerRadius}" fill="none" stroke="url(#apple-glass-border-${clipPathId})" stroke-width="1" />
`.trim();
  const monogramFill = ratingStyle === 'glass' ? 'white' : accentColor;
  const textShadowFilter = `
    <filter id="text-shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="blur" />
      <feOffset dx="0" dy="1.2" in="blur" result="offsetBlur" />
      <feComponentTransfer in="offsetBlur" result="shadow">
        <feFuncA type="linear" slope="0.85" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="shadow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `.trim();
  const itemFilter = '';
  const iconImage =
    !iconDataUri
      ? ''
      : ratingStyle === 'plain'
        ? `<image href="${iconDataUri}" x="${iconImageX}" y="${iconImageY}" width="${renderedIconSize}" height="${renderedIconSize}" preserveAspectRatio="xMidYMid meet" filter="url(#text-shadow)" />`
        : `<defs><clipPath id="${clipPathId}">${iconClipPath}</clipPath></defs><image href="${iconDataUri}" x="${iconImageX}" y="${iconImageY}" width="${renderedIconSize}" height="${renderedIconSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipPathId})" filter="url(#text-shadow)" />${iconBorder}`;
  const monogramText =
    iconDataUri || hideIcon
      ? ''
      : `<text x="${iconCx}" y="${Math.round(iconCy + iconFontSize * 0.34)}" font-family="Arial, sans-serif" font-size="${iconFontSize}" font-weight="700" text-anchor="middle" fill="${monogramFill}">${escapeXml(monogram)}</text>${iconBorder}`;
  const valueStroke = ratingStyle === 'plain' 
    ? ' stroke="black" stroke-width="0.8" paint-order="stroke fill"' 
    : ' stroke="rgba(0,0,0,0.45)" stroke-width="1.2" paint-order="stroke fill"';
  const plainGroupStart = '';
  const plainGroupEnd = '';
  const valueNumericStyle =
    ' style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: \'tnum\' 1, \'lnum\' 1;"';
  const valueTextAnchor = contentLayout === 'stacked' || hideIcon ? ' text-anchor="middle"' : '';
  const starRatingMatch = hideIcon ? value.match(/^(?:(.+?)\s+)?★\s+(.+)$/) : null;
  const textInnerContent = starRatingMatch
    ? (() => {
      const genreValue = String(starRatingMatch[1] || '').trim();
      const ratingValue = starRatingMatch[2];
      const genreText = genreValue ? genreValue : '';
      const dyOffset = Math.round(fontSize * 0.07);
      return `${genreText ? `<tspan xml:space="preserve" fill-opacity="0.72">${escapeXml(genreText)} </tspan><tspan dy="-${dyOffset}">★</tspan>` : `<tspan dy="-${dyOffset}">★</tspan>`
        }<tspan xml:space="preserve" dy="${dyOffset}"${valueNumericStyle}> ${escapeXml(ratingValue)}</tspan>`;
    })()
    : escapeXml(value);

  const isStackedOrHide = contentLayout === 'stacked' || hideIcon;
  const commonAttrs = `x="${valueX}" y="${valueY}" font-family="${valueFontFamily}" font-size="${fontSize}" font-weight="800"${isStackedOrHide ? ' text-anchor="middle"' : valueTextAnchor}${valueLetterSpacing}${starRatingMatch ? ' xml:space="preserve"' : valueTextLength}`;

  const glowLayers = ratingStyle === 'plain'
    ? Array.from({ length: 10 }, (_, i) => {
      const strokeWidth = 18 - i * 1.6;
      const opacity = 0.03 + (i * 0.04);
      return `<text ${commonAttrs} fill="none" stroke="black" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${textInnerContent}</text>`;
    }).join('\n')
    : '';

  const valueText = `${glowLayers}<text ${commonAttrs} fill="white"${valueStroke} filter="url(#text-shadow)">${textInnerContent}</text>`;
  const capsuleClipStart = ratingStyle === 'glass' ? `<g clip-path="url(#capsule-clip-${clipPathId})">` : '';
  const capsuleClipEnd = ratingStyle === 'glass' ? '</g>' : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-4 -4 ${width + 8} ${height + 8}">
${textShadowFilter}
${outerRect}
${plainGroupStart}
${capsuleClipStart}
${iconShape}
${iconImage}
${monogramText}
${valueText}
${capsuleClipEnd}
${plainGroupEnd}
</svg>`;
};

export const buildRankingBadgeSvg = (value: string, label: string, iconDataUri?: string | null, noBox = false, scale = 1.0) => {
  const height = Math.round(66 * scale);
  const paddingX = Math.round(22 * scale);
  const gap = Math.round(10 * scale);
  const rankFontSize = Math.round(40 * scale);
  const labelFontSize = Math.round(38 * scale);
  const iconSize = Math.round(42 * scale);

  const rankWidth = estimateBadgeTextWidth(value, rankFontSize, false);
  const labelWidth = estimateBadgeTextWidth(label, labelFontSize, false);

  const hasIcon = Boolean(iconDataUri);
  const hasLabel = label.length > 0;

  if (!hasIcon && !hasLabel) {
    const isTextBadge = value.length > 3 && !value.startsWith('#');
    const compactFontSize = isTextBadge ? Math.round(28 * scale) : rankFontSize;
    const compactWidth = estimateBadgeTextWidth(value, compactFontSize, false);
    const width = Math.ceil(compactWidth + paddingX * 2);
    const rankX = Math.round((width - compactWidth) / 2);
    const textY = Math.round(height / 2 + compactFontSize * 0.36);
    const fontStyle = isTextBadge ? 'normal' : 'italic';
    const fontWeight = isTextBadge ? '800' : '500';

    const rankGlowLayers = noBox
      ? Array.from({ length: 8 }, (_, i) => {
        const strokeWidth = 20 - i * 2.5;
        const opacity = 0.05 + (i * 0.05);
        return `<text x="${rankX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${compactFontSize}" font-style="${fontStyle}" font-weight="${fontWeight}" fill="none" stroke="rgba(0,0,0,${opacity})" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1;">${escapeXml(value)}</text>`;
      }).join('\\n')
      : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-4 -4 ${width + 8} ${height + 8}">
${!noBox ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="20" fill="rgb(21,35,49)" fill-opacity="0.92" stroke="rgba(255,255,255,0.10)" stroke-width="1" />` : ''}
${rankGlowLayers}
<text x="${rankX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${compactFontSize}" font-style="${fontStyle}" font-weight="${fontWeight}" fill="white" stroke="rgba(0,0,0,0.85)" stroke-width="2.2" paint-order="stroke fill" style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1;">${escapeXml(value)}</text>
</svg>`;
    return { svg, width, height };
  }

  if (hasIcon && !hasLabel) {
    const iconX = paddingX;
    const rankX = iconX + iconSize + gap;
    const width = Math.ceil(rankX + rankWidth + paddingX);
    const textY = Math.round(height / 2 + rankFontSize * 0.36);
    const iconY = Math.round((height - iconSize) / 2);

    const rankGlowLayers = noBox
      ? Array.from({ length: 8 }, (_, i) => {
        const strokeWidth = 20 - i * 2.5;
        const opacity = 0.05 + (i * 0.05);
        return `<text x="${rankX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${rankFontSize}" font-style="italic" font-weight="500" fill="none" stroke="rgba(0,0,0,${opacity})" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1;">${escapeXml(value)}</text>`;
      }).join('\\n')
      : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-4 -4 ${width + 8} ${height + 8}">
${!noBox ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="20" fill="rgb(21,35,49)" fill-opacity="0.92" stroke="rgba(255,255,255,0.10)" stroke-width="1" />` : ''}
<image href="${iconDataUri}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" />
${rankGlowLayers}
<text x="${rankX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${rankFontSize}" font-style="italic" font-weight="500" fill="white" stroke="rgba(0,0,0,0.85)" stroke-width="2.2" paint-order="stroke fill" style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1;">${escapeXml(value)}</text>
</svg>`;
    return { svg, width, height };
  }

  const iconX = paddingX;
  const rankX = hasIcon ? iconX + iconSize + gap : paddingX;
  const labelX = rankX + rankWidth + gap;

  const width = Math.ceil(labelX + labelWidth + paddingX);
  const textY = Math.round(height / 2 + labelFontSize * 0.36);
  const iconY = Math.round((height - iconSize) / 2);

  const rankGlowLayers = noBox
    ? Array.from({ length: 8 }, (_, i) => {
      const strokeWidth = 20 - i * 2.5;
      const opacity = 0.05 + (i * 0.05);
      return `<text x="${rankX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${rankFontSize}" font-style="italic" font-weight="500" fill="none" stroke="rgba(0,0,0,${opacity})" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1;">${escapeXml(value)}</text>`;
    }).join('\\n')
    : '';

  const labelGlowLayers = noBox
    ? Array.from({ length: 8 }, (_, i) => {
      const strokeWidth = 20 - i * 2.5;
      const opacity = 0.05 + (i * 0.05);
      return `<text x="${labelX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${labelFontSize}" font-weight="800" fill="none" stroke="rgba(0,0,0,${opacity})" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round">${escapeXml(label)}</text>`;
    }).join('\\n')
    : '';

  const blurDef = '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="-4 -4 ${width + 8} ${height + 8}">
${blurDef}
${!noBox ? `<rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="20" fill="rgb(21,35,49)" fill-opacity="0.92" stroke="rgba(255,255,255,0.10)" stroke-width="1" />` : ''}
${hasIcon ? `<image href="${iconDataUri}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" />` : ''}
${rankGlowLayers}
<text x="${rankX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${rankFontSize}" font-style="italic" font-weight="500" fill="white" stroke="rgba(0,0,0,0.85)" stroke-width="2.2" paint-order="stroke fill" style="font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1;">${escapeXml(value)}</text>
${labelGlowLayers}
<text x="${labelX}" y="${textY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${labelFontSize}" font-weight="800" fill="white" stroke="rgba(0,0,0,0.85)" stroke-width="2.2" paint-order="stroke fill">${escapeXml(label)}</text>
</svg>`;
  return { svg, width, height };
};


