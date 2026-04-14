'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, MouseEvent, RefObject, SetStateAction } from 'react';
import type { ProxyCatalogDescriptor } from '@/lib/proxyCatalog';
import type { SupportedLanguage } from '@/lib/tmdbLanguage';
import { Code2, Settings2, Sparkles, Star, Users, Workflow } from 'lucide-react';
import type { RatingPreference } from '@/lib/ratingPreferences';
import type { RatingProviderRow } from '@/lib/ratingRows';
import type { BackdropRatingLayout } from '@/lib/backdropRatingLayout';
import type { ThumbnailRatingLayout } from '@/lib/thumbnailRatingLayout';
import type { ThumbnailSize } from '@/lib/thumbnailSize';
import type { BackdropRatingsSize } from '@/lib/backdropRatingsSize';
import type { PosterRatingLayout } from '@/lib/posterRatingLayout';
import type { RatingStyle } from '@/lib/ratingStyle';
import type { LogoMode } from '@/lib/logoMode';
import type { LogoFontVariant } from '@/lib/logoFontVariant';

type PreviewType = 'poster' | 'backdrop' | 'logo' | 'thumbnail';
type ProxyType = PreviewType;
type ProxyEnabledTypes = Record<ProxyType, boolean>;
type StreamBadgesSetting = 'auto' | 'on' | 'off';
type QualityBadgesSide = 'left' | 'right';
type PosterQualityBadgesPosition = 'auto' | QualityBadgesSide;
type AiometadataPatternType = 'poster' | 'background' | 'logo' | 'episodeThumbnail';
type AiometadataEpisodeProvider = 'tvdb' | 'realimdb';
type ProxySeriesMetadataProvider = 'tmdb' | 'imdb';
type ProxyEpisodeProvider = 'custom' | 'realimdb' | 'tvdb';
type VerticalBadgeContent = 'standard' | 'stacked';

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
  fanartKey: string;
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
  backdropRatingsMax: number | null;
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
  userCount: number | null;
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
  setFanartKey: Dispatch<SetStateAction<string>>;
  setPosterRatingsLayout: Dispatch<SetStateAction<PosterRatingLayout>>;
  setPosterRatingsMaxPerSide: Dispatch<SetStateAction<number | null>>;
  setLogoRatingsMax: Dispatch<SetStateAction<number | null>>;
  setLogoMode: Dispatch<SetStateAction<LogoMode>>;
  setLogoFontVariant: Dispatch<SetStateAction<LogoFontVariant>>;
  setLogoCustomPrimary: Dispatch<SetStateAction<string>>;
  setLogoCustomSecondary: Dispatch<SetStateAction<string>>;
  setLogoCustomOutline: Dispatch<SetStateAction<string>>;
  setBackdropRatingsLayout: Dispatch<SetStateAction<BackdropRatingLayout>>;
  setBackdropRatingsMax: Dispatch<SetStateAction<number | null>>;
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

export type HomePageViewProps = {
  refs: {
    navRef: RefObject<HTMLElement | null>;
  };
  state: HomePageViewState;
  derived: HomePageViewDerived;
  actions: HomePageViewActions;
};

function AnimatedCounter({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      return;
    }
    const duration = 1200;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target]);

  return <>{target === 0 ? 0 : display}</>;
}

