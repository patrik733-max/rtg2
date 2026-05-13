import {
  DEFAULT_LOGO_CUSTOM_OUTLINE,
  DEFAULT_LOGO_CUSTOM_PRIMARY,
  DEFAULT_LOGO_CUSTOM_SECONDARY,
  normalizeHexColor,
} from '@/lib/logoCustomColors';
import { DEFAULT_LOGO_FONT_VARIANT, type LogoFontVariant } from '@/lib/logoFontVariant';
import { GENERATED_LOGO_FONT_VARIANTS } from '@/lib/logoFontVariants';
import { getMetadata, setMetadata } from '@/lib/metadataCache';
import {
  getCachedImageFromObjectStorage,
  isObjectStorageConfigured,
  putCachedImageToObjectStorage,
} from '@/lib/objectStorage';
import {
  escapeXml,
  estimateGeneratedLogoLineWidth,
  splitTitleForGeneratedLogo,
} from '@/lib/imageSvgText';
import { LOGO_BASE_HEIGHT } from '@/lib/ratingBadgeLogic';
import {
  GENERATED_LOGO_VARIANT_CACHE_MAX_ENTRIES,
  GENERATED_LOGO_VARIANT_CACHE_TTL_MS,
  PROVIDER_ICON_CACHE_TTL_MS,
  TMDB_CACHE_TTL_MS,
} from '@/lib/routeConfig';
import { sha1Hex, withDedupe } from '@/lib/routeShared';
import { HttpError, type RenderedImagePayload, type RenderImageType } from '@/lib/routeTypes';
import { parseNonNegativeInt } from '@/lib/routeUtils';

const sourceImageInFlight = new Map<string, Promise<RenderedImagePayload>>();
const providerIconInFlight = new Map<string, Promise<string | null>>();
const generatedLogoVariantCache = new Map<string, { dataUrl: string; aspectRatio: number }>();
const generatedLogoVariantInFlight = new Map<string, Promise<{ dataUrl: string; aspectRatio: number }>>();
const getGeneratedLogoVariantCacheKey = (
  title: string,
  logoFontVariant: LogoFontVariant,
  primaryColor: string,
  secondaryColor: string,
  outlineColor: string
) =>
  JSON.stringify({
    title: title.trim(),
    logoFontVariant,
    primaryColor: normalizeHexColor(primaryColor, DEFAULT_LOGO_CUSTOM_PRIMARY),
    secondaryColor: normalizeHexColor(secondaryColor, DEFAULT_LOGO_CUSTOM_SECONDARY),
    outlineColor: normalizeHexColor(outlineColor, DEFAULT_LOGO_CUSTOM_OUTLINE),
  });

const getCachedGeneratedLogoVariant = (cacheKey: string) => {
  const cached = generatedLogoVariantCache.get(cacheKey);
  if (!cached) return null;

  // Refresh insertion order for simple LRU behavior.
  generatedLogoVariantCache.delete(cacheKey);
  generatedLogoVariantCache.set(cacheKey, cached);
  return cached;
};

const setCachedGeneratedLogoVariant = (
  cacheKey: string,
  value: { dataUrl: string; aspectRatio: number }
) => {
  generatedLogoVariantCache.set(cacheKey, value);
  if (generatedLogoVariantCache.size <= GENERATED_LOGO_VARIANT_CACHE_MAX_ENTRIES) {
    return;
  }

  const oldestKey = generatedLogoVariantCache.keys().next().value;
  if (oldestKey) {
    generatedLogoVariantCache.delete(oldestKey);
  }
};

