import type { LogoFontVariant } from '@/lib/logoFontVariant';

export const GENERATED_LOGO_FONT_VARIANTS: Array<{
  id: LogoFontVariant;
  fontFamily: string;
  fill: string;
  stroke: string;
  strokeOpacity?: number;
  weight: number;
  italic?: boolean;
  letterSpacingFactor: number;
  uppercase?: boolean;
  skewX?: number;
  topPaddingFactor?: number;
  bottomPaddingFactor?: number;
  fillMode?: 'solid' | 'gradient' | 'outline';
  gradientStops?: Array<{ offset: string; color: string }>;
  shadow?: { dy: number; stdDeviation: number; color: string; opacity: number };
}> = [
    {
      id: 'spicy-sale',
      fontFamily: "'Spicy Sale','Rubik Spray Paint','Impact',sans-serif",
      fill: '#fff7ed',
      stroke: 'rgba(190,24,93,0.92)',
      strokeOpacity: 0.92,
      weight: 400,
      letterSpacingFactor: 0.012,
      uppercase: false,
      skewX: -3,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fde68a' },
        { offset: '55%', color: '#fb7185' },
        { offset: '100%', color: '#c084fc' },
      ],
      shadow: { dy: 1, stdDeviation: 7, color: '#ec4899', opacity: 0.4 },
    },
    {
      id: 'somelist',
      fontFamily: "'Somelist','Spicy Sale','Impact',sans-serif",
      fill: '#f0fdf4',
      stroke: 'rgba(8,145,178,0.84)',
      strokeOpacity: 0.8,
      weight: 400,
      letterSpacingFactor: 0.008,
      uppercase: false,
      skewX: -1,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#bbf7d0' },
        { offset: '100%', color: '#67e8f9' },
      ],
      shadow: { dy: 0, stdDeviation: 6, color: '#22d3ee', opacity: 0.28 },
    },
    {
      id: 'rubik-spray-paint',
      fontFamily: "'Rubik Spray Paint','Dokdo','Impact',sans-serif",
      fill: '#fef08a',
      stroke: 'rgba(120,53,15,0.9)',
      weight: 400,
      letterSpacingFactor: 0.01,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fde68a' },
        { offset: '100%', color: '#f97316' },
      ],
      shadow: { dy: 3, stdDeviation: 6, color: '#fb923c', opacity: 0.32 },
    },
    {
      id: 'nabla',
      fontFamily: "'Nabla','Monoton','Impact',sans-serif",
      fill: '#ddd6fe',
      stroke: 'rgba(76,29,149,0.92)',
      weight: 400,
      letterSpacingFactor: 0.02,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#e9d5ff' },
        { offset: '100%', color: '#60a5fa' },
      ],
      shadow: { dy: 0, stdDeviation: 8, color: '#8b5cf6', opacity: 0.34 },
    },
    {
      id: 'honk',
      fontFamily: "'Honk','Nabla','Impact',sans-serif",
      fill: '#ecfccb',
      stroke: 'rgba(63,98,18,0.9)',
      weight: 400,
      letterSpacingFactor: 0.018,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#bef264' },
        { offset: '100%', color: '#22d3ee' },
      ],
      shadow: { dy: 0, stdDeviation: 8, color: '#84cc16', opacity: 0.3 },
    },
    {
      id: 'paper-scratch',
      fontFamily: "'Paper Scratch','Dokdo','Impact',sans-serif",
      fill: '#fef2f2',
      stroke: 'rgba(127,29,29,0.92)',
      weight: 400,
      letterSpacingFactor: 0.012,
      uppercase: false,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fca5a5' },
        { offset: '100%', color: '#f97316' },
      ],
      shadow: { dy: 1, stdDeviation: 5, color: '#7f1d1d', opacity: 0.34 },
    },
    {
      id: 'sludgeborn',
      fontFamily: "'Sludgeborn','Paper Scratch','Impact',sans-serif",
      fill: '#f5f3ff',
      stroke: 'rgba(88,28,135,0.94)',
      weight: 400,
      letterSpacingFactor: 0.014,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#c4b5fd' },
        { offset: '100%', color: '#f472b6' },
      ],
      shadow: { dy: 0, stdDeviation: 7, color: '#a855f7', opacity: 0.36 },
    },
    {
      id: 'playgum',
      fontFamily: "'Playgum','Somelist','Impact',sans-serif",
      fill: '#ecfeff',
      stroke: 'rgba(8,145,178,0.88)',
      weight: 400,
      letterSpacingFactor: 0.01,
      uppercase: false,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#67e8f9' },
        { offset: '100%', color: '#a78bfa' },
      ],
      shadow: { dy: 0, stdDeviation: 6, color: '#22d3ee', opacity: 0.26 },
    },
    {
      id: 'atlasmemo',
      fontFamily: "'Atlas Memo','Paper Scratch','Impact',sans-serif",
      fill: '#fdf2f8',
      stroke: 'rgba(157,23,77,0.88)',
      weight: 400,
      letterSpacingFactor: 0.008,
      uppercase: false,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#f9a8d4' },
        { offset: '100%', color: '#67e8f9' },
      ],
      shadow: { dy: 0, stdDeviation: 6, color: '#ec4899', opacity: 0.24 },
    },
    {
      id: 'dracutaz',
      fontFamily: "'Dracutaz','Sludgeborn','Impact',sans-serif",
      fill: '#f5f3ff',
      stroke: 'rgba(76,29,149,0.94)',
      weight: 400,
      letterSpacingFactor: 0.014,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#c4b5fd' },
        { offset: '100%', color: '#f472b6' },
      ],
      shadow: { dy: 0, stdDeviation: 7, color: '#a855f7', opacity: 0.36 },
    },
    {
      id: 'banana-chips',
      fontFamily: "'Banana Chips','Honk','Impact',sans-serif",
      fill: '#fffbeb',
      stroke: 'rgba(133,77,14,0.9)',
      weight: 400,
      letterSpacingFactor: 0.014,
      uppercase: true,
      skewX: -2,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#fde68a' },
        { offset: '100%', color: '#fb7185' },
      ],
      shadow: { dy: 1, stdDeviation: 7, color: '#f59e0b', opacity: 0.34 },
    },
    {
      id: 'holy-star',
      fontFamily: "'Holy Star','Playgum','Impact',sans-serif",
      fill: '#f8fafc',
      stroke: 'rgba(8,47,73,0.9)',
      weight: 400,
      letterSpacingFactor: 0.022,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#67e8f9' },
        { offset: '100%', color: '#c084fc' },
      ],
      shadow: { dy: 0, stdDeviation: 8, color: '#38bdf8', opacity: 0.32 },
    },
    {
      id: 'rocks-serif',
      fontFamily: "'Rocks Serif','Dracutaz','Impact',sans-serif",
      fill: '#faf5ff',
      stroke: 'rgba(88,28,135,0.92)',
      weight: 400,
      letterSpacingFactor: 0.012,
      uppercase: true,
      fillMode: 'gradient',
      gradientStops: [
        { offset: '0%', color: '#d8b4fe' },
        { offset: '100%', color: '#f472b6' },
      ],
      shadow: { dy: 1, stdDeviation: 6, color: '#a855f7', opacity: 0.3 },
    },
  ];


