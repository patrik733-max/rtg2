'use client';
import Link from 'next/link';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type Dispatch,
  type MouseEvent,
  type RefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { ProxyCatalogDescriptor } from '@/lib/proxyCatalog';
import type { SupportedLanguage } from '@/lib/tmdbLanguage';
import {
  ArrowLeft,
  Image as ImageIcon,
  Star,
  Settings2,
  Globe2,
  Layers,
  Code2,
  Terminal,
  ExternalLink,
  Zap,
  ChevronRight,
  Hash,
  MonitorPlay,
  Bot,
  Clipboard,
  Check,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  RefreshCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import type { RatingPreference } from '@/lib/ratingPreferences';
import type { RatingProviderRow } from '@/lib/ratingRows';
import { RatingProviderSortableList } from '@/components/rating-provider-sortable-list';
import {
  BACKDROP_RATING_LAYOUT_OPTIONS,
  type BackdropRatingLayout,
} from '@/lib/backdropRatingLayout';
import {
  THUMBNAIL_RATING_LAYOUT_OPTIONS,
  type ThumbnailRatingLayout,
} from '@/lib/thumbnailRatingLayout';
import {
  THUMBNAIL_SIZE_OPTIONS,
  type ThumbnailSize,
} from '@/lib/thumbnailSize';
import {
  BACKDROP_RATINGS_SIZE_OPTIONS,
  type BackdropRatingsSize,
} from '@/lib/backdropRatingsSize';
import {
  POSTER_RATING_LAYOUT_OPTIONS,
  isVerticalPosterRatingLayout,
  type PosterRatingLayout,
} from '@/lib/posterRatingLayout';
import {
  RATING_STYLE_OPTIONS,
  type RatingStyle,
} from '@/lib/ratingStyle';
import {
  LOGO_MODE_OPTIONS,
  type LogoMode,
} from '@/lib/logoMode';
import {
  LOGO_FONT_VARIANT_OPTIONS,
  type LogoFontVariant,
} from '@/lib/logoFontVariant';
import {
  DEFAULT_LOGO_CUSTOM_PRIMARY,
  DEFAULT_LOGO_CUSTOM_SECONDARY,
  DEFAULT_LOGO_CUSTOM_OUTLINE,
} from '@/lib/logoCustomColors';
import { LOGO_COLOR_PRESETS } from '@/lib/logoColorPresets';

type PreviewType = 'poster' | 'backdrop' | 'logo' | 'thumbnail';
export type ProxyType = PreviewType;
export type ProxyEnabledTypes = Record<ProxyType, boolean>;
export type StreamBadgesSetting = 'auto' | 'on' | 'off';
export type QualityBadgesSide = 'left' | 'right';
export type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
export type AiometadataPatternType = 'poster' | 'background' | 'logo' | 'episodeThumbnail';
export type AiometadataEpisodeProvider = 'tvdb' | 'realimdb';
export type ProxySeriesMetadataProvider = 'tmdb' | 'imdb';
export type ProxyEpisodeProvider = 'custom' | 'realimdb' | 'tvdb';
export type VerticalBadgeContent = 'standard' | 'stacked';

type HomePageViewState = {
  previewType: PreviewType;
  mediaId: string;
  lang: string;
  posterLang: string;
  posterAnimeLang: string;
  backdropLang: string;
  backdropAnimeLang: string;
  logoLang: string;
  logoAnimeLang: string;
  posterAnimeImageText: 'default' | 'clean' | 'alternative';
  backdropAnimeImageText: 'default' | 'clean' | 'alternative';
  supportedLanguages: SupportedLanguage[];
  tmdbKey: string;
  mdblistKey: string;
  simklClientId: string;
  proxyManifestUrl: string;
  proxyCatalogs: ProxyCatalogDescriptor[];
  proxyCatalogNames: Record<string, string>;
  proxyHiddenCatalogs: string[];
  proxySearchDisabledCatalogs: string[];
  proxyDiscoverOnlyCatalogs: Record<string, boolean>;
  proxyCatalogsStatus: 'idle' | 'loading' | 'ready' | 'error';
  proxyCatalogsError: string;
  proxySeriesMetadataProvider: ProxySeriesMetadataProvider;
  proxyAiometadataProvider: ProxyEpisodeProvider;
  proxyEnabledTypes: ProxyEnabledTypes;
  proxyTranslateMeta: boolean;
  exportStatus: 'idle' | 'with' | 'without';
  importStatus: 'idle' | 'success' | 'error';
  importMessage: string;
  posterRatingsLayout: PosterRatingLayout;
  posterRatingsMaxPerSide: number | null;
  logoRatingsMax: number | null;
  logoMode: LogoMode;
  logoFontVariant: LogoFontVariant;
  logoCustomPrimary: string;
  logoCustomSecondary: string;
  logoCustomOutline: string;
  backdropRatingsLayout: BackdropRatingLayout;
  backdropRatingsSize: BackdropRatingsSize;
  thumbnailRatingsLayout: ThumbnailRatingLayout;
  posterVerticalBadgeContent: VerticalBadgeContent;
  backdropVerticalBadgeContent: VerticalBadgeContent;
  thumbnailVerticalBadgeContent: VerticalBadgeContent;
  thumbnailSize: ThumbnailSize;
  qualityBadgesSide: QualityBadgesSide;
  posterQualityBadgesPosition: PosterQualityBadgesPosition;
  proxyCopied: boolean;
  copied: boolean;
  aiometadataCopiedType: AiometadataPatternType | null;
  aiometadataEpisodeProvider: AiometadataEpisodeProvider;
  activeToken: string | null;
  configSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
};

type HomePageViewDerived = {
  baseUrl: string;
  previewUrl: string;
  proxyUrl: string;
  currentVersion: string;
  githubPackageVersion: string | null;
  repoUrl: string | null;
  previewNotice: string | null;
  canGenerateProxy: boolean;
  isProxyUrlVisible: boolean;
  displayedProxyUrl: string;
  styleLabel: string;
  textLabel: string;
  providersLabel: string;
  activeRatingStyle: RatingStyle;
  activeImageText: 'default' | 'clean' | 'alternative';
  ratingProviderRows: RatingProviderRow[];
  shouldShowQualityBadgesPosition: boolean;
  shouldShowQualityBadgesSide: boolean;
  qualityBadgeTypeLabel: string;
  activeStreamBadges: StreamBadgesSetting;
  activeQualityBadgesStyle: RatingStyle;
  aiometadataPatterns: Record<AiometadataPatternType, string>;
};

type HomePageViewActions = {
  handleAnchorClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  handleExportConfig: (includeKeys: boolean) => void;
  handleImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  handleImportConfigString: (value: string) => void;
  handleCopyProxy: () => void;
  handleCopyPrompt: () => void;
  handleCopyAiometadataPattern: (type: AiometadataPatternType) => void;
  setPreviewType: Dispatch<SetStateAction<PreviewType>>;
  setMediaId: Dispatch<SetStateAction<string>>;
  setLang: Dispatch<SetStateAction<string>>;
  setPosterLang: Dispatch<SetStateAction<string>>;
  setPosterAnimeLang: Dispatch<SetStateAction<string>>;
  setBackdropLang: Dispatch<SetStateAction<string>>;
  setBackdropAnimeLang: Dispatch<SetStateAction<string>>;
  setLogoLang: Dispatch<SetStateAction<string>>;
  setLogoAnimeLang: Dispatch<SetStateAction<string>>;
  setPosterAnimeImageText: Dispatch<SetStateAction<'default' | 'clean' | 'alternative'>>;
  setBackdropAnimeImageText: Dispatch<SetStateAction<'default' | 'clean' | 'alternative'>>;
  setTmdbKey: Dispatch<SetStateAction<string>>;
  setMdblistKey: Dispatch<SetStateAction<string>>;
  setSimklClientId: Dispatch<SetStateAction<string>>;
  setPosterRatingsLayout: Dispatch<SetStateAction<PosterRatingLayout>>;
  setPosterRatingsMaxPerSide: Dispatch<SetStateAction<number | null>>;
  setLogoRatingsMax: Dispatch<SetStateAction<number | null>>;
  setLogoMode: Dispatch<SetStateAction<LogoMode>>;
  setLogoFontVariant: Dispatch<SetStateAction<LogoFontVariant>>;
  setLogoCustomPrimary: Dispatch<SetStateAction<string>>;
  setLogoCustomSecondary: Dispatch<SetStateAction<string>>;
  setLogoCustomOutline: Dispatch<SetStateAction<string>>;
  setBackdropRatingsLayout: Dispatch<SetStateAction<BackdropRatingLayout>>;
  setBackdropRatingsSize: Dispatch<SetStateAction<BackdropRatingsSize>>;
  setThumbnailRatingsLayout: Dispatch<SetStateAction<ThumbnailRatingLayout>>;
  setPosterVerticalBadgeContent: Dispatch<SetStateAction<VerticalBadgeContent>>;
  setBackdropVerticalBadgeContent: Dispatch<SetStateAction<VerticalBadgeContent>>;
  setThumbnailVerticalBadgeContent: Dispatch<SetStateAction<VerticalBadgeContent>>;
  setThumbnailSize: Dispatch<SetStateAction<ThumbnailSize>>;
  setAiometadataEpisodeProvider: Dispatch<SetStateAction<AiometadataEpisodeProvider>>;
  setProxySeriesMetadataProvider: Dispatch<SetStateAction<ProxySeriesMetadataProvider>>;
  setProxyAiometadataProvider: Dispatch<SetStateAction<ProxyEpisodeProvider>>;
  setPosterQualityBadgesPosition: Dispatch<SetStateAction<PosterQualityBadgesPosition>>;
  setQualityBadgesSide: Dispatch<SetStateAction<QualityBadgesSide>>;
  setRatingStyleForType: (value: RatingStyle) => void;
  setImageTextForType: (value: 'default' | 'clean' | 'alternative') => void;
  setActiveStreamBadges: Dispatch<SetStateAction<StreamBadgesSetting>>;
  setActiveQualityBadgesStyle: Dispatch<SetStateAction<RatingStyle>>;
  toggleRatingPreference: (rating: RatingPreference) => void;
  enableAllRatingPreferences: () => void;
  disableAllRatingPreferences: () => void;
  reorderRatingPreference: (fromIndex: number, toIndex: number) => void;
  updateProxyManifestUrl: (value: string) => void;
  updateProxyCatalogName: (key: string, value: string) => void;
  toggleProxyCatalogHidden: (key: string) => void;
  toggleProxyCatalogSearchDisabled: (key: string) => void;
  setProxyCatalogDiscoverOnly: (key: string, enabled: boolean) => void;
  resetProxyCatalogNames: () => void;
  resetProxyCatalogCustomizations: () => void;
  toggleProxyEnabledType: (type: ProxyType) => void;
  toggleProxyTranslateMeta: () => void;
  toggleProxyUrlVisibility: () => void;
  handleTokenDisconnect: () => void;
  handleSaveConfig: () => void;
};

import { WorkspaceNav } from './workspace/workspace-nav';
import { WorkspaceControlsPanel } from './workspace/workspace-controls-panel';
import { WorkspacePreviewPanel } from './workspace/workspace-preview-panel';
import { WorkspaceProxyPanel } from './workspace/workspace-proxy-panel';
import { WorkspaceModals } from './workspace/workspace-modals';
export type HomePageViewProps = {
  mode?: 'landing' | 'workspace';
  refs: {
    navRef: RefObject<HTMLElement | null>;
  };
  state: HomePageViewState;
  derived: HomePageViewDerived;
  actions: HomePageViewActions;
};

const PROXY_TYPES: ProxyType[] = ['poster', 'backdrop', 'logo', 'thumbnail'];
const STREAM_BADGE_OPTIONS: Array<{ id: StreamBadgesSetting; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'on', label: 'On' },
  { id: 'off', label: 'Off' },
];
const QUALITY_BADGE_SIDE_OPTIONS: Array<{ id: QualityBadgesSide; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
];
const POSTER_QUALITY_BADGE_POSITION_OPTIONS: Array<{
  id: PosterQualityBadgesPosition;
  label: string;
}> = [
    { id: 'auto', label: 'Auto' },
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
  ];
