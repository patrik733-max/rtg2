import type { StreamBadgesSetting, QualityBadgesSide, PosterQualityBadgesPosition, VerticalBadgeContent, AiometadataEpisodeProvider, ProxySeriesMetadataProvider, ProxyEpisodeProvider, ProxyType } from '@/components/workspace-page-view';

export const PROXY_TYPES: ProxyType[] = ['poster', 'backdrop', 'logo', 'thumbnail'];
export const STREAM_BADGE_OPTIONS: Array<{ id: StreamBadgesSetting; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
];
export const QUALITY_BADGE_SIDE_OPTIONS: Array<{ id: QualityBadgesSide; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
export const POSTER_QUALITY_BADGE_POSITION_OPTIONS: Array<{
  id: PosterQualityBadgesPosition;
  label: string;
}> = [
  { id: 'auto', label: 'Auto' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
export const VERTICAL_BADGE_CONTENT_OPTIONS: Array<{ id: VerticalBadgeContent; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'stacked', label: 'Stacked' },
];
export const AIOMETADATA_EPISODE_PROVIDER_OPTIONS: Array<{ id: AiometadataEpisodeProvider; label: string }> = [
  { id: 'realimdb', label: 'IMDb' },
  { id: 'tvdb', label: 'TVDB' },
];
export const PROXY_SERIES_METADATA_PROVIDER_OPTIONS: Array<{ id: ProxySeriesMetadataProvider; label: string }> = [
  { id: 'tmdb', label: 'TMDB' },
  { id: 'imdb', label: 'IMDb' },
];
export const PROXY_EPISODE_PROVIDER_OPTIONS: Array<{ id: ProxyEpisodeProvider; label: string }> = [
  { id: 'realimdb', label: 'IMDb' },
  { id: 'tvdb', label: 'TVDB' },
  { id: 'custom', label: 'Custom' },
];
export const INPUT_CLASS =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 focus:border-orange-400/50 focus:bg-white/[0.07] focus:shadow-[0_0_0_1px_rgba(249,115,22,0.16)]';
export const INPUT_COMPACT_CLASS =
  'rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 focus:border-orange-400/50 focus:bg-white/[0.07]';
export const SEGMENT_CLASS =
  'flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
export const INNER_PANEL_CLASS =
  'rounded-[22px] border border-white/10 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
export const CODE_PANEL_CLASS =
  'rounded-[22px] border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
export const CONFIG_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
export const PREVIEW_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
export const AUX_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
export const PROXY_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';

export const isCinemetaManifestUrl = (value: string) => {
  try {
    return /(^|[-.])cinemeta\.strem\.io$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
};
