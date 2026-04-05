'use client';

import { Terminal, Layers, EyeOff, Eye, Check, Clipboard, ExternalLink } from 'lucide-react';
import type { HomePageViewProps } from '@/components/workspace-page-view';
import {
  INPUT_CLASS,
  INNER_PANEL_CLASS,
  CODE_PANEL_CLASS,
  PROXY_PANEL_CLASS,
  AUX_PANEL_CLASS,
  PROXY_TYPES,
  PROXY_SERIES_METADATA_PROVIDER_OPTIONS,
  PROXY_EPISODE_PROVIDER_OPTIONS,
  isCinemetaManifestUrl,
} from './constants';

type WorkspaceProxyPanelProps = Pick<HomePageViewProps, 'state' | 'derived' | 'actions'> & {
  onOpenAiometadataModal: () => void;
  onOpenCatalogModal: () => void;
};

export function WorkspaceProxyPanel({ state, derived, actions, onOpenAiometadataModal, onOpenCatalogModal }: WorkspaceProxyPanelProps) {
  const {
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
    proxyCopied,
  } = state;

  const {
    proxyUrl,
    canGenerateProxy,
    isProxyUrlVisible,
    displayedProxyUrl,
  } = derived;

  const {
    updateProxyManifestUrl,
    toggleProxyEnabledType,
    toggleProxyTranslateMeta,
    setProxySeriesMetadataProvider,
    setProxyAiometadataProvider,
    toggleProxyUrlVisibility,
    handleCopyProxy,
  } = actions;

  const normalizedProxyManifestUrl = proxyManifestUrl.trim().toLowerCase();
  const isAiometadataProxyManifest = normalizedProxyManifestUrl.includes('aiometadata');
  const isCinemetaProxyManifest = isCinemetaManifestUrl(proxyManifestUrl.trim());
  const canConfigureCatalogs =
    Boolean(normalizedProxyManifestUrl) &&
    normalizedProxyManifestUrl !== 'http://' &&
    normalizedProxyManifestUrl !== 'https://';
    
  const customizedCatalogCount = Object.keys(proxyCatalogNames).length;
  const hiddenCatalogCount = proxyHiddenCatalogs.length;
  const searchDisabledCatalogCount = proxySearchDisabledCatalogs.length;
  const discoverOnlyCatalogCount = proxyCatalogs.filter(
    (catalog) => (proxyDiscoverOnlyCatalogs[catalog.key] ?? catalog.discoverOnly) === true
  ).length;

  return (
    <div className="min-w-0 w-full flex flex-col xl:self-stretch xl:h-full xl:overflow-hidden">
      
      {/* Proxy Settings Panel */}
      <div id="proxy" className={`${PROXY_PANEL_CLASS} flex flex-col flex-1 shrink-0 overflow-hidden`}>
        <div className="shrink-0 p-5 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20">
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <h2 className="text-sm font-medium text-white tracking-wide">Addon Proxy</h2>
          </div>
          <p className="text-xs text-slate-400">Paste an addon manifest to generate a new proxy manifest.</p>
        </div>

        <div className="flex-1 overflow-y-auto premium-scrollbar p-5 pt-2 space-y-4">
          <div className={`${INNER_PANEL_CLASS} p-5 space-y-4`}>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Manifest URL</label>
              <input
                type="url"
                value={proxyManifestUrl}
                onChange={(e) => updateProxyManifestUrl(e.target.value)}
                placeholder="https://addon.example.com/manifest.json"
                className={INPUT_CLASS}
              />
            </div>
            
            {canConfigureCatalogs && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenCatalogModal}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-[#0a0a0a] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-[#121212] shadow-sm"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Configure Catalogs</span>
                  </button>
                  {customizedCatalogCount > 0 && (
                    <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-200">
                      {customizedCatalogCount} custom name{customizedCatalogCount === 1 ? '' : 's'}
                    </div>
                  )}
                  {hiddenCatalogCount > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                      {hiddenCatalogCount} hidden
                    </div>
                  )}
                  {searchDisabledCatalogCount > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                      {searchDisabledCatalogCount} search off
                    </div>
                  )}
                  {discoverOnlyCatalogCount > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                      {discoverOnlyCatalogCount} discover only
                    </div>
                  )}
                </div>
                
                {proxyCatalogsStatus === 'loading' && (
                  <p className="text-xs text-slate-500">Loading catalogs from manifest...</p>
                )}
                {proxyCatalogsStatus === 'ready' && proxyCatalogs.length > 0 && customizedCatalogCount === 0 && (
                  <p className="text-xs text-emerald-400/80">
                    {proxyCatalogs.length} catalog{proxyCatalogs.length === 1 ? '' : 's'} successfully loaded.
                  </p>
                )}
                {proxyCatalogsStatus === 'error' && (
                  <p className="text-xs text-rose-400 p-2 bg-rose-500/10 rounded-lg">{proxyCatalogsError}</p>
                )}
              </div>
            )}

            {canConfigureCatalogs && isCinemetaProxyManifest && (
              <div className="rounded-xl border border-sky-400/20 bg-sky-500/5 p-3">
                <p className="text-xs leading-relaxed text-sky-200/70">
                  Cinemeta automaps series to IMDb IDs. ERDB will inject `realimdb:` episodes seamlessly.
                </p>
              </div>
            )}

            {canConfigureCatalogs && !isAiometadataProxyManifest && !isCinemetaProxyManifest && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-medium text-slate-300 block">Addon Metadata Provider</span>
                <div className="flex flex-wrap gap-2">
                  {PROXY_SERIES_METADATA_PROVIDER_OPTIONS.map((option) => (
                    <button
                      key={`proxy-series-provider-${option.id}`}
                      type="button"
                      onClick={() => setProxySeriesMetadataProvider(option.id)}
                      className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shadow-sm ${proxySeriesMetadataProvider === option.id ? 'border border-orange-500/30 bg-orange-500/15 text-white' : 'border border-white/5 bg-[#0a0a0a] text-slate-400 hover:bg-[#121212] hover:text-slate-200'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isAiometadataProxyManifest && (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-slate-500 leading-relaxed">
                  AiOMetadata IDs require alignment. Pick <strong className="text-slate-300 font-semibold">IMDb</strong> if it outputs real IMDb IDs, or <strong className="text-slate-300 font-semibold">TVDB</strong> if it bridges IMDb logic with TVDB numbering.
                </p>
                <div className="space-y-2">
                  <span className="text-xs font-medium text-slate-300 block">Series & Anime Provider</span>
                  <div className="flex flex-wrap gap-2">
                    {PROXY_EPISODE_PROVIDER_OPTIONS.map((option) => (
                      <button
                        key={`proxy-provider-${option.id}`}
                        type="button"
                        onClick={() => setProxyAiometadataProvider(option.id)}
                        className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shadow-sm ${proxyAiometadataProvider === option.id ? 'border border-orange-500/30 bg-orange-500/15 text-white' : 'border border-white/5 bg-[#0a0a0a] text-slate-400 hover:bg-[#121212] hover:text-slate-200'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <span className="text-xs font-medium text-slate-300 block">Replace Artwork For</span>
              <div className="flex flex-wrap gap-2">
                {PROXY_TYPES.map(type => (
                  <label key={`proxy-enabled-${type}`} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer select-none transition-all shadow-sm ${(proxyEnabledTypes as any)[type] ? 'border border-orange-500/30 bg-orange-500/15 text-white' : 'border border-white/5 bg-[#0a0a0a] text-slate-400 hover:bg-[#121212] hover:text-slate-200'}`}>
                    <input type="checkbox" checked={(proxyEnabledTypes as any)[type]} onChange={() => toggleProxyEnabledType(type)} className="h-4 w-4 accent-orange-500" />
                    <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <label className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer select-none transition-all shadow-sm ${proxyTranslateMeta ? 'border border-orange-500/30 bg-orange-500/15 text-white' : 'border border-white/5 bg-[#0a0a0a] text-slate-400 hover:bg-[#121212] hover:text-slate-200'}`}>
                <input type="checkbox" checked={proxyTranslateMeta} onChange={toggleProxyTranslateMeta} className="h-4 w-4 accent-orange-500" />
                <span>Translate Addon Metadata</span>
              </label>
              <p className="mt-2 text-xs text-slate-500">Injects selected language text for plots, titles, and episodes directly into the stream metadata.</p>
            </div>
          </div>

          <div className={`${CODE_PANEL_CLASS} p-5 space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-slate-300">Generated URL</h3>
              <button
                type="button"
                onClick={toggleProxyUrlVisibility}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors border border-white/5 bg-[#0a0a0a] text-slate-300 hover:bg-[#121212] shadow-sm"
              >
                {isProxyUrlVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{isProxyUrlVisible ? 'HIDE' : 'SHOW'}</span>
              </button>
            </div>
            
            <div className="overflow-hidden rounded-xl border border-white/5 bg-black/40 p-4">
              <div className={`w-full max-w-full break-all font-mono text-xs leading-relaxed text-slate-300 ${!isProxyUrlVisible ? 'select-none blur-sm opacity-50' : ''}`}>
                {displayedProxyUrl}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleCopyProxy}
                disabled={!canGenerateProxy}
                className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${canGenerateProxy ? (proxyCopied ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-orange-500 text-black hover:bg-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.3)]') : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
              >
                {proxyCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>COPIED!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-4 h-4" />
                    <span>COPY MANIFEST URL</span>
                  </>
                )}
              </button>
              <a
                href={canGenerateProxy ? proxyUrl : undefined}
                target="_blank"
                rel="noreferrer"
                className={`flex-1 sm:flex-none px-5 py-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-sm ${canGenerateProxy ? 'border border-white/10 bg-[#0a0a0a] text-slate-200 hover:bg-[#121212]' : 'border border-white/5 bg-transparent text-slate-600 pointer-events-none'}`}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Launch in Stremio</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className={`${AUX_PANEL_CLASS} shrink-0 p-5 mt-4 flex items-center justify-between`}>
        <div>
          <h3 className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1">
            <Terminal className="w-3.5 h-3.5 text-teal-400" />
            AiOMetadata Patterns
          </h3>
          <p className="text-xs text-slate-500">View exact parameters for custom metadata integrations.</p>
        </div>
        <button
          type="button"
          onClick={onOpenAiometadataModal}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/5 bg-[#0a0a0a] px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-[#121212] shadow-sm"
        >
          <span>Open Utility</span>
        </button>
      </div>

    </div>
  );
}
