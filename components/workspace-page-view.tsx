'use client';
import Link from 'next/link';
import { useEffect, useState, type WheelEvent as ReactWheelEvent } from 'react';
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
import type { HomePageViewProps } from '@/components/workspace/types';
import { WorkspaceNav } from './workspace/workspace-nav';
import { WorkspaceControlsPanel } from './workspace/workspace-controls-panel';
import { WorkspacePreviewPanel } from './workspace/workspace-preview-panel';
import { WorkspaceProxyPanel } from './workspace/workspace-proxy-panel';
import { WorkspaceModals } from './workspace/workspace-modals';
export type { HomePageViewProps } from '@/components/workspace/types';

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
    fanartKey,
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
    ranking,
    rankingCountry,
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
    setFanartKey,
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
    setRanking,
    setRankingCountry,
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
              <div className="relative z-10 flex flex-col gap-4 xl:premium-scrollbar xl:min-h-0 xl:flex-1 xl:overflow-hidden xl:grid xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1.28fr)_minmax(0,0.88fr)] xl:items-stretch">
                <WorkspacePreviewPanel state={state} derived={derived} />
                <WorkspaceControlsPanel state={state} derived={derived} actions={actions} />
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