const VERTICAL_BADGE_CONTENT_OPTIONS: Array<{ id: VerticalBadgeContent; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'stacked', label: 'Stacked' },
];
const AIOMETADATA_EPISODE_PROVIDER_OPTIONS: Array<{ id: AiometadataEpisodeProvider; label: string }> = [
  { id: 'realimdb', label: 'IMDb' },
  { id: 'tvdb', label: 'TVDB' },
];
const PROXY_SERIES_METADATA_PROVIDER_OPTIONS: Array<{ id: ProxySeriesMetadataProvider; label: string }> = [
  { id: 'tmdb', label: 'TMDB' },
  { id: 'imdb', label: 'IMDb' },
];
const PROXY_EPISODE_PROVIDER_OPTIONS: Array<{ id: ProxyEpisodeProvider; label: string }> = [
  { id: 'realimdb', label: 'IMDb' },
  { id: 'tvdb', label: 'TVDB' },
  { id: 'custom', label: 'Custom' },
];
const INPUT_CLASS =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 focus:border-orange-400/50 focus:bg-white/[0.07] focus:shadow-[0_0_0_1px_rgba(249,115,22,0.16)]';
const INPUT_COMPACT_CLASS =
  'rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 focus:border-orange-400/50 focus:bg-white/[0.07]';
