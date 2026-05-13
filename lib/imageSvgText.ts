const LOGO_BASE_HEIGHT = 320;

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const splitTitleForGeneratedLogo = (title: string) => {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) return ['Kitsu'];

  const words = normalized.split(' ').filter(Boolean);
  if (words.length <= 2 && normalized.length <= 24) return [normalized];

  const maxLines = 4;
  const targetLineLength =
    normalized.length >= 56 ? 13 : normalized.length >= 42 ? 15 : normalized.length >= 30 ? 17 : 19;
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    const currentLimit = lines.length === 0 ? targetLineLength + 1 : targetLineLength;
    if (currentLine && nextLine.length > currentLimit && lines.length < maxLines - 1) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }
    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    const tail = lines.slice(maxLines - 1).join(' ');
    return [...head, tail];
  }

  return lines;
};

export const estimateGeneratedLogoLineWidth = (line: string, fontSize: number) =>
  [...line].reduce((acc, ch) => {
    if (ch === ' ') return acc + fontSize * 0.30;
    if (/[WMwm]/.test(ch)) return acc + fontSize * 0.92;
    if (/[A-Z]/.test(ch)) return acc + fontSize * 0.74;
    if (/[0-9]/.test(ch)) return acc + fontSize * 0.66;
    if (/[\-_:/'".,!?&]/.test(ch)) return acc + fontSize * 0.36;
    return acc + fontSize * 0.60;
  }, 0);

export const buildGeneratedLogoDataUrl = (title: string) => {
  const lines = splitTitleForGeneratedLogo(title);
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const width = Math.max(760, Math.round(maxLineLength * 68 + 280));
  const height = LOGO_BASE_HEIGHT;
  const aspectRatio = width / height;
  const baseFontSize = lines.length === 1 ? 172 : lines.length === 2 ? 136 : lines.length === 3 ? 108 : 86;
  const compressedFontSize = Math.max(58, Math.floor((width - 160) / Math.max(maxLineLength, 1) * 1.72));
  const preliminaryFontSize = Math.min(baseFontSize, compressedFontSize);
  const availableLineWidth = Math.max(420, width - 150);
  const longestEstimatedLineWidth = Math.max(
    ...lines.map((line) => estimateGeneratedLogoLineWidth(line, preliminaryFontSize)),
    1
  );
  const widthFitScale = Math.min(1, availableLineWidth / longestEstimatedLineWidth);
  const fontSize = Math.max(54, Math.floor(preliminaryFontSize * widthFitScale));
  const lineHeight = Math.round(fontSize * 0.96);
  const totalTextHeight = lineHeight * (lines.length - 1);
  const startY = Math.round(height / 2 - totalTextHeight / 2 + fontSize * 0.34);
  const strokeWidth = Math.max(4, Math.round(fontSize * 0.07));
  const letterSpacing = Math.max(1, Math.round(fontSize * 0.015));
  const tspans = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, fontSize);
      const textLength =
        estimatedLineWidth > availableLineWidth
          ? ` textLength="${availableLineWidth}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<tspan x="${Math.round(width / 2)}" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <filter id="logo-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
    <feFlood flood-color="#000000" flood-opacity="0.38" />
    <feComposite in2="blur" operator="in" result="shadow" />
    <feOffset in="shadow" dx="0" dy="8" result="offsetShadow" />
    <feMerge>
      <feMergeNode in="offsetShadow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
<text x="${Math.round(width / 2)}" y="${startY}" text-anchor="middle" font-family="Arial Narrow, Trebuchet MS, Arial, sans-serif" font-size="${fontSize}" font-weight="800" font-style="italic" letter-spacing="${letterSpacing}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#logo-shadow)">${tspans}</text>
</svg>`;
  return {
    dataUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    aspectRatio,
  };
};

export const buildTransparentLogoDataUrl = () =>
  `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"></svg>')}`;


export const splitTitleForPosterText = (title: string) => {
  const lines = splitTitleForGeneratedLogo(title);
  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(' ')];
};