export function HomePageView({ refs, derived }: HomePageViewProps) {
  const { navRef } = refs;
  const { currentVersion, githubPackageVersion, repoUrl, userCount } = derived;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06070b] text-slate-200 selection:bg-orange-400/30 font-[var(--font-body)]">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-220px] top-40 h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(14,165,233,0.12),_transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute left-[-180px] bottom-[-140px] h-[420px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(20,184,166,0.12),_transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,_rgba(255,255,255,0.025),_rgba(255,255,255,0)_40%,_rgba(255,255,255,0.02)_100%)]" />

      <div className="relative mx-auto w-full max-w-[1840px]">
        <nav
          ref={navRef}
          className="sticky top-3 z-50 mx-3 mt-3 rounded-[28px] border border-white/10 bg-[#06070b]/72 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:mx-4 sm:mt-4"
        >
          <div className="mx-auto grid w-full grid-cols-1 gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-300 via-amber-300 to-red-500 shadow-[0_14px_30px_-14px_rgba(249,115,22,0.75)] ring-1 ring-white/20">
                <Star className="h-5 w-5 fill-white text-white" />
              </div>
              <div className="leading-tight">
                <span className="block font-[var(--font-display)] text-lg tracking-tight text-white">ERDB</span>
                <span className="block text-[10px] uppercase tracking-[0.36em] text-orange-300/90">Signature Workspace</span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 lg:items-center">
              <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-orange-100">Home</span>
                <Link href="/configurator" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.07] hover:text-white">Workspace</Link>
                <Link href="/docs" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.07] hover:text-white">API Docs</Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-center">
              <div className={`rounded-full border px-3 py-2 text-[10px] normal-case tracking-normal shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${githubPackageVersion && githubPackageVersion !== currentVersion ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}>
                Current Version: v{currentVersion}
              </div>
              {githubPackageVersion && (
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] normal-case tracking-normal text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  Latest Version: v{githubPackageVersion}
                </div>
              )}
              <a
                href={repoUrl || 'https://github.com/realbestia1/erdb'}
                className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] text-slate-100 transition-colors hover:bg-white/10"
              >
                GitHub
              </a>
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full px-6 py-16 space-y-16">
          <section className="relative mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-orange-300" />
                Stateless Media Layer
              </div>
              <h1 className="text-4xl leading-tight text-white md:text-6xl font-[var(--font-display)]">
                Easy Ratings Database.
                <span className="mt-2 block text-2xl text-slate-300 md:text-3xl font-[var(--font-body)]">
                  Design-Grade Ratings,
                </span>
                <span className="block bg-gradient-to-r from-orange-300 via-amber-300 to-teal-300 bg-clip-text text-transparent">
                  Without the State.
                </span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-400">
                Generate expressive posters, backdrops, logos, and thumbnails for addons in real time.
                The interactive configurator and proxy builder now live in a dedicated fullscreen workspace.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/configurator" className="rounded-full bg-white px-6 py-3 font-semibold text-black transition-colors hover:bg-slate-100">
                  Open Configurator
                </Link>
                <Link href="/docs" className="rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 font-semibold text-white transition-colors hover:bg-white/10">
                  Read API Docs
                </Link>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                  Token-based workspace access
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
                  Saved server-side layouts
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                  Proxy-ready for addons
                </div>
              </div>

              {userCount !== null && (
                <div className="inline-flex items-center gap-3 rounded-2xl border border-teal-400/20 bg-teal-500/[0.06] px-5 py-3 shadow-[0_0_24px_-8px_rgba(20,184,166,0.25)] backdrop-blur-sm">
                  <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-teal-400/10">
                    <Users className="h-3.5 w-3.5 text-teal-300" />
                    <span className="absolute right-0.5 top-0.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-400" />
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-teal-400/70">Active Users</div>
                    <div className="text-lg font-bold leading-tight text-teal-200">
                      <AnimatedCounter target={userCount} />
                      <span className="ml-1 text-sm font-normal text-teal-300/60">+</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-[0_35px_90px_-70px_rgba(0,0,0,0.8)]">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-400">
                  <span>Workspace</span>
                  <span className="text-teal-300">Dedicated</span>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0b0f15]/80 p-4">
                    <div className="text-xs text-slate-400">Configurator</div>
                    <div className="mt-1 text-sm font-semibold text-white">Fullscreen editing with internal panel scroll</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0b0f15]/80 p-4">
                    <div className="text-xs text-slate-400">Addon Proxy</div>
                    <div className="mt-1 text-sm font-semibold text-white">Manifest rewrite flow separated from the landing page</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0b0f15]/80 p-4">
                    <div className="text-xs text-slate-400">Live Output</div>
                    <div className="mt-1 text-sm font-semibold text-white">Preview, proxy URL, and AiOMetadata patterns in one workspace</div>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-6">
                <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Highlights</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div>Cleaner landing page focused on product overview.</div>
                  <div>Dedicated route for configuration and proxy setup.</div>
                  <div>Better full screen experience for long configuration panels.</div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-3">
                  <Settings2 className="h-5 w-5 text-orange-300" />
                </div>
                <h2 className="text-xl text-white font-[var(--font-display)]">Dedicated Configurator</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Layout, ratings, badges, language, import/export, and live preview have been moved out of the home page.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 inline-flex rounded-2xl bg-sky-500/10 p-3">
                  <Workflow className="h-5 w-5 text-sky-300" />
                </div>
                <h2 className="text-xl text-white font-[var(--font-display)]">Proxy Workspace</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Source manifest input, catalog customization, provider selection, and generated proxy manifest now live in the fullscreen workspace.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-4 inline-flex rounded-2xl bg-teal-500/10 p-3">
                  <Code2 className="h-5 w-5 text-teal-300" />
                </div>
                <h2 className="text-xl text-white font-[var(--font-display)]">Faster Entry Point</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  The landing now introduces ERDB quickly and sends users straight to the right place: configurator or docs.
                </p>
              </div>
            </div>

          </section>
        </main>

        <footer className="mx-3 mb-6 rounded-[28px] border border-white/10 bg-[#06070b]/72 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl sm:mx-4 sm:mb-8">
          <div className="mx-auto flex w-full flex-col items-center justify-between gap-4 px-6 py-4 md:flex-row">
            <div className="flex items-center gap-2 text-slate-500">
              <Star className="h-4 w-4" />
              <span className="text-sm tracking-tight text-white font-[var(--font-display)]">ERDB Stateless Engine</span>
            </div>
            <p className="text-sm text-slate-500">
              (c) 2026 ERDB Project. Modern imagery for modern addons.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
