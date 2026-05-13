import { bufferToArrayBuffer, getProviderIconDataUri, getSharpFactory, getSourceImagePayload } from '@/lib/imageAssetPipeline';
import { buildPosterTitleSvg, buildThumbnailFallbackTitleSvg } from '@/lib/imageSvgText';
import {
  buildBadgeSvg,
  buildQualityBadgeSvg,
  buildRankingBadgeSvg,
  DEFAULT_BADGE_MIN_METRICS,
  chunkBy,
  estimateBadgeHeight,
  estimateBadgeWidth,
  fitPosterBadgeMetricsToHeight,
  fitPosterBadgeMetricsToWidth,
  getBackdropBadgePlacement,
  getMaxBadgeColumnCount,
  getMinimumCompressedBadgeWidth,
  measureBadgeColumnHeight,
  measureBadgeRowWidth,
  normalizeVerticalBadgeContent,
  splitBackdropVerticalBadgesIntoColumns,
  splitPosterBadgesByLayout,
  type BackdropBadgePlacement,
  type BadgeLayoutMetrics,
} from '@/lib/badgeLayoutSvg';
import {
  LOGO_FALLBACK_ASPECT_RATIO,
  STREAM_BADGE_META,
  buildProviderMonogram,
  outputFormatToContentType,
  resolvePosterQualityBadgePlacement,
  type BadgeKey,
  type RatingBadge,
  type StreamBadgeKey,
} from '@/lib/ratingBadgeLogic';
import { RANKING_ICON_URL } from '@/lib/routeConfig';
import { measurePhase } from '@/lib/routeShared';
import type { FastRenderInput, PhaseDurations, QualityBadgesSide, RenderedImagePayload } from '@/lib/routeTypes';
export const renderWithSharp = async (
  input: FastRenderInput,
  phases: PhaseDurations
): Promise<RenderedImagePayload> => {
  const sharp = await getSharpFactory();

  return await measurePhase(phases, 'render', async () => {
    const imageWidth = input.imageWidth ?? input.outputWidth;
    const imageHeight = input.imageHeight ?? input.outputHeight;
    const sourcePayload = await getSourceImagePayload(input.imgUrl);
    const sourceBuffer = Buffer.from(sourcePayload.body);
    const overlays: Array<{ input: Buffer; top: number; left: number }> = [];
    const transparentBackground = { r: 0, g: 0, b: 0, alpha: 0 };
    let imageLeft = Math.max(0, Math.floor((input.outputWidth - imageWidth) / 2));
    let imageTop = 0;
    let renderedImageHeight = imageHeight;
    const resizedImageBuffer: Buffer =
      input.imageType === 'logo'
        ? await (async () => {
          const trimmedLogo = await sharp(sourceBuffer)
            .trim({ background: transparentBackground })
            .png({ compressionLevel: 1 })
            .toBuffer({ resolveWithObject: true });
          const trimmedLogoWidth = Math.max(1, trimmedLogo.info.width || imageWidth);
          const trimmedLogoHeight = Math.max(1, trimmedLogo.info.height || imageHeight);
          const logoScale = Math.min(imageWidth / trimmedLogoWidth, imageHeight / trimmedLogoHeight);
          const renderedImageWidth = Math.max(1, Math.round(trimmedLogoWidth * logoScale));
          renderedImageHeight = Math.max(1, Math.round(trimmedLogoHeight * logoScale));
          imageLeft = Math.max(0, Math.floor((input.outputWidth - renderedImageWidth) / 2));
          imageTop = Math.max(0, Math.floor((input.outputHeight - renderedImageHeight) / 2));
          return sharp(trimmedLogo.data)
            .resize(renderedImageWidth, renderedImageHeight)
            .png({ compressionLevel: 1 })
            .toBuffer();
        })()
        : await sharp(sourceBuffer)
          .resize(imageWidth, imageHeight, {
            fit: 'cover',
            position: 'center',
            background: transparentBackground,
          })
          .png({ compressionLevel: 1 })
          .toBuffer();
    overlays.push({ input: resizedImageBuffer, top: imageTop, left: imageLeft });

    const iconByProvider = new Map<BadgeKey, string | null>();
    if (input.badges.length > 0) {
      const iconEntries = await Promise.all(
        input.badges.map(async (badge) => {
          const iconDataUri = await getProviderIconDataUri(
            badge.iconUrl,
            badge.iconCornerRadius || 0
          );
          return [badge.key, iconDataUri] as const;
        })
      );
      for (const [providerKey, iconDataUri] of iconEntries) {
        iconByProvider.set(providerKey, iconDataUri);
      }
    }

    const badgeHeight = estimateBadgeHeight(
      input.badgeFontSize,
      input.badgePaddingX,
      input.badgePaddingY,
      input.badgeIconSize,
      'standard'
    );
    const verticalBadgeHeight = estimateBadgeHeight(
      input.badgeFontSize,
      input.badgePaddingX,
      input.badgePaddingY,
      input.badgeIconSize,
      input.verticalBadgeContent
    );
    const posterReferenceBadgeHeight =
      input.imageType === 'poster' ? input.posterReferenceBadgeHeight ?? badgeHeight : badgeHeight;
    const posterReferenceVerticalBadgeHeight =
      input.imageType === 'poster'
        ? input.posterReferenceVerticalBadgeHeight ?? verticalBadgeHeight
        : verticalBadgeHeight;
    const posterReferenceBadgeGap =
      input.imageType === 'poster' ? input.posterReferenceBadgeGap ?? input.badgeGap : input.badgeGap;
    const compactPosterRowText =
      input.imageType === 'poster' &&
      input.posterRatingsLayout !== 'left' &&
      input.posterRatingsLayout !== 'right' &&
      input.posterRatingsLayout !== 'left-right';
    const posterQualityBadgePlacement =
      input.imageType === 'poster'
        ? resolvePosterQualityBadgePlacement(
          input.posterRatingsLayout,
          input.qualityBadgesSide,
          input.posterQualityBadgesPosition
        )
        : null;
    const posterQualityBadgeSidePlacement =
      posterQualityBadgePlacement === 'left' || posterQualityBadgePlacement === 'right'
        ? posterQualityBadgePlacement
        : null;
    const posterRowRegionWidth = Math.max(0, input.outputWidth - input.posterRowHorizontalInset * 2);
    const alignPosterRowWithQuality =
      input.imageType === 'poster' && input.qualityBadges.length > 0 && posterQualityBadgeSidePlacement !== null;
    const posterRowAlign: 'left' | 'center' | 'right' = alignPosterRowWithQuality
      ? posterQualityBadgeSidePlacement === 'right'
        ? 'right'
        : 'left'
      : 'center';
    const posterTitleSpec =
      input.imageType === 'poster' && input.posterTitleText
        ? buildPosterTitleSvg(input.posterTitleText, posterRowRegionWidth)
        : null;
    const thumbnailFallbackTitleSpec =
      input.imageType === 'thumbnail' &&
        (input.thumbnailFallbackEpisodeCode || input.thumbnailFallbackEpisodeText)
        ? buildThumbnailFallbackTitleSvg(
          input.thumbnailFallbackEpisodeCode || '',
          input.thumbnailFallbackEpisodeText || '',
          Math.min(Math.round(input.outputWidth * 0.62), input.outputWidth - 32)
        )
        : null;
    let posterLogoSpec: { buffer: Buffer; width: number; height: number } | null = null;
    if (input.imageType === 'poster' && input.posterLogoUrl) {
      try {
        const logoPayload = await getSourceImagePayload(input.posterLogoUrl);
        const logoBuffer = Buffer.from(logoPayload.body);
        const logoMeta = await sharp(logoBuffer).metadata();
        if (logoMeta.width && logoMeta.height) {
          const maxLogoWidth = Math.min(posterRowRegionWidth, Math.round(input.outputWidth * 0.78));
          const maxLogoHeight = Math.max(48, Math.round(input.outputHeight * 0.16));
          const scale = Math.min(
            1,
            maxLogoWidth / logoMeta.width,
            maxLogoHeight / logoMeta.height
          );
          const logoWidth = Math.max(1, Math.round(logoMeta.width * scale));
          const logoHeight = Math.max(1, Math.round(logoMeta.height * scale));
          const resizedLogoBuffer = await sharp(logoBuffer)
            .resize(logoWidth, logoHeight, { fit: 'fill' })
            .png()
            .toBuffer();
          posterLogoSpec = { buffer: resizedLogoBuffer, width: logoWidth, height: logoHeight };
        }
      } catch {
        posterLogoSpec = null;
      }
    }
    const rankingUsesTopBand =
      input.rankingBadge != null &&
      ((input.rankingPosition || 'auto') === 'top' ||
        ((input.rankingPosition || 'auto') === 'auto' && !posterTitleSpec && !posterLogoSpec));
    const hasTopElements = input.topBadges.length > 0 || rankingUsesTopBand;
    const shouldRenderTopBlur = input.imageType === 'poster' && (posterTitleSpec || posterLogoSpec) && (input.posterConfiguratorPreset !== 'simple' || hasTopElements);
    if (shouldRenderTopBlur) {
      const blurTopBandHeight = Math.max(110, Math.round(input.outputHeight * 0.22));
      const blurTopHeight = Math.min(input.outputHeight, blurTopBandHeight);
      if (blurTopHeight > 0) {
        const blurredTop = await sharp(resizedImageBuffer)
          .extract({ left: 0, top: 0, width: input.outputWidth, height: blurTopHeight })
          .blur(16)
          .composite([
            {
              input: Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${input.outputWidth}" height="${blurTopHeight}" viewBox="0 0 ${input.outputWidth} ${blurTopHeight}">
                  <defs>
                    <linearGradient id="poster-top-darken" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="#000000" stop-opacity="0.62"/>
                      <stop offset="0.55" stop-color="#000000" stop-opacity="0.22"/>
                      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#poster-top-darken)"/>
                </svg>`
              ),
            },
            {
              input: Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${input.outputWidth}" height="${blurTopHeight}" viewBox="0 0 ${input.outputWidth} ${blurTopHeight}">
                  <defs>
                    <linearGradient id="poster-top-blur-mask" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="black" stop-opacity="0.92"/>
                      <stop offset="0.48" stop-color="black" stop-opacity="0.62"/>
                      <stop offset="1" stop-color="black" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#poster-top-blur-mask)"/>
                </svg>`
              ),
              blend: 'dest-in',
            },
          ])
          .png({ compressionLevel: 1 })
          .toBuffer();
        overlays.push({ input: blurredTop, top: 0, left: 0 });
      }
      const blurBandHeight = Math.max(180, Math.round(input.outputHeight * 0.42));
      const blurTop = Math.max(0, input.outputHeight - blurBandHeight);
      const blurHeight = Math.min(input.outputHeight - blurTop, blurBandHeight);
      if (blurHeight > 0) {
        const blurredBottom = await sharp(resizedImageBuffer)
          .extract({ left: 0, top: blurTop, width: input.outputWidth, height: blurHeight })
          .blur(18)
          .composite([
            {
              input: Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${input.outputWidth}" height="${blurHeight}" viewBox="0 0 ${input.outputWidth} ${blurHeight}">
                  <defs>
                    <linearGradient id="poster-bottom-darken" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="#000000" stop-opacity="0"/>
                      <stop offset="0.42" stop-color="#000000" stop-opacity="0.28"/>
                      <stop offset="1" stop-color="#000000" stop-opacity="0.66"/>
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#poster-bottom-darken)"/>
                </svg>`
              ),
            },
            {
              input: Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${input.outputWidth}" height="${blurHeight}" viewBox="0 0 ${input.outputWidth} ${blurHeight}">
                  <defs>
                    <linearGradient id="poster-bottom-blur-mask" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="black" stop-opacity="0"/>
                      <stop offset="0.28" stop-color="black" stop-opacity="0.45"/>
                      <stop offset="0.62" stop-color="black" stop-opacity="0.82"/>
                      <stop offset="1" stop-color="black" stop-opacity="0.96"/>
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#poster-bottom-blur-mask)"/>
                </svg>`
              ),
              blend: 'dest-in',
            },
          ])
          .png({ compressionLevel: 1 })
          .toBuffer();
        overlays.push({ input: blurredBottom, top: blurTop, left: 0 });
      }
    }

    if (input.imageType === 'poster' && input.posterVignetteEnabled !== false) {
      const vignetteSvg = `<svg width="${input.outputWidth}" height="${input.finalOutputHeight}">
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
            <stop offset="0%" stop-color="black" stop-opacity="0" />
            <stop offset="40%" stop-color="black" stop-opacity="0" />
            <stop offset="100%" stop-color="black" stop-opacity="0.85" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#vignette)" />
      </svg>`;
      overlays.push({ input: Buffer.from(vignetteSvg), top: 0, left: 0 });
    }
    type OverlayRect = { left: number; top: number; width: number; height: number };
    const posterBlockingRects: OverlayRect[] = [];
    const addPosterBlockingRect = (left: number, top: number, width: number, height: number) => {
      if (input.imageType !== 'poster' || width <= 0 || height <= 0) return;
      posterBlockingRects.push({
        left: Math.round(left),
        top: Math.round(top),
        width: Math.round(width),
        height: Math.round(height),
      });
    };
    const rectsOverlap = (a: OverlayRect, b: OverlayRect) =>
      a.left < b.left + b.width &&
      a.left + a.width > b.left &&
      a.top < b.top + b.height &&
      a.top + a.height > b.top;
    const composeBadgeRow = (
      rowBadges: RatingBadge[],
      rowY: number,
      options?: {
        maxRowWidth?: number;
        regionLeft?: number;
        regionWidth?: number;
        align?: 'left' | 'center' | 'right';
        splitAcrossHalves?: boolean;
        spreadAcrossThirds?: boolean;
        preserveBadgeSize?: boolean;
        contentLayoutOverride?: 'standard' | 'stacked';
        compactTextOverride?: boolean;
      }
    ) => {
      if (rowBadges.length === 0) return;
      const rowContentLayout = options?.contentLayoutOverride ?? input.verticalBadgeContent;
      const rowCompactText = options?.compactTextOverride ?? compactPosterRowText;
      const rowBadgeHeight = estimateBadgeHeight(
        options?.preserveBadgeSize && input.qualityBadgeFontSize ? input.qualityBadgeFontSize : input.badgeFontSize,
        options?.preserveBadgeSize && input.qualityBadgePaddingX ? input.qualityBadgePaddingX : input.badgePaddingX,
        options?.preserveBadgeSize && input.qualityBadgePaddingY ? input.qualityBadgePaddingY : input.badgePaddingY,
        options?.preserveBadgeSize && input.qualityBadgeIconSize ? input.qualityBadgeIconSize : input.badgeIconSize,
        rowContentLayout
      );
      const rowEntries = rowBadges.map((badge) => {
        const effectiveIconSize = options?.preserveBadgeSize && input.qualityBadgeIconSize ? input.qualityBadgeIconSize : input.badgeIconSize;
        const effectiveGap = options?.preserveBadgeSize && input.qualityBadgeGap ? input.qualityBadgeGap : input.badgeGap;
        const badgeIconSize = badge.key === 'average' ? 0 : effectiveIconSize;
        const badgeGap = badge.key === 'average' ? 0 : effectiveGap;
        const badgeWidth = estimateBadgeWidth(
          badge.value,
          options?.preserveBadgeSize && input.qualityBadgeFontSize ? input.qualityBadgeFontSize : input.badgeFontSize,
          options?.preserveBadgeSize && input.qualityBadgePaddingX ? input.qualityBadgePaddingX : input.badgePaddingX,
          badgeIconSize,
          badgeGap,
          rowCompactText,
          rowContentLayout
        );
        const minBadgeWidth = getMinimumCompressedBadgeWidth(
          badge.value,
          options?.preserveBadgeSize && input.qualityBadgeFontSize ? input.qualityBadgeFontSize : input.badgeFontSize,
          options?.preserveBadgeSize && input.qualityBadgePaddingX ? input.qualityBadgePaddingX : input.badgePaddingX,
          badgeIconSize,
          badgeGap,
          rowCompactText,
          rowContentLayout
        );
        return { badge, badgeWidth, minBadgeWidth };
      });
      const regionLeft = Math.max(0, Math.floor(options?.regionLeft ?? 0));
      const regionWidth = Math.max(0, Math.floor(options?.regionWidth ?? input.outputWidth));
      const regionRight = Math.min(input.outputWidth, regionLeft + regionWidth);
      const effectiveMaxWidth =
        typeof options?.maxRowWidth === 'number'
          ? Math.min(options.maxRowWidth, Math.max(0, regionWidth - 24))
          : Math.max(0, regionWidth - 24);
      let rowGap = input.badgeGap;
      const measureCurrentRowWidth = () =>
        rowEntries.reduce((acc, entry) => acc + entry.badgeWidth, 0) +
        Math.max(0, rowEntries.length - 1) * rowGap;
      let rowWidth = measureCurrentRowWidth();
      if (!options?.preserveBadgeSize && rowWidth > effectiveMaxWidth && rowEntries.length > 1 && rowGap > 0) {
        const shrinkPerGap = Math.min(
          rowGap,
          Math.max(1, Math.ceil((rowWidth - effectiveMaxWidth) / (rowEntries.length - 1)))
        );
        rowGap = Math.max(0, rowGap - shrinkPerGap);
        rowWidth = measureCurrentRowWidth();
      }
      if (!options?.preserveBadgeSize && rowWidth > effectiveMaxWidth) {
        let overflow = rowWidth - effectiveMaxWidth;
        let guard = 0;
        while (overflow > 0 && guard < rowEntries.length * 8) {
          let changed = false;
          for (const entry of rowEntries) {
            if (overflow <= 0) break;
            const shrinkable = Math.max(0, entry.badgeWidth - entry.minBadgeWidth);
            if (shrinkable <= 0) continue;
            const shrink = Math.min(shrinkable, Math.max(1, Math.ceil(overflow / rowEntries.length)));
            entry.badgeWidth -= shrink;
            overflow -= shrink;
            changed = true;
          }
          if (!changed) break;
          rowWidth = measureCurrentRowWidth();
          overflow = Math.max(0, rowWidth - effectiveMaxWidth);
          guard += 1;
        }
        rowWidth = measureCurrentRowWidth();
      }
      const isPosterRowLayout =
        input.imageType === 'poster' &&
        (input.posterRatingsLayout === 'top' ||
          input.posterRatingsLayout === 'bottom' ||
          input.posterRatingsLayout === 'top-bottom');
      const shouldCenterSingle = isPosterRowLayout && rowEntries.length === 1;
      const shouldSplitRow =
        (isPosterRowLayout || options?.splitAcrossHalves === true) && rowEntries.length === 2;
      const shouldSpreadRow =
        (isPosterRowLayout || options?.spreadAcrossThirds === true) && rowEntries.length === 3;
      if (shouldCenterSingle) {
        const centerX =
          regionLeft + Math.floor(regionWidth / 2) - Math.floor(rowEntries[0].badgeWidth / 2);
        const clampedX = Math.max(
          regionLeft,
          Math.min(centerX, Math.max(regionLeft, regionRight - rowEntries[0].badgeWidth))
        );
        const entry = rowEntries[0];
        const monogram = buildProviderMonogram(
          entry.badge.label || String(entry.badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: entry.badgeWidth,
          height: rowBadgeHeight,
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          gap: input.badgeGap,
          accentColor: entry.badge.accentColor,
          monogram: entry.badge.key === 'average' ? '' : monogram,
          iconDataUri: iconByProvider.get(entry.badge.key) || null,
          iconCornerRadius: entry.badge.iconCornerRadius,
          iconScale: entry.badge.iconScale,
          value: entry.badge.value,
          ratingStyle: input.ratingStyle,
          compactText: rowCompactText,
          contentLayout: rowContentLayout,
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: clampedX });
        addPosterBlockingRect(clampedX, rowY, entry.badgeWidth, rowBadgeHeight);
        return;
      }
      if (shouldSplitRow) {
        const edgeInset = 12;
        const leftHalfWidth = Math.floor(regionWidth / 2);
        const rightHalfWidth = Math.max(0, regionWidth - leftHalfWidth);
        const leftMin = regionLeft + edgeInset;
        const leftMax = regionLeft + leftHalfWidth - edgeInset - rowEntries[0].badgeWidth;
        const rightMin = regionLeft + leftHalfWidth + edgeInset;
        const rightMax = regionRight - edgeInset - rowEntries[1].badgeWidth;
        if (leftMin <= leftMax && rightMin <= rightMax) {
          const leftCenterX =
            regionLeft + Math.floor(leftHalfWidth / 2) - Math.floor(rowEntries[0].badgeWidth / 2);
          const rightCenterX =
            regionLeft +
            leftHalfWidth +
            Math.floor(rightHalfWidth / 2) -
            Math.floor(rowEntries[1].badgeWidth / 2);
          const leftX = Math.max(leftMin, Math.min(leftCenterX, leftMax));
          const rightX = Math.max(rightMin, Math.min(rightCenterX, rightMax));
          const overlaps = leftX + rowEntries[0].badgeWidth + rowGap > rightX;
          if (!overlaps) {
            const positions = [leftX, rightX];
            for (let index = 0; index < rowEntries.length; index += 1) {
              const entry = rowEntries[index];
              const monogram = buildProviderMonogram(
                entry.badge.label || String(entry.badge.key).toUpperCase()
              );
              const badgeSvg = buildBadgeSvg({
                width: entry.badgeWidth,
                height: rowBadgeHeight,
                iconSize: options?.preserveBadgeSize && input.qualityBadgeIconSize ? input.qualityBadgeIconSize : input.badgeIconSize,
                fontSize: options?.preserveBadgeSize && input.qualityBadgeFontSize ? input.qualityBadgeFontSize : input.badgeFontSize,
                paddingX: options?.preserveBadgeSize && input.qualityBadgePaddingX ? input.qualityBadgePaddingX : input.badgePaddingX,
                gap: options?.preserveBadgeSize && input.qualityBadgeGap ? input.qualityBadgeGap : input.badgeGap,
                accentColor: entry.badge.accentColor,
                monogram: entry.badge.key === 'average' ? '' : monogram,
                iconDataUri: iconByProvider.get(entry.badge.key) || null,
                iconCornerRadius: entry.badge.iconCornerRadius,
                iconScale: entry.badge.iconScale,
                value: entry.badge.value,
                ratingStyle: input.ratingStyle,
                compactText: rowCompactText,
                contentLayout: rowContentLayout,
              });
              overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: positions[index] });
              addPosterBlockingRect(positions[index], rowY, entry.badgeWidth, rowBadgeHeight);
            }
            return;
          }
        }
      }
      if (shouldSpreadRow) {
        const edgeInset = 12;
        const leftX = regionLeft + edgeInset;
        const centerX = regionLeft + Math.floor(regionWidth / 2) - Math.floor(rowEntries[1].badgeWidth / 2);
        const rightX = Math.max(regionLeft, regionRight - rowEntries[2].badgeWidth - edgeInset);
        const overlaps =
          leftX + rowEntries[0].badgeWidth + rowGap > centerX ||
          centerX + rowEntries[1].badgeWidth + rowGap > rightX;
        if (!overlaps) {
          const positions = [leftX, centerX, rightX];
          for (let index = 0; index < rowEntries.length; index += 1) {
            const entry = rowEntries[index];
            const monogram = buildProviderMonogram(
              entry.badge.label || String(entry.badge.key).toUpperCase()
            );
            const badgeSvg = buildBadgeSvg({
              width: entry.badgeWidth,
              height: rowBadgeHeight,
              iconSize: input.badgeIconSize,
              fontSize: input.badgeFontSize,
              paddingX: input.badgePaddingX,
              gap: input.badgeGap,
              accentColor: entry.badge.accentColor,
              monogram: entry.badge.key === 'average' ? '' : monogram,
              iconDataUri: iconByProvider.get(entry.badge.key) || null,
              iconCornerRadius: entry.badge.iconCornerRadius,
              iconScale: entry.badge.iconScale,
              value: entry.badge.value,
              ratingStyle: input.ratingStyle,
              compactText: rowCompactText,
              contentLayout: rowContentLayout,
            });
            overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: positions[index] });
            addPosterBlockingRect(positions[index], rowY, entry.badgeWidth, rowBadgeHeight);
          }
          return;
        }
      }
      const align = options?.align || 'center';
      const preferredEdgeInset = 12;
      const dynamicEdgeInset =
        rowWidth > effectiveMaxWidth
          ? Math.max(0, Math.min(preferredEdgeInset, Math.floor((regionWidth - rowWidth) / 2)))
          : preferredEdgeInset;
      const minRowX = regionLeft + dynamicEdgeInset;
      const maxRowX = Math.max(regionLeft, regionRight - rowWidth - dynamicEdgeInset);
      let rowX =
        align === 'left'
          ? minRowX
          : align === 'right'
            ? maxRowX
            : regionLeft + Math.floor((regionWidth - rowWidth) / 2);
      if (rowWidth > effectiveMaxWidth) {
        rowX =
          align === 'right'
            ? Math.max(regionLeft, regionRight - rowWidth)
            : align === 'left'
              ? regionLeft
              : regionLeft + Math.floor((regionWidth - rowWidth) / 2);
      }
      rowX = Math.max(regionLeft, Math.min(rowX, Math.max(regionLeft, regionRight - rowWidth)));

      for (const entry of rowEntries) {
        const monogram = buildProviderMonogram(
          entry.badge.label || String(entry.badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: entry.badgeWidth,
          height: rowBadgeHeight,
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          gap: input.badgeGap,
          accentColor: entry.badge.accentColor,
          monogram: entry.badge.key === 'average' ? '' : monogram,
          iconDataUri: iconByProvider.get(entry.badge.key) || null,
          iconCornerRadius: entry.badge.iconCornerRadius,
          iconScale: entry.badge.iconScale,
          value: entry.badge.value,
          ratingStyle: input.ratingStyle,
          compactText: rowCompactText,
          contentLayout: rowContentLayout,
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: rowX });
        addPosterBlockingRect(rowX, rowY, entry.badgeWidth, rowBadgeHeight);
        rowX += entry.badgeWidth + rowGap;
      }
    };
    let lastOverlayTopY = 0;
    let lastOverlayBottomY = 0;
    let lastOverlayAnchorY = 0;
    let lastPosterQualityTopY = 0;
    let lastPosterQualityBottomY = 0;
    const composePosterCleanOverlayAboveBottom = (bottomRowY: number) => {
      if (input.imageType !== 'poster') return;
      const overlay = posterLogoSpec
        ? {
          buffer: posterLogoSpec.buffer,
          width: posterLogoSpec.width,
          height: posterLogoSpec.height,
        }
        : posterTitleSpec
          ? {
            buffer: Buffer.from(posterTitleSpec.svg),
            width: posterTitleSpec.width,
            height: posterTitleSpec.height,
          }
          : null;
      if (!overlay) return;
      const baseOverlayGap = Math.max(24, Math.round(posterReferenceBadgeGap * 2.2));
      const overlayGap = input.posterConfiguratorPreset === 'advanced' ? baseOverlayGap + 12 : baseOverlayGap;
      const stableBottomAnchorY = Math.max(
        input.badgeTopOffset,
        input.outputHeight - input.badgeBottomOffset - posterReferenceBadgeHeight
      );
      const overlayAnchorY = input.bottomBadges.length > 0 ? bottomRowY : stableBottomAnchorY;
      let overlayY = Math.round(overlayAnchorY - overlayGap - overlay.height);
      const topRowBottom =
        input.topBadges.length > 0
          ? input.badgeTopOffset + Math.max(badgeHeight, posterReferenceBadgeHeight) + posterReferenceBadgeGap
          : input.badgeTopOffset;
      if (overlayY < topRowBottom) {
        overlayY = topRowBottom;
      }
      if (overlayY + overlay.height + overlayGap > overlayAnchorY) {
        return;
      }
      const overlayX = Math.max(
        input.posterRowHorizontalInset,
        Math.round((input.outputWidth - overlay.width) / 2)
      );
      overlays.push({ input: overlay.buffer, top: overlayY, left: overlayX });
      addPosterBlockingRect(overlayX, overlayY, overlay.width, overlay.height);
      lastOverlayTopY = overlayY;
      lastOverlayBottomY = overlayY + overlay.height;
      lastOverlayAnchorY = overlayAnchorY;
    };
    const composeThumbnailFallbackOverlay = () => {
      if (input.imageType !== 'thumbnail' || !thumbnailFallbackTitleSpec) return;
      const bottomInset = Math.max(16, input.badgeBottomOffset);
      const leftInset = 16;
      const overlayX = Math.max(
        leftInset,
        Math.min(leftInset, Math.max(leftInset, input.outputWidth - thumbnailFallbackTitleSpec.width - leftInset))
      );
      const overlayY = Math.max(
        16,
        input.outputHeight - thumbnailFallbackTitleSpec.height - bottomInset
      );
      overlays.push({
        input: Buffer.from(thumbnailFallbackTitleSpec.svg),
        top: overlayY,
        left: overlayX,
      });
    };
    const composePosterBadgeAt = (
      badge: RatingBadge,
      left: number,
      top: number,
      maxBadgeWidth: number,
      contentLayout: 'standard' | 'stacked' = input.verticalBadgeContent
    ) => {
      const isAverage = badge.key === 'average';
      const effectiveIconSize = isAverage || input.qualityBadgeIconSize ? (input.qualityBadgeIconSize || 46) : input.badgeIconSize;
      const effectiveFontSize = isAverage && input.qualityBadgeFontSize ? input.qualityBadgeFontSize : input.badgeFontSize;
      const effectivePaddingX = isAverage && input.qualityBadgePaddingX ? input.qualityBadgePaddingX : input.badgePaddingX;
      const effectivePaddingY = isAverage && input.qualityBadgePaddingY ? input.qualityBadgePaddingY : input.badgePaddingY;
      const effectiveGap = isAverage && input.qualityBadgeGap ? input.qualityBadgeGap : input.badgeGap;

      const badgeHeightForLayout = estimateBadgeHeight(
        effectiveFontSize,
        effectivePaddingX,
        effectivePaddingY,
        effectiveIconSize,
        contentLayout
      );
      const estimatedWidth = estimateBadgeWidth(
        badge.value,
        effectiveFontSize,
        effectivePaddingX,
        effectiveIconSize,
        effectiveGap,
        false,
        contentLayout
      );
      const badgeWidth = Math.min(estimatedWidth, maxBadgeWidth);
      const monogram = buildProviderMonogram(
        badge.label || String(badge.key).toUpperCase()
      );
      const badgeSvg = buildBadgeSvg({
        width: badgeWidth,
        height: badgeHeightForLayout,
        iconSize: effectiveIconSize,
        fontSize: effectiveFontSize,
        paddingX: effectivePaddingX,
        gap: effectiveGap,
        accentColor: badge.accentColor,
        monogram: badge.key === 'average' ? '' : monogram,
        iconDataUri: iconByProvider.get(badge.key) || null,
        iconCornerRadius: badge.iconCornerRadius,
        iconScale: badge.iconScale,
        value: badge.value,
        ratingStyle: input.ratingStyle,
        contentLayout,
      });
      overlays.push({ input: Buffer.from(badgeSvg), top, left });
      addPosterBlockingRect(left, top, badgeWidth, badgeHeightForLayout);
      return { width: badgeWidth, height: badgeHeightForLayout };
    };
    const composePosterCenteredTopBadge = (
      badge: RatingBadge,
      sizeMode: 'default' | 'top' = 'default'
    ) => {
      if (sizeMode === 'top') {
        const topIconSize = 46;
        const topFontSize = 35;
        const topPaddingX = 13;
        const topPaddingY = 8;
        const topGap = 9;
        const topBadgeHeight = estimateBadgeHeight(
          topFontSize,
          topPaddingX,
          topPaddingY,
          topIconSize,
          'standard'
        );
        const estimatedWidth = estimateBadgeWidth(
          badge.value,
          topFontSize,
          topPaddingX,
          topIconSize,
          topGap,
          true,
          'standard'
        );
        const badgeWidth = Math.min(estimatedWidth, Math.max(0, posterRowRegionWidth - 24));
        const rowX = Math.max(
          input.posterRowHorizontalInset,
          input.posterRowHorizontalInset + Math.floor((posterRowRegionWidth - badgeWidth) / 2)
        );
        const monogram = buildProviderMonogram(
          badge.label || String(badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: badgeWidth,
          height: topBadgeHeight,
          iconSize: topIconSize,
          fontSize: topFontSize,
          paddingX: topPaddingX,
          gap: topGap,
          accentColor: badge.accentColor,
          monogram: badge.key === 'average' ? '' : monogram,
          iconDataUri: iconByProvider.get(badge.key) || null,
          iconCornerRadius: badge.iconCornerRadius,
          iconScale: badge.iconScale,
          value: badge.value,
          ratingStyle: input.ratingStyle,
          compactText: true,
          contentLayout: 'standard',
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: input.badgeTopOffset, left: rowX });
        addPosterBlockingRect(rowX, input.badgeTopOffset, badgeWidth, topBadgeHeight);
        return;
      }

      composeBadgeRow([badge], input.badgeTopOffset, {
        regionLeft: input.posterRowHorizontalInset,
        regionWidth: posterRowRegionWidth,
        align: 'center',
        preserveBadgeSize: true,
        contentLayoutOverride: 'standard',
        compactTextOverride: true,
      });
    };
    const composeEdgeAlignedPosterBadge = (
      badge: RatingBadge,
      rowY: number,
      side: 'left' | 'right',
      maxBadgeWidth: number
    ) => {
      const isAverage = badge.key === 'average';
      const effectiveIconSize = isAverage || input.qualityBadgeIconSize ? (input.qualityBadgeIconSize || 46) : input.badgeIconSize;
      const effectiveFontSize = isAverage && input.qualityBadgeFontSize ? input.qualityBadgeFontSize : input.badgeFontSize;
      const effectivePaddingX = isAverage && input.qualityBadgePaddingX ? input.qualityBadgePaddingX : input.badgePaddingX;
      const effectiveGap = isAverage && input.qualityBadgeGap ? input.qualityBadgeGap : input.badgeGap;

      const estimatedWidth = estimateBadgeWidth(
        badge.value,
        effectiveFontSize,
        effectivePaddingX,
        effectiveIconSize,
        effectiveGap,
        false,
        input.verticalBadgeContent
      );
      const badgeWidth = Math.min(estimatedWidth, maxBadgeWidth);
      const rowX =
        side === 'left'
          ? 12
          : Math.max(12, input.outputWidth - badgeWidth - 12);
      composePosterBadgeAt(badge, rowX, rowY, maxBadgeWidth, input.verticalBadgeContent);
    };
    const composeBadgeColumn = (
      columnBadges: RatingBadge[],
      side: 'left' | 'right',
      maxBadgeWidth: number,
      origin: 'top' | 'bottom' = 'top',
      startY?: number
    ) => {
      if (columnBadges.length === 0) return;
      let rowY =
        typeof startY === 'number'
          ? Math.max(input.badgeTopOffset, startY)
          : origin === 'bottom'
            ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - verticalBadgeHeight)
            : input.badgeTopOffset;
      for (let index = 0; index < columnBadges.length; index += 1) {
        const badge = columnBadges[index];
        composeEdgeAlignedPosterBadge(badge, rowY, side, maxBadgeWidth);
        rowY += origin === 'bottom' ? -(verticalBadgeHeight + input.badgeGap) : verticalBadgeHeight + input.badgeGap;
      }
    };
    const composeBackdropBadgeColumn = (
      columnBadges: RatingBadge[],
      placement: BackdropBadgePlacement,
      maxBadgeWidth: number,
      startY?: number
    ) => {
      if (columnBadges.length === 0) return;
      const columnHeight =
        columnBadges.length * verticalBadgeHeight + Math.max(0, columnBadges.length - 1) * input.badgeGap;
      let rowY =
        typeof startY === 'number'
          ? Math.max(input.badgeTopOffset, startY)
          : placement.vertical === 'bottom'
            ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - columnHeight)
            : placement.vertical === 'center'
              ? Math.max(
                input.badgeTopOffset,
                Math.round((input.outputHeight - columnHeight) / 2)
              )
              : input.badgeTopOffset;
      const regionLeft = placement.left;
      const regionRight = placement.left + placement.width;
      for (const badge of columnBadges) {
        const estimatedWidth = estimateBadgeWidth(
          badge.value,
          input.badgeFontSize,
          input.badgePaddingX,
          input.badgeIconSize,
          input.badgeGap,
          false,
          input.verticalBadgeContent
        );
        const badgeWidth = Math.min(estimatedWidth, maxBadgeWidth);
        const rowX =
          placement.align === 'left'
            ? regionLeft
            : placement.align === 'right'
              ? Math.max(regionLeft, regionRight - badgeWidth)
              : Math.max(regionLeft, Math.round(regionLeft + (placement.width - badgeWidth) / 2));
        const monogram = buildProviderMonogram(
          badge.label || String(badge.key).toUpperCase()
        );
        const badgeSvg = buildBadgeSvg({
          width: badgeWidth,
          height: verticalBadgeHeight,
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          gap: input.badgeGap,
          accentColor: badge.accentColor,
          monogram: badge.key === 'average' ? '' : monogram,
          iconDataUri: iconByProvider.get(badge.key) || null,
          iconCornerRadius: badge.iconCornerRadius,
          iconScale: badge.iconScale,
          value: badge.value,
          ratingStyle: input.ratingStyle,
          contentLayout: input.verticalBadgeContent,
        });
        overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: rowX });
        rowY += verticalBadgeHeight + input.badgeGap;
      }
    };
    const composeBackdropBadgeColumns = (
      columns: RatingBadge[][],
      placement: BackdropBadgePlacement
    ) => {
      const usableColumns = columns.filter((column) => column.length > 0);
      if (usableColumns.length === 0) return false;
      const estimatedColumns = usableColumns.map((columnBadges) => {
        const widths = columnBadges.map((badge) =>
          estimateBadgeWidth(
            badge.value,
            input.badgeFontSize,
            input.badgePaddingX,
            input.badgeIconSize,
            input.badgeGap,
            false,
            input.verticalBadgeContent
          )
        );
        return {
          badges: columnBadges,
          badgeWidths: widths,
          maxWidth: Math.max(0, ...widths),
          height:
            columnBadges.length * verticalBadgeHeight +
            Math.max(0, columnBadges.length - 1) * input.badgeGap,
        };
      });
      const columnGap = Math.max(12, input.badgeGap);
      const totalWidth =
        estimatedColumns.reduce((sum, column) => sum + column.maxWidth, 0) +
        Math.max(0, estimatedColumns.length - 1) * columnGap;
      const regionLeft = placement.left;
      const regionRight = placement.left + placement.width;
      if (totalWidth > placement.width) return false;

      const startX =
        placement.align === 'right'
          ? regionRight - totalWidth
          : placement.align === 'center'
            ? regionLeft + Math.floor((placement.width - totalWidth) / 2)
            : regionLeft;
      if (startX < regionLeft || startX + totalWidth > regionRight) return false;

      const tallestHeight = estimatedColumns.reduce(
        (maxHeight, column) => Math.max(maxHeight, column.height),
        0
      );
      const startY =
        placement.vertical === 'bottom'
          ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - tallestHeight)
          : placement.vertical === 'center'
            ? Math.max(input.badgeTopOffset, Math.round((input.outputHeight - tallestHeight) / 2))
            : input.badgeTopOffset;

      let columnX = startX;
      for (const column of estimatedColumns) {
        let rowY = startY;
        for (let index = 0; index < column.badges.length; index += 1) {
          const badge = column.badges[index];
          const badgeWidth = column.badgeWidths[index];
          const rowX = columnX + Math.floor((column.maxWidth - badgeWidth) / 2);
          const monogram = buildProviderMonogram(
            badge.label || String(badge.key).toUpperCase()
          );
          const badgeSvg = buildBadgeSvg({
            width: badgeWidth,
            height: verticalBadgeHeight,
            iconSize: input.badgeIconSize,
            fontSize: input.badgeFontSize,
            paddingX: input.badgePaddingX,
            gap: input.badgeGap,
            accentColor: badge.accentColor,
            monogram: badge.key === 'average' ? '' : monogram,
            iconDataUri: iconByProvider.get(badge.key) || null,
            iconCornerRadius: badge.iconCornerRadius,
            iconScale: badge.iconScale,
            value: badge.value,
            ratingStyle: input.ratingStyle,
            contentLayout: input.verticalBadgeContent,
          });
          overlays.push({ input: Buffer.from(badgeSvg), top: rowY, left: rowX });
          rowY += verticalBadgeHeight + input.badgeGap;
        }
        columnX += column.maxWidth + columnGap;
      }

      return true;
    };
    const composeQualityBadgeColumn = (
      columnBadges: RatingBadge[],
      startY: number,
      side: QualityBadgesSide
    ) => {
      if (columnBadges.length === 0) return;
      const qualityBaseHeight =
        input.imageType === 'poster' ? posterReferenceBadgeHeight : badgeHeight;
      const qualityGap = input.imageType === 'poster' ? posterReferenceBadgeGap : input.badgeGap;
      const qualityHeight = Math.max(44, Math.round(qualityBaseHeight * 1.25));
      const uniformBadgeWidth = Math.min(
        Math.max(72, Math.round(qualityHeight * 1.75)),
        Math.max(72, input.outputWidth - 24)
      );
      let rowY = Math.max(input.badgeTopOffset, startY);
      for (let index = 0; index < columnBadges.length; index += 1) {
        const badge = columnBadges[index];
        if (!STREAM_BADGE_META.has(badge.key as StreamBadgeKey)) continue;
        const spec = buildQualityBadgeSvg(
          badge.key as StreamBadgeKey,
          qualityHeight,
          uniformBadgeWidth,
          input.qualityBadgesStyle
        );
        if (!spec) continue;
        const badgeWidth = Math.min(spec.width, uniformBadgeWidth);
        const badgeHeightForRow = spec.height;
        const rowX =
          side === 'right'
            ? Math.max(12, input.outputWidth - badgeWidth - 12)
            : 12;
        overlays.push({ input: Buffer.from(spec.svg), top: rowY, left: rowX });
        addPosterBlockingRect(rowX, rowY, badgeWidth, badgeHeightForRow);
        rowY += badgeHeightForRow + qualityGap;
      }
    };
    const composeQualityBadgeRow = (
      rowBadges: RatingBadge[],
      rowY: number,
      baseHeight?: number
    ): number => {
      if (rowBadges.length === 0) return 0;
      const maxRowWidth = Math.max(0, input.outputWidth - 24);
      const qualityBaseHeight =
        input.imageType === 'poster' ? posterReferenceBadgeHeight : badgeHeight;
      const qualityBaseGap = input.imageType === 'poster' ? (input.qualityBadgeGap ?? posterReferenceBadgeGap) : input.badgeGap;
      let qualityHeight = Math.max(36, Math.round(baseHeight ?? qualityBaseHeight * 1.05));
      let badgeWidth = Math.min(
        Math.max(64, Math.round(qualityHeight * 1.75)),
        Math.max(64, input.outputWidth - 24)
      );
      let rowGap = qualityBaseGap;
      let rowWidth = rowBadges.length * badgeWidth + Math.max(0, rowBadges.length - 1) * rowGap;
      if (rowWidth > maxRowWidth && rowBadges.length > 1) {
        const ratio = Math.max(0.45, maxRowWidth / rowWidth);
        const heightRatio = Math.max(0.75, Math.min(1, ratio));
        qualityHeight = Math.max(32, Math.floor(qualityHeight * heightRatio));
        badgeWidth = Math.min(
          Math.max(60, Math.floor(badgeWidth * ratio)),
          Math.max(60, input.outputWidth - 24)
        );
        rowWidth = rowBadges.length * badgeWidth + Math.max(0, rowBadges.length - 1) * rowGap;
        if (rowWidth > maxRowWidth) {
          const availableForGaps = Math.max(0, maxRowWidth - rowBadges.length * badgeWidth);
          rowGap = Math.max(0, Math.floor(availableForGaps / (rowBadges.length - 1)));
          rowWidth = rowBadges.length * badgeWidth + Math.max(0, rowBadges.length - 1) * rowGap;
        }
      }
      let rowX = Math.floor((input.outputWidth - rowWidth) / 2);
      rowX = Math.max(12, Math.min(rowX, Math.max(12, input.outputWidth - rowWidth - 12)));
      for (const badge of rowBadges) {
        if (!STREAM_BADGE_META.has(badge.key as StreamBadgeKey)) continue;
        const spec = buildQualityBadgeSvg(
          badge.key as StreamBadgeKey,
          qualityHeight,
          badgeWidth,
          input.qualityBadgesStyle
        );
        if (!spec) continue;
        overlays.push({ input: Buffer.from(spec.svg), top: rowY, left: rowX });
        addPosterBlockingRect(rowX, rowY, badgeWidth, spec.height);
        rowX += badgeWidth + rowGap;
      }
      return qualityHeight;
    };
    const renderQualityBadgeColumnAt = (
      columnBadges: RatingBadge[],
      startY: number,
      x: number,
      qualityHeight: number,
      uniformBadgeWidth: number
    ) => {
      if (columnBadges.length === 0) return;
      let rowY = Math.max(input.badgeTopOffset, startY);
      const clampedX = Math.max(
        12,
        Math.min(Math.round(x), Math.max(12, input.outputWidth - uniformBadgeWidth - 12))
      );
      for (let index = 0; index < columnBadges.length; index += 1) {
        const badge = columnBadges[index];
        if (!STREAM_BADGE_META.has(badge.key as StreamBadgeKey)) continue;
        const spec = buildQualityBadgeSvg(
          badge.key as StreamBadgeKey,
          qualityHeight,
          uniformBadgeWidth,
          input.qualityBadgesStyle
        );
        if (!spec) continue;
        overlays.push({ input: Buffer.from(spec.svg), top: rowY, left: clampedX });
        addPosterBlockingRect(clampedX, rowY, uniformBadgeWidth, spec.height);
        rowY += spec.height + input.badgeGap;
      }
    };

    if (input.imageType === 'poster' && input.qualityBadges.length > 0) {
      let qualityPlacement = resolvePosterQualityBadgePlacement(
        input.posterRatingsLayout,
        input.qualityBadgesSide,
        input.posterQualityBadgesPosition
      );

      if (qualityPlacement === 'bottom') {
        const hasBottomRatings = input.bottomBadges.length > 0;
        const hasTopRatings = input.topBadges.length > 0;
        const isAuto = input.posterQualityBadgesPosition === 'auto';
        if (hasBottomRatings && !hasTopRatings && isAuto) {
          qualityPlacement = 'top';
        }
      }

      if (qualityPlacement === 'top') {
        const topQualityHeight = Math.max(36, Math.round(posterReferenceBadgeHeight * 1.05));
        const actualHeight = composeQualityBadgeRow(input.qualityBadges, input.badgeTopOffset, topQualityHeight);
        const rankingGap = Math.max(3, Math.round(input.badgeGap * 0.35));
        input.badgeTopOffset += actualHeight + rankingGap;
        input.qualityBadges = [];
      }
    }


    if (input.imageType === 'logo') {
      let rowY = imageTop + renderedImageHeight + input.logoBadgeTopGap;
      if (input.qualityBadges.length > 0) {
        composeQualityBadgeRow(input.qualityBadges, rowY, badgeHeight);
        rowY += Math.max(36, Math.round(badgeHeight * 1.05)) + input.badgeGap;
      }

      if (input.badges.length > 0 && input.logoBadgeBandHeight > 0 && input.logoBadgesPerRow > 0) {
        const rows = chunkBy(input.badges, input.logoBadgesPerRow);

        for (const row of rows) {
          composeBadgeRow(row, rowY, {
            maxRowWidth: input.logoBadgeMaxWidth,
          });
          rowY += badgeHeight + input.badgeGap;
        }
      }
    } else if (
      input.badges.length > 0 ||
      (input.imageType === 'poster' && (posterTitleSpec || posterLogoSpec))
    ) {
      if (input.imageType === 'backdrop' || input.imageType === 'thumbnail') {
        const backdropPlacement = getBackdropBadgePlacement(
          input.outputWidth,
          input.backdropRatingsLayout,
          input.imageType
        );
        if (backdropPlacement.stack === 'column') {
          const maxBadgeWidth = Math.max(180, Math.floor(backdropPlacement.width - 24));
          const backdropColumns =
            input.backdropColumns && input.backdropColumns.length > 0
              ? input.backdropColumns.filter((column) => column.length > 0)
              : [];
          const hasMultipleColumns = backdropColumns.length > 1;
          if (
            hasMultipleColumns &&
            !composeBackdropBadgeColumns(backdropColumns, backdropPlacement)
          ) {
            const fallbackColumnBadges =
              backdropColumns[0]?.length
                ? backdropColumns[0]
                : input.rightBadges.length > 0
                  ? input.rightBadges
                  : input.leftBadges.length > 0
                    ? input.leftBadges
                    : input.badges;
            composeBackdropBadgeColumn(fallbackColumnBadges, backdropPlacement, maxBadgeWidth);
          } else if (!hasMultipleColumns) {
            const columnBadges =
              backdropColumns[0]?.length
                ? backdropColumns[0]
                : input.rightBadges.length > 0
                  ? input.rightBadges
                  : input.leftBadges.length > 0
                    ? input.leftBadges
                    : input.badges;
            composeBackdropBadgeColumn(columnBadges, backdropPlacement, maxBadgeWidth);
          }
        } else {
          const backdropRows =
            input.backdropRows && input.backdropRows.length > 0
              ? input.backdropRows
              : [input.topBadges, input.bottomBadges].filter((row) => row.length > 0);
          const totalRowsHeight =
            backdropRows.length * badgeHeight + Math.max(0, backdropRows.length - 1) * input.badgeGap;
          let rowY =
            backdropPlacement.vertical === 'top'
              ? input.badgeTopOffset
              : backdropPlacement.vertical === 'bottom'
                ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - totalRowsHeight)
                : Math.max(input.badgeTopOffset, Math.round((input.outputHeight - totalRowsHeight) / 2));
          for (const row of backdropRows) {
            composeBadgeRow(row, rowY, {
              regionLeft: backdropPlacement.left,
              regionWidth: backdropPlacement.width,
              align: backdropPlacement.align,
            });
            rowY += badgeHeight + input.badgeGap;
          }
        }
        composeThumbnailFallbackOverlay();
      } else if (input.imageType === 'poster') {
        const bottomRowY = Math.max(
          input.badgeTopOffset,
          input.outputHeight - input.badgeBottomOffset - badgeHeight
        );
        if (input.posterRatingsLayout === 'left' || input.posterRatingsLayout === 'right') {
          const maxBadgeWidth = Math.max(180, Math.floor(input.outputWidth * 0.46));
          composeBadgeColumn(
            input.posterRatingsLayout === 'left' ? input.leftBadges : input.rightBadges,
            input.posterRatingsLayout,
            maxBadgeWidth
          );
        } else if (input.posterRatingsLayout === 'left-right') {
          const maxBadgeWidth = Math.max(180, Math.floor(input.outputWidth * 0.46));
          const remainingLeftBadges = input.leftBadges;
          const remainingRightBadges = input.rightBadges;

          if (input.topBadges.length > 0) {
            for (const badge of input.topBadges) {
              composePosterCenteredTopBadge(badge, 'top');
            }
          }

          const sideStartY =
            input.topBadges.length > 0
              ? input.badgeTopOffset + Math.max(badgeHeight, posterReferenceBadgeHeight) + input.badgeGap
              : input.badgeTopOffset;
          if (remainingLeftBadges.length === remainingRightBadges.length) {
            for (let index = 0; index < remainingLeftBadges.length; index += 1) {
              const rowY = sideStartY + index * (verticalBadgeHeight + input.badgeGap);
              composeEdgeAlignedPosterBadge(remainingLeftBadges[index], rowY, 'left', maxBadgeWidth);
              composeEdgeAlignedPosterBadge(remainingRightBadges[index], rowY, 'right', maxBadgeWidth);
            }
          } else {
            composeBadgeColumn(remainingLeftBadges, 'left', maxBadgeWidth, 'top', sideStartY);
            composeBadgeColumn(remainingRightBadges, 'right', maxBadgeWidth, 'top', sideStartY);
          }
        } else {
          if (input.topBadges.length > 0) {
            composeBadgeRow(input.topBadges, input.badgeTopOffset, {
              regionLeft: input.posterRowHorizontalInset,
              regionWidth: posterRowRegionWidth,
              align: posterRowAlign,
            });
          }
          if (input.bottomBadges.length > 0) {
            composeBadgeRow(input.bottomBadges, bottomRowY, {
              regionLeft: input.posterRowHorizontalInset,
              regionWidth: posterRowRegionWidth,
              align: posterRowAlign,
              preserveBadgeSize: true,
              contentLayoutOverride: 'standard',
            });
          }
        }
        composePosterCleanOverlayAboveBottom(bottomRowY);
      }
    }

    if (input.imageType === 'poster' && input.qualityBadges.length > 0) {
      const qualityPlacement = resolvePosterQualityBadgePlacement(
        input.posterRatingsLayout,
        input.qualityBadgesSide,
        input.posterQualityBadgesPosition
      );
      const metrics: BadgeLayoutMetrics = {
        iconSize: input.badgeIconSize,
        fontSize: input.badgeFontSize,
        paddingX: input.badgePaddingX,
        paddingY: input.badgePaddingY,
        gap: input.badgeGap,
      };
      const qualityBadgeHeight = Math.max(44, Math.round(posterReferenceBadgeHeight * 1.25));
      if (qualityPlacement === 'bottom') {
        const bottomQualityHeight = Math.max(36, Math.round(posterReferenceBadgeHeight * 1.05));
        const hasBottomRatings = input.bottomBadges.length > 0;
        const hasOverlay = Boolean(posterTitleSpec || posterLogoSpec);
        let bottomY = Math.max(
          input.badgeTopOffset,
          input.outputHeight - input.badgeBottomOffset - bottomQualityHeight
        );
        let currentQualityHeight = bottomQualityHeight;
        if (hasBottomRatings || hasOverlay) {
          const bottomRowY = Math.max(
            input.badgeTopOffset,
            input.outputHeight - input.badgeBottomOffset - badgeHeight
          );
          let anchorY = bottomRowY;
          if (hasOverlay) {
            const stableBottomAnchorY = Math.max(
              input.badgeTopOffset,
              input.outputHeight - input.badgeBottomOffset - posterReferenceBadgeHeight
            );
            anchorY = input.bottomBadges.length > 0 ? bottomRowY : stableBottomAnchorY;
          }

          let underLogoPlaced = false;
          if (hasOverlay && lastOverlayBottomY > 0) {
            const bottomLimit = input.outputHeight;
            const effectiveAnchorY = hasBottomRatings ? lastOverlayAnchorY : bottomLimit;
            const spaceBelowLogo = effectiveAnchorY - lastOverlayBottomY;
            if (spaceBelowLogo >= 40) {
              currentQualityHeight = Math.max(32, Math.min(bottomQualityHeight, spaceBelowLogo));
              const freeSpace = Math.max(0, spaceBelowLogo - currentQualityHeight);
              bottomY = Math.round(lastOverlayBottomY + freeSpace * 0.65);
              underLogoPlaced = true;
            }
          }

          if (!underLogoPlaced) {
            const topAnchorY = (hasOverlay && lastOverlayTopY > 0) ? lastOverlayTopY : anchorY;
            bottomY = Math.max(input.badgeTopOffset, topAnchorY - bottomQualityHeight - Math.max(input.badgeGap, 18));
          }
        }
        const actualQualityHeight = composeQualityBadgeRow(input.qualityBadges, bottomY, currentQualityHeight);
        lastPosterQualityTopY = bottomY;
        lastPosterQualityBottomY = bottomY + actualQualityHeight;
      } else {
        const qualityTotalHeight =
          input.qualityBadges.length * qualityBadgeHeight +
          Math.max(0, input.qualityBadges.length - 1) * input.badgeGap;
        const centeredStartY = Math.max(
          input.badgeTopOffset,
          Math.round((input.outputHeight - qualityTotalHeight) / 2)
        );
        let qualityStartY = centeredStartY;
        const shouldTopAlignQuality =
          (input.posterRatingsLayout === 'left' || input.posterRatingsLayout === 'right') &&
          (qualityPlacement === 'left' || qualityPlacement === 'right');
        if (shouldTopAlignQuality) {
          qualityStartY = input.badgeTopOffset;
        } else if (input.topBadges.length > 0) {
          const belowTop =
            input.badgeTopOffset +
            Math.max(verticalBadgeHeight, posterReferenceVerticalBadgeHeight) +
            Math.max(input.badgeGap, posterReferenceBadgeGap);
          qualityStartY = Math.max(qualityStartY, belowTop);
        } else {
          const sideBadges = qualityPlacement === 'right' ? input.rightBadges : input.leftBadges;
          if (sideBadges.length > 0) {
            const sideColumnHeight = measureBadgeColumnHeight(sideBadges, metrics, input.verticalBadgeContent);
            if (sideColumnHeight > 0) {
              const belowSide = input.badgeTopOffset + sideColumnHeight + input.badgeGap;
              qualityStartY = Math.max(qualityStartY, belowSide);
            }
          }
        }
        composeQualityBadgeColumn(input.qualityBadges, qualityStartY, qualityPlacement === 'right' ? 'right' : 'left');
      }
    }

    if (input.imageType === 'backdrop' && input.qualityBadges.length > 0) {
      const qualityHeight = Math.max(44, Math.round(badgeHeight * 1.25));
      const uniformBadgeWidth = Math.min(
        Math.max(72, Math.round(qualityHeight * 1.75)),
        Math.max(72, input.outputWidth - 24)
      );
      const usableQualityBadges = input.qualityBadges.filter((badge) =>
        STREAM_BADGE_META.has(badge.key as StreamBadgeKey)
      );
      if (usableQualityBadges.length > 0) {
        const leftColumn: RatingBadge[] = [];
        const rightColumn: RatingBadge[] = [];
        if (input.backdropRatingsLayout === 'center' && usableQualityBadges.length === 2) {
          leftColumn.push(usableQualityBadges[0]);
          rightColumn.push(usableQualityBadges[1]);
        } else {
          for (const badge of usableQualityBadges) {
            if (leftColumn.length < 2) {
              leftColumn.push(badge);
            } else if (rightColumn.length < 2) {
              rightColumn.push(badge);
            } else if (leftColumn.length <= rightColumn.length) {
              leftColumn.push(badge);
            } else {
              rightColumn.push(badge);
            }
          }
        }
        const startY = input.badgeTopOffset;
        const columnGap = Math.max(8, Math.round(input.badgeGap * 0.8));
        const metrics: BadgeLayoutMetrics = {
          iconSize: input.badgeIconSize,
          fontSize: input.badgeFontSize,
          paddingX: input.badgePaddingX,
          paddingY: input.badgePaddingY,
          gap: input.badgeGap,
        };
        const backdropPlacement = getBackdropBadgePlacement(
          input.outputWidth,
          input.backdropRatingsLayout,
          input.imageType
        );
        const effectiveMaxWidth = Math.max(0, backdropPlacement.width - 24);
        const backdropRows =
          input.backdropRows && input.backdropRows.length > 0
            ? input.backdropRows
            : [input.topBadges, input.bottomBadges].filter((row) => row.length > 0);
        const verticalBackdropColumns =
          backdropPlacement.stack === 'column'
            ? (input.backdropColumns && input.backdropColumns.length > 0
              ? input.backdropColumns
              : [input.leftBadges, input.rightBadges].filter((column) => column.length > 0))
            : [];
        const ratingCenterX = backdropPlacement.left + backdropPlacement.width / 2;
        let ratingLeft = ratingCenterX;
        let ratingRight = ratingCenterX;
        let ratingBlockTop = startY;
        let ratingBlockBottom = startY;
        let ratingRows = 0;
        if (backdropPlacement.stack === 'column' && verticalBackdropColumns.length > 0) {
          const estimatedColumns = verticalBackdropColumns.map((columnBadges) => {
            const maxWidth = columnBadges.reduce(
              (columnMaxWidth, badge) =>
                Math.max(
                  columnMaxWidth,
                  estimateBadgeWidth(
                    badge.value,
                    input.badgeFontSize,
                    input.badgePaddingX,
                    input.badgeIconSize,
                    input.badgeGap,
                    false,
                    input.verticalBadgeContent
                  )
                ),
              0
            );
            return {
              maxWidth,
              height: measureBadgeColumnHeight(columnBadges, metrics, input.verticalBadgeContent),
            };
          });
          const ratingBlockWidth =
            estimatedColumns.reduce((sum, column) => sum + column.maxWidth, 0) +
            Math.max(0, estimatedColumns.length - 1) * Math.max(12, input.badgeGap);
          const columnStartX =
            backdropPlacement.align === 'right'
              ? backdropPlacement.left + backdropPlacement.width - ratingBlockWidth
              : backdropPlacement.align === 'center'
                ? backdropPlacement.left + Math.floor((backdropPlacement.width - ratingBlockWidth) / 2)
                : backdropPlacement.left;
          const tallestHeight = estimatedColumns.reduce(
            (maxHeight, column) => Math.max(maxHeight, column.height),
            0
          );
          ratingLeft = columnStartX;
          ratingRight = columnStartX + ratingBlockWidth;
          ratingBlockTop =
            backdropPlacement.vertical === 'bottom'
              ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - tallestHeight)
              : backdropPlacement.vertical === 'center'
                ? Math.max(input.badgeTopOffset, Math.round((input.outputHeight - tallestHeight) / 2))
                : startY;
          ratingBlockBottom = ratingBlockTop + tallestHeight;
        } else {
          const ratingBlockWidth = backdropRows.reduce((maxWidth, row) => {
            const rowWidth = Math.min(measureBadgeRowWidth(row, metrics), effectiveMaxWidth);
            return Math.max(maxWidth, rowWidth);
          }, 0);
          const totalRowsHeight =
            backdropRows.length * badgeHeight + Math.max(0, backdropRows.length - 1) * input.badgeGap;
          if (backdropPlacement.align === 'right') {
            ratingRight = backdropPlacement.left + backdropPlacement.width;
            ratingLeft = ratingRight - ratingBlockWidth;
          } else if (backdropPlacement.align === 'left') {
            ratingLeft = backdropPlacement.left;
            ratingRight = ratingLeft + ratingBlockWidth;
          } else {
            ratingLeft = ratingCenterX - ratingBlockWidth / 2;
            ratingRight = ratingCenterX + ratingBlockWidth / 2;
          }
          ratingRows =
            input.backdropRows && input.backdropRows.length > 0
              ? input.backdropRows.length
              : (input.topBadges.length > 0 ? 1 : 0) + (input.bottomBadges.length > 0 ? 1 : 0);
          ratingBlockTop =
            backdropPlacement.vertical === 'bottom'
              ? Math.max(input.badgeTopOffset, input.outputHeight - input.badgeBottomOffset - totalRowsHeight)
              : backdropPlacement.vertical === 'center'
                ? Math.max(input.badgeTopOffset, Math.round((input.outputHeight - totalRowsHeight) / 2))
                : startY;
          ratingBlockBottom =
            ratingRows > 0
              ? ratingBlockTop + totalRowsHeight
              : startY;
        }
        const stackedQualityStartY =
          input.backdropRatingsLayout === 'center' || input.backdropRatingsLayout === 'right-vertical'
            ? startY
            : ratingBlockBottom + Math.max(input.badgeGap, Math.round(columnGap * 1.2));
        const placeQualityLeftOfRatings = backdropPlacement.align === 'right';
        let qualityStartY = placeQualityLeftOfRatings ? ratingBlockTop : stackedQualityStartY;

        if (rightColumn.length === 0) {
          let singleX = Math.max(
            12,
            Math.round(
              input.backdropRatingsLayout === 'center'
                ? ratingCenterX - uniformBadgeWidth / 2
                : placeQualityLeftOfRatings
                  ? ratingLeft - columnGap - uniformBadgeWidth
                  : input.backdropRatingsLayout.startsWith('right')
                    ? ratingRight + columnGap
                    : ratingLeft - columnGap - uniformBadgeWidth
            )
          );
          if (backdropPlacement.stack === 'column') {
            qualityStartY = ratingBlockTop;
            singleX = Math.max(12, Math.round(ratingLeft - columnGap - uniformBadgeWidth));
          }
          const singleStartY =
            backdropPlacement.stack !== 'column' &&
              input.backdropRatingsLayout === 'center' &&
              ratingRows > 0
              ? startY + ratingRows * (badgeHeight + input.badgeGap)
              : qualityStartY;
          renderQualityBadgeColumnAt(
            leftColumn,
            singleStartY,
            singleX,
            qualityHeight,
            uniformBadgeWidth
          );
        } else {
          let leftX = 12;
          let rightX = Math.max(12, input.outputWidth - uniformBadgeWidth - 12);
          if (backdropPlacement.stack === 'column') {
            qualityStartY = ratingBlockTop;
            rightX = Math.max(12, Math.round(ratingLeft - columnGap - uniformBadgeWidth));
            leftX = Math.max(12, rightX - columnGap - uniformBadgeWidth);
          } else if (placeQualityLeftOfRatings) {
            rightX = ratingLeft - columnGap - uniformBadgeWidth;
            leftX = rightX - columnGap - uniformBadgeWidth;
          } else {
            leftX = ratingLeft - columnGap - uniformBadgeWidth;
            rightX = ratingRight + columnGap;
          }

          renderQualityBadgeColumnAt(
            leftColumn,
            qualityStartY,
            leftX,
            qualityHeight,
            uniformBadgeWidth
          );
          renderQualityBadgeColumnAt(
            rightColumn,
            qualityStartY,
            rightX,
            qualityHeight,
            uniformBadgeWidth
          );
        }
      }
    }

    const composePosterGenreBadge = () => {
      if (input.imageType !== 'poster' || !input.posterGenreBadge || input.posterGenrePosition === 'off') return;
      const badge = input.posterGenreBadge;
      const position = input.posterGenrePosition;
      const metrics: BadgeLayoutMetrics = {
        iconSize: input.badgeIconSize,
        fontSize: input.badgeFontSize,
        paddingX: input.badgePaddingX,
        paddingY: input.badgePaddingY,
        gap: input.badgeGap,
      };

      // Use slightly more generous height for Genre to avoid clipping
      const genreHeight = estimateBadgeHeight(metrics.fontSize, metrics.paddingX, metrics.paddingY, 0, 'standard');
      const genreWidth = estimateBadgeWidth(badge.value, metrics.fontSize, metrics.paddingX, 0, metrics.gap, true, 'standard');
      const left = Math.round((input.outputWidth - genreWidth) / 2);

      let top = input.badgeTopOffset;
      if (position === 'bottom') {
        top = input.outputHeight - input.badgeBottomOffset - genreHeight;
      }

      const overlapGap = Math.max(12, Math.round(input.badgeGap * 1.1));
      const getGenreRect = (y: number) => ({ left, top: y, width: genreWidth, height: genreHeight });

      for (let guard = 0; guard < 12; guard++) {
        const rect = getGenreRect(top);
        const collisions = posterBlockingRects.filter(r => rectsOverlap(rect, r));
        if (collisions.length === 0) break;

        if (position === 'top') {
          top = Math.max(...collisions.map(r => r.top + r.height)) + overlapGap;
        } else {
          top = Math.min(...collisions.map(r => r.top)) - genreHeight - overlapGap;
        }
      }

      // Clamp to screen bounds
      top = Math.max(input.badgeTopOffset, Math.min(top, input.outputHeight - input.badgeBottomOffset - genreHeight));

      const badgeSvg = buildBadgeSvg({
        width: genreWidth,
        height: genreHeight,
        iconSize: 0,
        fontSize: metrics.fontSize,
        paddingX: metrics.paddingX,
        gap: metrics.gap,
        accentColor: badge.accentColor || '#4b5563',
        monogram: '',
        value: badge.value,
        ratingStyle: input.ratingStyle,
        compactText: true,
      });

      // Compensate for the 4px padding in buildBadgeSvg's viewBox
      const renderedSvg = badgeSvg
        .replace(`width="${genreWidth}"`, `width="${genreWidth + 8}"`)
        .replace(`height="${genreHeight}"`, `height="${genreHeight + 8}"`);

      overlays.push({ input: Buffer.from(renderedSvg), top: top - 4, left: left - 4 });
      addPosterBlockingRect(left, top, genreWidth, genreHeight);
    };

    if (input.imageType === 'poster' && input.rankingBadge) {
      const badge = input.rankingBadge;
      const rankingIconDataUri = await getProviderIconDataUri(RANKING_ICON_URL, 0);
      const rankingScale = input.posterConfiguratorPreset === 'advanced' ? 1.3 : 1.15;
      const rankingSpec = buildRankingBadgeSvg(
        badge.value,
        badge.label,
        rankingIconDataUri,
        badge.noBox ?? (input.posterConfiguratorPreset === 'simple'),
        rankingScale
      );
      const maxWidth = Math.max(1, input.outputWidth - 24);
      const scale = rankingSpec.width > maxWidth ? maxWidth / rankingSpec.width : 1;
      const renderedWidth = Math.round(rankingSpec.width * scale);
      const renderedHeight = Math.round(rankingSpec.height * scale);
      const rankingBuffer =
        scale < 1
          ? await sharp(Buffer.from(rankingSpec.svg))
            .resize(renderedWidth, renderedHeight, { fit: 'fill' })
            .png()
            .toBuffer()
          : Buffer.from(rankingSpec.svg);
      const left = Math.max(12, Math.floor((input.outputWidth - renderedWidth) / 2));
      const rankingGap = Math.max(3, Math.round(input.badgeGap * 0.35));
      const getTopRankingTop = () => {
        let nextTop = input.badgeTopOffset;
        if (input.topBadges.length > 0) {
          nextTop = Math.max(nextTop, input.badgeTopOffset + verticalBadgeHeight + rankingGap);
        }
        if (input.qualityBadges.length > 0) {
          const qualityPlacement = resolvePosterQualityBadgePlacement(
            input.posterRatingsLayout,
            input.qualityBadgesSide,
            input.posterQualityBadgesPosition
          );
          if (qualityPlacement === 'top' && input.posterConfiguratorPreset !== 'simple') {
            const topQualityHeight = Math.max(36, Math.round(posterReferenceBadgeHeight * 1.05));
            nextTop = Math.max(nextTop, input.badgeTopOffset + topQualityHeight + rankingGap);
          }
        }
        return nextTop;
      };
      const getAboveLogoRankingTop = () => {
        if (lastOverlayTopY <= 0) return getTopRankingTop();
        const overlayGap = Math.max(8, Math.round(posterReferenceBadgeGap * 0.9));
        return Math.max(input.badgeTopOffset, lastOverlayTopY - renderedHeight - overlayGap);
      };
      const getBottomRankingTop = () => {
        const overlapGap = Math.max(8, Math.round(posterReferenceBadgeGap * 0.9));
        let bottomLimit = Math.max(
          input.badgeTopOffset,
          input.outputHeight - input.badgeBottomOffset - renderedHeight
        );
        if (input.bottomBadges.length > 0) {
          bottomLimit = Math.min(
            bottomLimit,
            input.outputHeight - input.badgeBottomOffset - badgeHeight - rankingGap - renderedHeight
          );
        }
        if (lastOverlayTopY > 0) {
          const lowerCenterStackTop =
            lastPosterQualityTopY > 0 && lastPosterQualityTopY < lastOverlayTopY
              ? lastPosterQualityTopY
              : lastOverlayTopY;
          bottomLimit = Math.min(bottomLimit, lowerCenterStackTop - renderedHeight - overlapGap);
        }
        let nextTop = bottomLimit;
        const getRankingRect = (topValue: number): OverlayRect => ({
          left,
          top: topValue,
          width: renderedWidth,
          height: renderedHeight,
        });
        for (let guard = 0; guard < 8; guard += 1) {
          const rankingRect = getRankingRect(nextTop);
          const collidingRects = posterBlockingRects.filter((rect) => rectsOverlap(rankingRect, rect));
          if (collidingRects.length === 0) break;
          const belowTop = Math.max(
            nextTop,
            ...collidingRects.map((rect) => rect.top + rect.height + overlapGap)
          );
          if (belowTop <= bottomLimit) {
            nextTop = belowTop;
            continue;
          }
          nextTop = Math.min(
            nextTop,
            ...collidingRects.map((rect) => rect.top - renderedHeight - overlapGap)
          );
        }
        if (
          lastPosterQualityTopY > 0 &&
          nextTop < lastPosterQualityBottomY &&
          nextTop + renderedHeight > lastPosterQualityTopY
        ) {
          nextTop = Math.min(nextTop, lastPosterQualityTopY - renderedHeight - rankingGap);
        }
        return nextTop;
      };
      const rankingPosition = input.rankingPosition || 'auto';
      let top =
        rankingPosition === 'bottom'
          ? getBottomRankingTop()
          : rankingPosition === 'above-logo'
            ? getAboveLogoRankingTop()
            : getTopRankingTop();
      if (rankingPosition === 'auto' && lastOverlayTopY > 0) {
        top = Math.max(top, getAboveLogoRankingTop());
      }
      if (
        rankingPosition !== 'bottom' &&
        lastPosterQualityTopY > 0 &&
        top < lastPosterQualityBottomY &&
        top + renderedHeight > lastPosterQualityTopY
      ) {
        top = Math.max(input.badgeTopOffset, lastPosterQualityTopY - renderedHeight - rankingGap);
      }
      const minTop = input.badgeTopOffset;
      const maxTop = Math.max(minTop, input.outputHeight - input.badgeBottomOffset - renderedHeight);
      top = Math.max(minTop, Math.min(Math.round(top), maxTop));
      overlays.push({ input: rankingBuffer, top, left });
      addPosterBlockingRect(left, top, renderedWidth, renderedHeight);
    }

    composePosterGenreBadge();

    const background =
      input.imageType === 'logo'
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : { r: 17, g: 17, b: 17, alpha: 1 };

    let pipeline = sharp({
      create: {
        width: input.outputWidth,
        height: input.finalOutputHeight,
        channels: 4,
        background,
      },
    }).composite(overlays);
    if (input.imageType === 'logo') {
      pipeline = pipeline.trim({ background: transparentBackground });
    }

    let finalBuffer: Buffer;
    let outputContentType = outputFormatToContentType(input.outputFormat);
    if (input.outputFormat === 'webp') {
      finalBuffer = await pipeline.webp({ quality: 80, effort: 3 }).toBuffer();
    } else if (input.outputFormat === 'jpeg') {
      finalBuffer = await pipeline.jpeg({ quality: 82 }).toBuffer();
    } else {
      finalBuffer = await pipeline.png({ compressionLevel: 1 }).toBuffer();
    }

    return {
      body: bufferToArrayBuffer(finalBuffer),
      contentType: outputContentType,
      cacheControl: input.cacheControl,
    };
  });
};