export const buildPosterTitleSvg = (title: string, maxWidth: number) => {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const lines = splitTitleForPosterText(normalized);
  const width = Math.max(260, Math.round(maxWidth));
  const availableLineWidth = Math.max(220, width - 48);
  const maxLineLength = Math.max(...lines.map((line) => line.length), 1);
  const baseFontSize = lines.length === 1 ? 64 : 54;
  const compressedFontSize = Math.floor((availableLineWidth / Math.max(1, maxLineLength)) * 1.35);
  const preliminaryFontSize = Math.min(baseFontSize, compressedFontSize);
  const longestEstimatedLineWidth = Math.max(
    ...lines.map((line) => estimateGeneratedLogoLineWidth(line, preliminaryFontSize)),
    1
  );
  const widthFitScale = Math.min(1, availableLineWidth / longestEstimatedLineWidth);
  const fontSize = Math.max(26, Math.floor(preliminaryFontSize * widthFitScale));
  const lineHeight = Math.round(fontSize * 1.08);
  const height = Math.round(lineHeight * lines.length);
  const startY = Math.round(fontSize * 0.9);
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.1));
  const letterSpacing = Math.max(1, Math.round(fontSize * 0.015));
  const tspans = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;
      const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, fontSize);
      const textLength =
        estimatedLineWidth > availableLineWidth
          ? ` textLength="${availableLineWidth}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<tspan x="${Math.round(width / 2)}" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <filter id="poster-title-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
    <feFlood flood-color="#000000" flood-opacity="0.5" />
    <feComposite in2="blur" operator="in" result="shadow" />
    <feOffset in="shadow" dx="0" dy="6" result="offsetShadow" />
    <feMerge>
      <feMergeNode in="offsetShadow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
<text x="${Math.round(width / 2)}" y="${startY}" text-anchor="middle" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="${letterSpacing}" fill="#ffffff" stroke="rgba(0,0,0,0.65)" stroke-width="${strokeWidth}" paint-order="stroke fill" filter="url(#poster-title-shadow)">${tspans}</text>
</svg>`;
  return { svg, width, height };
};

export const buildThumbnailFallbackTitleSvg = (
  episodeCode: string,
  title: string,
  maxWidth: number
) => {
  const normalizedCode = episodeCode.replace(/\s+/g, ' ').trim();
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  if (!normalizedCode && !normalizedTitle) return null;

  const titleLines = normalizedTitle ? splitTitleForPosterText(normalizedTitle).slice(0, 2) : [];
  const width = Math.max(320, Math.round(maxWidth));
  const contentWidth = Math.max(260, width - 40);
  const codeFontSize = 22;
  const titleBaseFontSize = titleLines.length <= 1 ? 34 : 30;
  const longestTitleWidth = Math.max(
    ...titleLines.map((line) => estimateGeneratedLogoLineWidth(line, titleBaseFontSize)),
    1
  );
  const titleWidthFitScale = Math.min(1, contentWidth / longestTitleWidth);
  const titleFontSize = Math.max(20, Math.floor(titleBaseFontSize * titleWidthFitScale));
  const titleLineHeight = Math.round(titleFontSize * 1.08);
  const codeY = 32;
  const titleStartY = normalizedCode ? 62 : 36;
  const titleTspans = titleLines
    .map((line, index) => {
      const y = titleStartY + index * titleLineHeight;
      const estimatedLineWidth = estimateGeneratedLogoLineWidth(line, titleFontSize);
      const textLength =
        estimatedLineWidth > contentWidth
          ? ` textLength="${contentWidth}" lengthAdjust="spacingAndGlyphs"`
          : '';
      return `<tspan x="20" y="${y}"${textLength}>${escapeXml(line)}</tspan>`;
    })
    .join('');
  const height = Math.max(56, 28 + (normalizedCode ? 24 : 0) + titleLines.length * titleLineHeight + 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <linearGradient id="thumbnail-fallback-bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="rgba(15,23,42,0.84)" />
    <stop offset="100%" stop-color="rgba(2,6,23,0.92)" />
  </linearGradient>
  <filter id="thumbnail-fallback-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blur" />
    <feFlood flood-color="#000000" flood-opacity="0.42" />
    <feComposite in2="blur" operator="in" result="shadow" />
    <feOffset in="shadow" dx="0" dy="6" result="offsetShadow" />
    <feMerge>
      <feMergeNode in="offsetShadow" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
</defs>
<rect x="0.75" y="0.75" width="${Math.max(0, width - 1.5)}" height="${Math.max(0, height - 1.5)}" rx="18" fill="url(#thumbnail-fallback-bg)" stroke="rgba(255,255,255,0.14)" filter="url(#thumbnail-fallback-shadow)" />
${normalizedCode ? `<text x="20" y="${codeY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${codeFontSize}" font-weight="800" letter-spacing="1.4" fill="rgba(255,255,255,0.82)">${escapeXml(normalizedCode)}</text>` : ''}
${titleLines.length > 0 ? `<text x="20" y="${titleStartY}" font-family="'Noto Sans','DejaVu Sans',Arial,sans-serif" font-size="${titleFontSize}" font-weight="800" fill="#ffffff">${titleTspans}</text>` : ''}
</svg>`;
  return { svg, width, height };
};