let sharpFactoryPromise: Promise<any | null> | null = null;
let sharpConfigured = false;
const configureSharp = (sharp: any) => {
  if (sharpConfigured || !sharp) return;
  sharpConfigured = true;

  const concurrency = parseNonNegativeInt(process.env.ERDB_SHARP_CONCURRENCY, 0);
  if (concurrency && concurrency > 0) {
    sharp.concurrency(concurrency);
  }

  const cacheOptions: { memory?: number; files?: number; items?: number } = {};
  const memory = parseNonNegativeInt(process.env.ERDB_SHARP_CACHE_MEMORY_MB, 0);
  const files = parseNonNegativeInt(process.env.ERDB_SHARP_CACHE_FILES, 0);
  const items = parseNonNegativeInt(process.env.ERDB_SHARP_CACHE_ITEMS, 0);
  if (memory !== null) cacheOptions.memory = memory;
  if (files !== null) cacheOptions.files = files;
  if (items !== null) cacheOptions.items = items;
  if (Object.keys(cacheOptions).length > 0) {
    sharp.cache(cacheOptions);
  }
};
export const getSharpFactory = async () => {
  if (!sharpFactoryPromise) {
    sharpFactoryPromise = import('sharp')
      .then((mod: any) => {
        const sharp = mod.default || mod;
        configureSharp(sharp);
        return sharp;
      })
      .catch((error) => {
        throw new Error(
          `sharp is required for ERDB image rendering: ${error instanceof Error ? error.message : 'unknown error'}`
        );
      });
  }
  return sharpFactoryPromise;
};

export const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

const toImageContentType = (value: string | null) => {
  const normalized = (value || '').split(';')[0]?.trim().toLowerCase();
  return normalized?.startsWith('image/') ? normalized : 'image/png';
};

const buildSourceImageFallbackCacheControl = (ttlMs: number) => {
  const ttlSeconds = Math.max(60, Math.floor(ttlMs / 1000));
  return `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=3600`;
};

const isTmdbSourceImageUrl = (value: string) => {
  try {
    return new URL(value).hostname === 'image.tmdb.org';
  } catch {
    return false;
  }
};

const buildProviderIconStorageKey = (iconUrl: string, iconCornerRadius = 0) =>
  `icons/${sha1Hex(`${iconUrl}|r:${iconCornerRadius}`)}.png`;

const buildGeneratedLogoVariantStorageKey = (cacheKey: string) =>
  `customlogos/${sha1Hex(cacheKey)}.svg`;

