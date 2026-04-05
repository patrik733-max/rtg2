'use client';

import { useState } from 'react';
import { Terminal, Check, Clipboard, RefreshCcw, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { HomePageViewProps } from '@/components/workspace-page-view';
import { AIOMETADATA_EPISODE_PROVIDER_OPTIONS } from './constants';
import type { AiometadataPatternType } from '@/components/workspace-page-view';

type WorkspaceModalsProps = Pick<HomePageViewProps, 'state' | 'actions' | 'derived'> & {
  isCatalogModalOpen: boolean;
  setIsCatalogModalOpen: (v: boolean) => void;
  isAiometadataModalOpen: boolean;
  setIsAiometadataModalOpen: (v: boolean) => void;
  isRotateModalOpen: boolean;
  setIsRotateModalOpen: (v: boolean) => void;
};

export function WorkspaceModals({ state, actions, derived, isCatalogModalOpen, setIsCatalogModalOpen, isAiometadataModalOpen, setIsAiometadataModalOpen, isRotateModalOpen, setIsRotateModalOpen }: WorkspaceModalsProps) {
  const {
    proxyCatalogsStatus,
    proxyCatalogsError,
    proxyCatalogs,
    proxyCatalogNames,
    proxyHiddenCatalogs,
    proxySearchDisabledCatalogs,
    proxyDiscoverOnlyCatalogs,
    aiometadataEpisodeProvider,
  } = state;

  const { aiometadataPatterns } = derived;
  const hasCatalogCustomizations = Object.keys(proxyCatalogNames).length > 0 || proxyHiddenCatalogs.length > 0 || proxySearchDisabledCatalogs.length > 0 || Object.keys(proxyDiscoverOnlyCatalogs).length > 0;

  const {
    resetProxyCatalogCustomizations,
    updateProxyCatalogName,
    toggleProxyCatalogHidden,
    toggleProxyCatalogSearchDisabled,
    setProxyCatalogDiscoverOnly,
    setAiometadataEpisodeProvider,
  } = actions;

  // Local state for AiOMetadata copying
  const [aiometadataCopiedType, setAiometadataCopiedType] = useState<AiometadataPatternType | null>(null);

  const handleCopyAiometadataPattern = async (type: AiometadataPatternType) => {
    const pattern = aiometadataPatterns[type];
    if (!pattern) return;
    await navigator.clipboard.writeText(pattern);
    setAiometadataCopiedType(type);
    setTimeout(() => setAiometadataCopiedType(null), 2000);
  };

  // Local state for Rotation Modal
  const [rotatePassword, setRotatePassword] = useState('');
  const [rotateShowPassword, setRotateShowPassword] = useState(false);
  const [rotateStatus, setRotateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [rotateMessage, setRotateMessage] = useState('');
  const [rotatedNewToken, setRotatedNewToken] = useState('');
  const [rotateCopied, setRotateCopied] = useState(false);

  const handleRotateToken = async () => {
    if (!rotatePassword) {
      setRotateStatus('error');
      setRotateMessage('Enter the current token password.');
      return;
    }
    setRotateStatus('loading');
    setRotateMessage('');
    try {
      const res = await fetch('/api/workspace-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate-token', password: rotatePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rotation failed');

      const newToken: string = data.newToken;
      setRotatedNewToken(newToken);
      setRotateStatus('success');

      // Update localStorage
      window.localStorage.setItem('erdb_active_token', newToken);
    } catch (err: any) {
      setRotateStatus('error');
      setRotateMessage(err?.message || 'Error during token rotation');
    }
  };

  const handleCopyRotatedToken = async () => {
    await navigator.clipboard.writeText(rotatedNewToken);
    setRotateCopied(true);
    setTimeout(() => setRotateCopied(false), 2000);
  };

  const handleCloseRotateModal = async () => {
    const wasSuccess = rotateStatus === 'success';
    const tokenToSave = rotatedNewToken;
    const passwordToSave = rotatePassword;

    setIsRotateModalOpen(false);
    setRotatePassword('');
    setRotateShowPassword(false);
    setRotateStatus('idle');
    setRotateMessage('');
    setRotatedNewToken('');
    setRotateCopied(false);

    if (wasSuccess && tokenToSave && passwordToSave) {
      const passwordCredentialCtor = (window as Window & {
        PasswordCredential?: new (data: { id: string; name?: string; password: string }) => Credential;
      }).PasswordCredential;
      if ('credentials' in navigator && passwordCredentialCtor) {
        try {
          const credential = new passwordCredentialCtor({
            id: tokenToSave,
            name: 'ERDB Token Account',
            password: passwordToSave,
          });
          await navigator.credentials.store(credential);
        } catch (e) {
          console.warn('Unable to store password credential:', e);
        }
      }
      window.location.reload();
    }
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <AnimatePresence>
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsCatalogModalOpen(false)}
          />
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0a] shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] flex flex-col max-h-full"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
              <div>
                <h4 className="text-lg font-[var(--font-display)] text-white">Configure Catalogs</h4>
                <p className="mt-1 text-xs text-slate-400">
                  Customize the catalog names exposed by the generated proxy manifest.
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Discover-only is supported by adding a required `discover` extra. Keep in mind that Stremio expects no more than one required extra per catalog.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={resetProxyCatalogCustomizations}
                  disabled={!hasCatalogCustomizations}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${hasCatalogCustomizations ? 'border border-white/10 bg-[#121212] text-slate-200 hover:bg-[#181818]' : 'border border-white/5 bg-[#080808] text-slate-600 cursor-not-allowed'}`}
                >
                  Reset All
                </button>
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="rounded-lg border border-white/10 bg-[#121212] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-[#181818]"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 py-4 premium-scrollbar">
              {proxyCatalogsStatus === 'loading' && (
                <div className="rounded-2xl border border-white/10 bg-[#080808] p-4 text-sm text-slate-400">
                  Loading catalogs from the manifest...
                </div>
              )}
              {proxyCatalogsStatus === 'error' && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {proxyCatalogsError || 'Unable to load catalogs from the source manifest.'}
                </div>
              )}
              {proxyCatalogsStatus === 'ready' && proxyCatalogs.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#080808] p-4 text-sm text-slate-400">
                  This manifest does not include configurable catalogs.
                </div>
              )}
              {proxyCatalogs.length > 0 && (
                <div className="space-y-3">
                  {proxyCatalogs.map((catalog) => {
                    const overrideValue = proxyCatalogNames[catalog.key] || '';
                    const isHidden = proxyHiddenCatalogs.includes(catalog.key);
                    const isSearchDisabled = proxySearchDisabledCatalogs.includes(catalog.key);
                    const isDiscoverOnly = proxyDiscoverOnlyCatalogs[catalog.key] ?? catalog.discoverOnly;
                    const blockingRequiredExtraKeys = catalog.requiredExtraKeys.filter(
                      (name) => name !== 'discover'
                    );
                    const canSetDiscoverOnly = blockingRequiredExtraKeys.length === 0;
                    return (
                      <div
                        key={catalog.key}
                        className="rounded-2xl border border-white/10 bg-[#080808]/90 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{catalog.name}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {[catalog.type || 'catalog', catalog.id].filter(Boolean).join(' / ')}
                            </div>
                            {catalog.extraKeys.length > 0 && (
                              <div className="mt-1 text-[10px] text-slate-600">
                                Extras: {catalog.extraKeys.join(', ')}
                              </div>
                            )}
                            {catalog.supportsSearch && (
                              <div className="mt-1 text-[10px] text-slate-600">
                                Search: {catalog.searchRequired ? 'search only' : 'search + catalog'}
                              </div>
                            )}
                          </div>
                          {overrideValue && (
                            <button
                              type="button"
                              onClick={() => updateProxyCatalogName(catalog.key, '')}
                              className="rounded-lg border border-white/10 bg-[#121212] px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-[#181818]"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => toggleProxyCatalogHidden(catalog.key)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${isHidden ? 'border-orange-500/50 bg-orange-500/10 text-orange-200' : 'border-white/10 bg-[#121212] text-slate-300 hover:bg-[#181818]'}`}
                          >
                            {isHidden ? 'Hidden' : 'Visible'}
                          </button>
                          {catalog.supportsSearch && (
                            <button
                              type="button"
                              onClick={() => toggleProxyCatalogSearchDisabled(catalog.key)}
                              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${isSearchDisabled ? 'border-orange-500/50 bg-orange-500/10 text-orange-200' : 'border-white/10 bg-[#121212] text-slate-300 hover:bg-[#181818]'}`}
                            >
                              {isSearchDisabled ? 'Search Off' : 'Search On'}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!canSetDiscoverOnly}
                            onClick={() => setProxyCatalogDiscoverOnly(catalog.key, !isDiscoverOnly)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${!canSetDiscoverOnly ? 'border border-white/5 bg-[#080808] text-slate-600 cursor-not-allowed' : isDiscoverOnly ? 'border-orange-500/50 bg-orange-500/10 text-orange-200' : 'border-white/10 bg-[#121212] text-slate-300 hover:bg-[#181818]'}`}
                          >
                            {isDiscoverOnly ? 'Discover Only' : 'Home + Discover'}
                          </button>
                        </div>
                        <div className="mt-3">
                          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Custom Name
                          </label>
                          <input
                            type="text"
                            value={overrideValue}
                            onChange={(event) => updateProxyCatalogName(catalog.key, event.target.value)}
                            placeholder={catalog.name}
                            className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] px-2.5 py-2 text-xs text-white outline-none focus:border-orange-500/50"
                          />
                          <p className="mt-2 text-[10px] text-slate-500">
                            {overrideValue
                              ? `Proxy manifest name: ${overrideValue}`
                              : 'Leave empty to keep the original catalog name.'}
                          </p>
                          {isHidden && (
                            <p className="mt-1 text-[10px] text-slate-600">
                              {catalog.supportsSearch && !isSearchDisabled
                                ? 'This catalog will stay searchable, but it will be converted to search-only so it no longer appears in home/discover.'
                                : 'This catalog will be removed from the generated manifest.'}
                            </p>
                          )}
                          {catalog.supportsSearch && isSearchDisabled && (
                            <p className="mt-1 text-[10px] text-slate-600">
                              {catalog.searchRequired
                                ? 'This is a search-only catalog, so disabling search removes it from the generated manifest.'
                                : 'Search support will be removed, but the catalog itself will stay available.'}
                            </p>
                          )}
                          {!canSetDiscoverOnly && (
                            <p className="mt-1 text-[10px] text-slate-600">
                              Discover-only is unavailable while this catalog still has another required extra: {blockingRequiredExtraKeys.join(', ')}.
                            </p>
                          )}
                          {canSetDiscoverOnly && isDiscoverOnly && (
                            <p className="mt-1 text-[10px] text-slate-600">
                              This catalog will stay available in Discover without appearing on the home rows.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {isAiometadataModalOpen && (
        <div className="fixed inset-0 z-[81] flex items-center justify-center px-4 py-6">
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsAiometadataModalOpen(false)}
          />
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0a0a] shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] flex flex-col max-h-full"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4 shrink-0">
              <div>
                <h4 className="flex items-center gap-2 text-lg font-[var(--font-display)] text-white">
                  <Terminal className="h-5 w-5 text-orange-500" />
                  <span>Aiometadata Patterns</span>
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  Choose whether AiOMetadata episode IDs should use `IMDb` or `TVDB`, then copy the URL patterns you need.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAiometadataModalOpen(false)}
                className="rounded-lg border border-white/10 bg-[#121212] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-[#181818]"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-5 py-4 premium-scrollbar">
              <p className="max-w-3xl text-sm text-slate-400">
                Series and anime should use the same provider here. For anime, AiOMetadata may send a Kitsu ID in the season slot when TVDB mapping fails, so TVDB thumbnails can still be incorrect.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#080808]/90 p-3">
                <div className="text-[11px] font-semibold text-slate-400">AiOMetadata Series/Anime Provider</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AIOMETADATA_EPISODE_PROVIDER_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setAiometadataEpisodeProvider(option.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${aiometadataEpisodeProvider === option.id ? 'border-orange-500/60 bg-[#121212] text-white' : 'border-white/10 bg-[#0a0a0a] text-slate-400 hover:text-white'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                {([
                  ['poster', 'Poster URL Pattern'],
                  ['background', 'Background URL Pattern'],
                  ['logo', 'Logo URL Pattern'],
                  ['episodeThumbnail', 'Episode Thumbnail URL Pattern'],
                ] as Array<[AiometadataPatternType, string]>).map(([type, label]) => {
                  const value = aiometadataPatterns[type];
                  const isCopied = aiometadataCopiedType === type;
                  const isAvailable = Boolean(value);
                  return (
                    <div key={type} className="rounded-2xl border border-white/10 bg-[#080808]/90 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold text-slate-400">{label}</div>
                        <button
                          onClick={() => handleCopyAiometadataPattern(type)}
                          disabled={!isAvailable}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${isAvailable ? (isCopied ? 'bg-green-500 text-white' : 'bg-orange-500 text-black hover:bg-orange-400') : 'cursor-not-allowed bg-[#121212] text-slate-500'}`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>COPIED</span>
                            </>
                          ) : (
                            <>
                              <Clipboard className="h-3.5 w-3.5" />
                              <span>COPY</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="mt-2 min-h-[7rem] rounded-xl border border-white/10 bg-[#0a0a0a]/80 p-3">
                        <div className="whitespace-pre-wrap break-all font-mono text-xs text-slate-300">
                          {value || 'Not available.'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {isRotateModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleCloseRotateModal}
          />
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0c0d10] shadow-[0_40px_140px_-30px_rgba(0,0,0,1)]"
          >
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-400/20">
                  <RefreshCcw className="h-5 w-5 text-orange-300" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Rotate Token</div>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Genera un nuovo token e migra automaticamente la configurazione.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              {rotateStatus !== 'success' && (
                <AnimatePresence mode="popLayout">
                  <motion.div key="rotate-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                      <p className="text-[11px] leading-5 text-amber-200">
                        The old token will be <strong>permanently deleted</strong> and replaced with a new one using the same configuration and password.
                        Update your saved credentials after rotation.
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Current token password
                      </label>
                      <div className="relative">
                        <input
                          type={rotateShowPassword ? 'text' : 'password'}
                          value={rotatePassword}
                          onChange={(e) => setRotatePassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && rotateStatus !== 'loading') handleRotateToken(); }}
                          placeholder="Your password"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-4 pr-11 text-sm text-white outline-none transition focus:border-orange-400/50"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setRotateShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                          {rotateShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {rotateMessage && (
                      <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {rotateMessage}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleCloseRotateModal}
                        className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRotateToken}
                        disabled={rotateStatus === 'loading' || !rotatePassword}
                        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCcw className={`h-4 w-4 ${rotateStatus === 'loading' ? 'animate-spin' : ''}`} />
                        {rotateStatus === 'loading' ? 'Rotating...' : 'Generate New Token'}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {rotateStatus === 'success' && (
                <AnimatePresence mode="popLayout">
                  <motion.div key="rotate-success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <p className="text-[11px] leading-5 text-emerald-200">
                        Token rotated successfully. Your configuration has been automatically migrated.
                        Your browser will be prompted to update saved credentials.
                      </p>
                    </div>

                    <div>
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        New Token
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080808] px-4 py-3">
                        <span className="flex-1 break-all font-mono text-xs text-white">{rotatedNewToken}</span>
                        <button
                          onClick={handleCopyRotatedToken}
                          className="shrink-0 rounded-lg bg-white/[0.06] p-2 transition hover:bg-white/[0.12]"
                        >
                          {rotateCopied ? <Check className="h-4 w-4 text-emerald-300" /> : <Clipboard className="h-4 w-4 text-slate-300" />}
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Save this token. Use it with the same password on your next login.
                      </p>
                    </div>

                    <button
                      onClick={handleCloseRotateModal}
                      className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
                    >
                      Close and reload
                    </button>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