const SEGMENT_CLASS =
  'flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
const INNER_PANEL_CLASS =
  'rounded-[22px] border border-white/10 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const CODE_PANEL_CLASS =
  'rounded-[22px] border border-white/10 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
const CONFIG_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
const PREVIEW_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
const AUX_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
const PROXY_PANEL_CLASS =
  'relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02] shadow-[0_34px_100px_-60px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl';
const isCinemetaManifestUrl = (value: string) => {
  try {
    return /(^|[-.])cinemeta\.strem\.io$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

export function WorkspacePageView({ refs, state, derived, actions }: HomePageViewProps) {
  const { navRef } = refs;
  const {
    previewType,
    mediaId,
    lang,
    posterLang,
    posterAnimeLang,
    backdropLang,
    backdropAnimeLang,
    logoLang,
    logoAnimeLang,
    posterAnimeImageText,
    backdropAnimeImageText,
    supportedLanguages,
    tmdbKey,
    mdblistKey,
    simklClientId,
    proxyManifestUrl,
    proxyCatalogs,
    proxyCatalogNames,
    proxyHiddenCatalogs,
    proxySearchDisabledCatalogs,
    proxyDiscoverOnlyCatalogs,
    proxyCatalogsStatus,
    proxyCatalogsError,
    proxySeriesMetadataProvider,
    proxyAiometadataProvider,
    proxyEnabledTypes,
    proxyTranslateMeta,
    exportStatus,
    importStatus,
    importMessage,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    logoRatingsMax,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    backdropRatingsLayout,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    posterVerticalBadgeContent,
    backdropVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    thumbnailSize,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    proxyCopied,
    copied,
    aiometadataCopiedType,
    aiometadataEpisodeProvider,
  } = state;
  const {
    baseUrl,
    previewUrl,
    proxyUrl,
    previewNotice,
    canGenerateProxy,
    isProxyUrlVisible,
    displayedProxyUrl,
    styleLabel,
    textLabel,
    providersLabel,
    activeRatingStyle,
    activeImageText,
    ratingProviderRows,
    shouldShowQualityBadgesPosition,
    shouldShowQualityBadgesSide,
    qualityBadgeTypeLabel,
    activeStreamBadges,
    activeQualityBadgesStyle,
    aiometadataPatterns,
  } = derived;
  const {
    handleExportConfig,
    handleImportFile,
    handleImportConfigString,
    handleCopyProxy,
    handleCopyPrompt,
    handleCopyAiometadataPattern,
    setPreviewType,
    setMediaId,
    setLang,
    setPosterLang,
    setPosterAnimeLang,
    setBackdropLang,
    setBackdropAnimeLang,
    setLogoLang,
    setLogoAnimeLang,
    setPosterAnimeImageText,
    setBackdropAnimeImageText,
    setTmdbKey,
    setMdblistKey,
    setSimklClientId,
    setPosterRatingsLayout,
    setPosterRatingsMaxPerSide,
    setLogoRatingsMax,
    setLogoMode,
    setLogoFontVariant,
    setLogoCustomPrimary,
    setLogoCustomSecondary,
    setLogoCustomOutline,
    setBackdropRatingsLayout,
    setBackdropRatingsSize,
    setThumbnailRatingsLayout,
    setPosterVerticalBadgeContent,
    setBackdropVerticalBadgeContent,
    setThumbnailVerticalBadgeContent,
    setThumbnailSize,
    setAiometadataEpisodeProvider,
    setProxySeriesMetadataProvider,
    setProxyAiometadataProvider,
    setPosterQualityBadgesPosition,
    setQualityBadgesSide,
    setRatingStyleForType,
    setImageTextForType,
    setActiveStreamBadges,
    setActiveQualityBadgesStyle,
    toggleRatingPreference,
    enableAllRatingPreferences,
    disableAllRatingPreferences,
    reorderRatingPreference,
    updateProxyManifestUrl,
    updateProxyCatalogName,
    toggleProxyCatalogHidden,
    toggleProxyCatalogSearchDisabled,
    setProxyCatalogDiscoverOnly,
    resetProxyCatalogCustomizations,
    toggleProxyEnabledType,
    toggleProxyTranslateMeta,
    toggleProxyUrlVisibility,
    handleTokenDisconnect,
    handleSaveConfig,
  } = actions;
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isAiometadataModalOpen, setIsAiometadataModalOpen] = useState(false);
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const handleHorizontalScrollWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;

    if (!hasHorizontalOverflow) {
      return;
    }

    const scrollDelta = event.deltaX !== 0 ? event.deltaX : event.deltaY;

    if (scrollDelta === 0) {
      return;
    }

    event.preventDefault();
    container.scrollLeft += scrollDelta;
  };

  const handlePasteOldConfigString = () => {
    const pastedValue = window.prompt('Paste an old ERDB configuration or a proxy URL');
    if (!pastedValue?.trim()) {
      return;
    }

    handleImportConfigString(pastedValue);
  };

  return (
    <>
    <div className="relative min-h-screen bg-[#06070b] text-slate-200 selection:bg-orange-400/30 font-[var(--font-body)] xl:h-screen xl:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_60%)] blur-3xl" />
        <div className="absolute right-[-220px] top-40 h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.12),_transparent_60%)] blur-3xl" />
        <div className="absolute left-[-180px] bottom-[-140px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(20,184,166,0.12),_transparent_60%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(255,255,255,0.025),_rgba(255,255,255,0)_40%,_rgba(255,255,255,0.02)_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1840px] flex-col px-3 py-3 sm:px-4 sm:py-4 xl:h-full xl:min-h-0">
        <WorkspaceNav refs={refs} state={state} derived={derived} actions={actions} onOpenRotateModal={() => setIsRotateModalOpen(true)} />

        <main className="mx-auto flex w-full flex-col pb-6 pt-3 xl:flex-1 xl:min-h-0 xl:overflow-hidden xl:pb-0">
          <section id="preview" className="relative flex flex-col overflow-visible xl:min-h-0 xl:flex-1 xl:overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 gap-4 xl:premium-scrollbar xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1.28fr)_minmax(0,0.88fr)] xl:items-stretch">
              <WorkspaceControlsPanel state={state} derived={derived} actions={actions} />
              <WorkspacePreviewPanel state={state} derived={derived} />
              <WorkspaceProxyPanel state={state} derived={derived} actions={actions} onOpenAiometadataModal={() => setIsAiometadataModalOpen(true)} onOpenCatalogModal={() => setIsCatalogModalOpen(true)} />
            </div>
          </section>
        </main>

        <footer className="hidden border-t border-white/5 py-8 bg-[#080808]">
          <div className="w-full mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Star className="w-4 h-4" />
              <span className="text-sm font-[var(--font-display)] tracking-tight text-white">ERDB Stateless Engine</span>
            </div>
            <p className="text-sm text-slate-500">
              (c) 2026 ERDB Project. Modern imagery for modern addons.
            </p>
          </div>
        </footer>
        <WorkspaceModals 
          state={state} 
          actions={actions} 
          derived={derived} 
          isCatalogModalOpen={isCatalogModalOpen} 
          setIsCatalogModalOpen={setIsCatalogModalOpen} 
          isAiometadataModalOpen={isAiometadataModalOpen} 
          setIsAiometadataModalOpen={setIsAiometadataModalOpen} 
          isRotateModalOpen={isRotateModalOpen} 
          setIsRotateModalOpen={setIsRotateModalOpen} 
        />
      </div>
    </div>
    </>
  );
}