const readProviderIconFromStorage = async (
  iconUrl: string,
  iconCornerRadius = 0
): Promise<string | null> => {
  if (!isObjectStorageConfigured()) return null;
  try {
    const payload = await getCachedImageFromObjectStorage(
      buildProviderIconStorageKey(iconUrl, iconCornerRadius)
    );
    if (!payload) return null;
    const buffer = Buffer.from(payload.body);
    const contentType = toImageContentType(payload.contentType);
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
};

const writeProviderIconToStorage = async (
  iconUrl: string,
  buffer: Buffer,
  iconCornerRadius = 0
) => {
  if (!isObjectStorageConfigured()) return;
  try {
    await putCachedImageToObjectStorage(buildProviderIconStorageKey(iconUrl, iconCornerRadius), {
      body: bufferToArrayBuffer(buffer),
      contentType: 'image/png',
      cacheControl: buildSourceImageFallbackCacheControl(PROVIDER_ICON_CACHE_TTL_MS),
    });
  } catch {
    // Ignore icon cache write failures.
  }
};

const readGeneratedLogoVariantFromStorage = async (cacheKey: string) => {
  if (!isObjectStorageConfigured()) return null;
  try {
    const payload = await getCachedImageFromObjectStorage(buildGeneratedLogoVariantStorageKey(cacheKey));
    if (!payload) return null;
    const svg = Buffer.from(payload.body).toString('utf8');
    return {
      dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      aspectRatio: LOGO_BASE_HEIGHT > 0 ? Math.max(1, extractSvgWidth(svg)) / LOGO_BASE_HEIGHT : 2.5,
    };
  } catch {
    return null;
  }
};

const writeGeneratedLogoVariantToStorage = async (cacheKey: string, svg: string) => {
  if (!isObjectStorageConfigured()) return;
  try {
    await putCachedImageToObjectStorage(buildGeneratedLogoVariantStorageKey(cacheKey), {
      body: bufferToArrayBuffer(Buffer.from(svg, 'utf8')),
      contentType: 'image/svg+xml',
      cacheControl: buildSourceImageFallbackCacheControl(GENERATED_LOGO_VARIANT_CACHE_TTL_MS),
    });
  } catch {
    // Ignore generated logo cache write failures.
  }
};

const extractSvgWidth = (svg: string) => {
  const match = svg.match(/\bwidth="(\d+)"/i);
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 800;
};

const pickTmdbImageSize = (imageType: RenderImageType, outputWidth: number) => {
  if (imageType === 'poster' || imageType === 'backdrop' || imageType === 'thumbnail' || imageType === 'logo') {
    return 'original';
  }
  return 'original';
};

export const buildTmdbImageUrl = (
  imageType: RenderImageType,
  imgPath: string,
  outputWidth: number
) => {
  const size = pickTmdbImageSize(imageType, outputWidth);
  return `https://image.tmdb.org/t/p/${size}${imgPath}`;
};

const fetchSourceImageUncached = async (
  imgUrl: string,
  fallbackTtlMs: number
): Promise<RenderedImagePayload> => {
  const sourceResponse = await fetch(imgUrl, { cache: 'no-store' });
  if (!sourceResponse.ok) {
    throw new HttpError('Image not found', sourceResponse.status || 404);
  }

  return {
    body: await sourceResponse.arrayBuffer(),
    contentType: sourceResponse.headers.get('content-type') || 'image/jpeg',
    cacheControl:
      sourceResponse.headers.get('cache-control') || buildSourceImageFallbackCacheControl(fallbackTtlMs),
  };
};

export const getSourceImagePayload = async (
  imgUrl: string,
  fallbackTtlMs = TMDB_CACHE_TTL_MS
): Promise<RenderedImagePayload> => {
  const normalizedImgUrl = String(imgUrl || '').trim();
  if (!normalizedImgUrl) {
    throw new HttpError('Image not found', 404);
  }

  const sharedCacheable = isTmdbSourceImageUrl(normalizedImgUrl);
  if (!sharedCacheable) {
    return fetchSourceImageUncached(normalizedImgUrl, fallbackTtlMs);
  }

  // Local image cache removed in favor of objectStorage

  const sourceHash = sha1Hex(normalizedImgUrl);
  const sourceObjectStorageKey = `source/${sourceHash}`;
  const objectStorageEnabled = isObjectStorageConfigured();

  const readSharedSourcePayload = async () => {
    if (!objectStorageEnabled) return null;


    const objectPayload = await getCachedImageFromObjectStorage(sourceObjectStorageKey);
    if (!objectPayload) {
      return null;
    }

    const payload: RenderedImagePayload = {
      body: objectPayload.body,
      contentType: objectPayload.contentType,
      cacheControl: objectPayload.cacheControl,
    };
    return payload;
  };

  if (objectStorageEnabled) {
    try {
      const sharedPayload = await readSharedSourcePayload();
      if (sharedPayload) {
        return sharedPayload;
      }
    } catch {
      // Ignore distributed cache read failures and continue with fetch path.
    }
  }

  return withDedupe(sourceImageInFlight, normalizedImgUrl, async () => {
    // Local warming removed

    if (objectStorageEnabled) {
      try {
        const sharedPayload = await readSharedSourcePayload();
        if (sharedPayload) {
          return sharedPayload;
        }
      } catch {
        // Ignore distributed cache read failures inside in-flight dedupe path.
      }
    }


    const payload = await fetchSourceImageUncached(normalizedImgUrl, fallbackTtlMs);

    if (objectStorageEnabled) {
      try {
        await putCachedImageToObjectStorage(sourceObjectStorageKey, payload);
      } catch {
        // Ignore distributed cache persistence failures for source images.
      }
    }

    return payload;
  });
};

export const getProviderIconDataUri = async (
  iconUrl: string,
  iconCornerRadius = 0
): Promise<string | null> => {
  const normalizedIconUrl = iconUrl.trim();
  if (!normalizedIconUrl) return null;
  if (normalizedIconUrl.startsWith('data:')) {
    return normalizedIconUrl;
  }
  const cacheKey = `${normalizedIconUrl}|r:${iconCornerRadius}`;

  const localCached = getMetadata<string>(cacheKey);
  if (localCached) {
    return localCached;
  }

  return withDedupe(providerIconInFlight, cacheKey, async () => {
    const warmLocal = getMetadata<string>(cacheKey);
    if (warmLocal) return warmLocal;

    const storageCached = await readProviderIconFromStorage(normalizedIconUrl, iconCornerRadius);
    if (storageCached) {
      setMetadata(cacheKey, storageCached, PROVIDER_ICON_CACHE_TTL_MS);
      return storageCached;
    }

    try {
      const response = await fetch(normalizedIconUrl, { cache: 'no-store' });
      if (!response.ok) return null;

      const sourceBuffer = Buffer.from(await response.arrayBuffer());
      const sharp = await getSharpFactory();
      let pipeline = sharp(sourceBuffer)
        .trim()
        .resize(96, 96, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      if (iconCornerRadius > 0) {
        const radius = Math.max(1, Math.min(48, Math.round(iconCornerRadius)));
        const roundedMask = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="${radius}" ry="${radius}" fill="white"/></svg>`
        );
        pipeline = pipeline.composite([{ input: roundedMask, blend: 'dest-in' }]);
      }
      const outputBuffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
      const outputContentType = 'image/png';

      const dataUri = `data:${outputContentType};base64,${outputBuffer.toString('base64')}`;
      setMetadata(cacheKey, dataUri, PROVIDER_ICON_CACHE_TTL_MS);
      await writeProviderIconToStorage(normalizedIconUrl, outputBuffer, iconCornerRadius);

      return dataUri;
    } catch {
      return null;
    }
  });
};

export const buildGeneratedLogoVariantDataUrl = async (
  title: string,
  logoFontVariant: LogoFontVariant,
  primaryColor: string,
  secondaryColor: string,
  outlineColor: string
) => {
  const cacheKey = getGeneratedLogoVariantCacheKey(
    title,
    logoFontVariant,
    primaryColor,
    secondaryColor,
    outlineColor
  );
  const cached = getCachedGeneratedLogoVariant(cacheKey);
  if (cached) {
    return cached;
  }

  const persisted = await readGeneratedLogoVariantFromStorage(cacheKey);
  if (persisted) {
    setCachedGeneratedLogoVariant(cacheKey, persisted);
    return persisted;
  }

  return withDedupe(generatedLogoVariantInFlight, cacheKey, async () => {
    const dedupedCached = getCachedGeneratedLogoVariant(cacheKey);
    if (dedupedCached) {
      return dedupedCached;
    }

    const dedupedPersisted = await readGeneratedLogoVariantFromStorage(cacheKey);
    if (dedupedPersisted) {
      setCachedGeneratedLogoVariant(cacheKey, dedupedPersisted);
      return dedupedPersisted;
    }

    const hexToRgb = (hex: string) => {
      const normalized = normalizeHexColor(hex, '#ffffff').slice(1);
      return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
      };
    };
    const mixHexColors = (a: string, b: string, weight = 0.5) => {
      const clampedWeight = Math.max(0, Math.min(1, weight));
      const colorA = hexToRgb(a);
      const colorB = hexToRgb(b);
      const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
      return `#${toHex(colorA.r * (1 - clampedWeight) + colorB.r * clampedWeight)}${toHex(colorA.g * (1 - clampedWeight) + colorB.g * clampedWeight)}${toHex(colorA.b * (1 - clampedWeight) + colorB.b * clampedWeight)}`;
    };
    const toRgba = (hex: string, alpha: number) => {
      const { r, g, b } = hexToRgb(hex);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const lines = splitTitleForGeneratedLogo(title);
    const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
    const width = Math.max(760, Math.round(maxLineLength * 68 + 280));
    const height = LOGO_BASE_HEIGHT;
    const aspectRatio = width / height;
    const availableLineWidth = Math.max(420, width - 150);
    const baseFontSize = lines.length === 1 ? 210 : lines.length === 2 ? 165 : lines.length === 3 ? 130 : 105;
    const compressedFontSize = Math.max(58, Math.floor((width - 160) / Math.max(maxLineLength, 1) * 1.72));
    const preliminaryFontSize = Math.min(baseFontSize, compressedFontSize);
    const variant =
      GENERATED_LOGO_FONT_VARIANTS.find((item) => item.id === logoFontVariant) ||
      GENERATED_LOGO_FONT_VARIANTS.find((item) => item.id === DEFAULT_LOGO_FONT_VARIANT) ||
      GENERATED_LOGO_FONT_VARIANTS[0];
    const resolvedPrimaryColor = normalizeHexColor(primaryColor, DEFAULT_LOGO_CUSTOM_PRIMARY);
    const resolvedSecondaryColor = normalizeHexColor(secondaryColor, DEFAULT_LOGO_CUSTOM_SECONDARY);
    const resolvedOutlineColor = normalizeHexColor(outlineColor, DEFAULT_LOGO_CUSTOM_OUTLINE);
    const resolvedShadowColor =
      variant.fillMode === 'outline'
        ? resolvedSecondaryColor
        : mixHexColors(resolvedPrimaryColor, resolvedSecondaryColor, 0.45);
    const longestEstimatedLineWidth = Math.max(
      ...lines.map((line) => estimateGeneratedLogoLineWidth(line, preliminaryFontSize)),
      1
    );
    const widthFitScale = Math.min(1, availableLineWidth / longestEstimatedLineWidth);
    const fontSize = Math.max(54, Math.floor(preliminaryFontSize * widthFitScale));
    const lineHeight = Math.round(fontSize * 0.96);
    const topPadding = Math.round(fontSize * (variant.topPaddingFactor ?? 0.08));
    const bottomPadding = Math.round(fontSize * (variant.bottomPaddingFactor ?? 0.08));
    const contentHeight = Math.max(1, height - topPadding - bottomPadding);
    const totalTextHeight = lineHeight * Math.max(0, lines.length - 1);
    const startY = Math.round(topPadding + contentHeight / 2 - totalTextHeight / 2 + fontSize * 0.34);
    const strokeWidth =
      variant.fillMode === 'outline'
        ? Math.max(5, Math.round(fontSize * 0.09))
        : Math.max(4, Math.round(fontSize * 0.07));
    const letterSpacing = Math.max(1, Math.round(fontSize * variant.letterSpacingFactor));
    const displayLines = variant.uppercase ? lines.map((line) => line.toUpperCase()) : lines;
    const baseShadow = variant.shadow || { dy: 8, stdDeviation: 10, color: '#000000', opacity: 0.3 };
    const shadow = {
      ...baseShadow,
      color: resolvedShadowColor,
    };
    const tspans = lines
      .map((_, index) => {
        const line = displayLines[index] || '';
        const y = startY + index * lineHeight;
        const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, fontSize);
        const textLength =
          estimatedLineWidth > availableLineWidth
            ? ` textLength="${availableLineWidth}" lengthAdjust="spacingAndGlyphs"`
            : '';
        return `<tspan x="${Math.round(width / 2)}" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
      })
      .join('');
    const fillId = `logo-fill-${variant.id}`;
    const fillValue =
      variant.fillMode === 'gradient'
        ? `url(#${fillId})`
        : variant.fillMode === 'outline'
          ? 'rgba(255,255,255,0.02)'
          : resolvedPrimaryColor;
    const defs = [
      `<filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="${shadow.stdDeviation}" result="blur" /><feFlood flood-color="${shadow.color}" flood-opacity="${shadow.opacity}" /><feComposite in2="blur" operator="in" result="shadow" /><feOffset in="shadow" dx="0" dy="${shadow.dy}" result="offsetShadow" /><feMerge><feMergeNode in="offsetShadow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>`,
    ];
    const customGradientStops =
      (variant.gradientStops?.length || 0) <= 2
        ? [
          { offset: '0%', color: resolvedPrimaryColor },
          { offset: '100%', color: resolvedSecondaryColor },
        ]
        : [
          { offset: '0%', color: resolvedPrimaryColor },
          { offset: '50%', color: resolvedSecondaryColor },
          { offset: '100%', color: resolvedSecondaryColor },
        ];
    if (variant.fillMode === 'gradient' && variant.gradientStops?.length) {
      defs.push(
        `<linearGradient id="${fillId}" x1="0%" y1="0%" x2="0%" y2="100%">${customGradientStops
          .map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}" />`)
          .join('')}</linearGradient>`
      );
    }
    const transform = variant.skewX ? ` transform="skewX(${variant.skewX})"` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  ${defs.join('\n  ')}
</defs>
<g${transform}>
  <text x="${Math.round(width / 2)}" y="${startY}" text-anchor="middle" font-family="${variant.fontFamily}" font-size="${fontSize}" font-weight="${variant.weight}"${variant.italic ? ' font-style="italic"' : ''} letter-spacing="${letterSpacing}" fill="${fillValue}" stroke="${toRgba(resolvedOutlineColor, variant.strokeOpacity ?? 0.92)}" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#logo-shadow)">${tspans}</text>
</g>
</svg>`;
    const generatedLogo = {
      dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
      aspectRatio,
    };
    setCachedGeneratedLogoVariant(cacheKey, generatedLogo);
    await writeGeneratedLogoVariantToStorage(cacheKey, svg);
    return generatedLogo;
  });
};

