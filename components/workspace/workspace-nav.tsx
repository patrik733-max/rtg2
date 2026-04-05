'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Save, Check, Clipboard, RefreshCcw, LogOut, Lock, Globe2, ChevronRight, Image as ImageIcon, MonitorPlay, Layers } from 'lucide-react';
import type { HomePageViewProps } from '@/components/workspace-page-view';

const SEGMENT_CLASS =
  'flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
const INPUT_COMPACT_CLASS =
  'rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 focus:border-orange-400/50 focus:bg-white/[0.07]';

type WorkspaceNavProps = Pick<HomePageViewProps, 'refs' | 'state' | 'actions' | 'derived'> & {
  onOpenRotateModal: () => void;
};

export function WorkspaceNav({ refs, state, actions, derived, onOpenRotateModal }: WorkspaceNavProps) {
  const { navRef } = refs;
  const { previewType, mediaId, lang, supportedLanguages, tmdbKey } = state;
  const { setPreviewType, setMediaId, setLang, handleSaveConfig, handleTokenDisconnect } = actions;
  const [tokenCopied, setTokenCopied] = useState(false);

  return (
    <nav ref={navRef} className="z-50 rounded-[28px] border border-white/10 bg-[#06070b]/72 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
      <div className="mx-auto grid w-full grid-cols-1 gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4">
        {/* Left: nav links */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.07] hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />Home
          </Link>
          <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-white">Workspace</span>
          <Link href="/docs" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.07] hover:text-white">
            API Docs
          </Link>
        </div>
        {/* Center: Type + Media ID + Lang */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Type</span>
            <div className={`${SEGMENT_CLASS} flex-wrap p-0.5 xl:flex-nowrap`}>
              {(['poster', 'backdrop', 'logo', 'thumbnail'] as const).map(type => (
                <button 
                  key={type} 
                  onClick={() => setPreviewType(type)} 
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${previewType === type ? 'border border-orange-400/20 bg-orange-500/10 text-white' : 'border border-transparent text-slate-400 hover:text-white'}`}
                >
                  {type === 'poster' && <ImageIcon className="w-3 h-3" />}
                  {type === 'backdrop' && <MonitorPlay className="w-3 h-3" />}
                  {type === 'logo' && <Layers className="w-3 h-3" />}
                  {type === 'thumbnail' && <MonitorPlay className="w-3 h-3" />}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Media ID</span>
            <input
              type="text"
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
              placeholder={previewType === 'thumbnail' ? 'tt0944947:1:1' : 'tt0133093'}
              className={`h-8 w-40 ${INPUT_COMPACT_CLASS}`}
            />
          </div>
          {tmdbKey ? (
            <div className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500"><Globe2 className="w-3 h-3" /> Lang</span>
              <div className="relative">
                <select value={lang} onChange={(e) => setLang(e.target.value)} className={`h-8 w-40 appearance-none pr-7 ${INPUT_COMPACT_CLASS}`}>
                  {supportedLanguages.map((language) => (
                    <option key={language.code} value={language.code} className="bg-[#0a0a0a]">
                      {language.flag} {language.label}
                    </option>
                  ))}
                </select>
                <ChevronRight className="absolute right-2 top-2.5 w-3 h-3 rotate-90 stroke-2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500"><Globe2 className="w-3 h-3" /> Lang</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#080808] px-2 py-1.5 text-[10px] text-slate-500">
                <Globe2 className="w-3 h-3 shrink-0" /> Add TMDB key
              </div>
            </div>
          )}
        </div>
        {/* Right: Rotate Token / Disconnect / Login */}
        <div className="flex items-center gap-2">
          {state.activeToken && (
            <button
              onClick={handleSaveConfig}
              disabled={state.configSaveStatus === 'saving'}
              className={`rounded-full border px-3 py-2 text-[10px] transition-colors inline-flex items-center gap-1.5 ${
                state.configSaveStatus === 'saved'
                  ? 'border-green-400/30 bg-green-500/15 text-green-200'
                  : state.configSaveStatus === 'error'
                    ? 'border-red-400/30 bg-red-500/15 text-red-200'
                    : state.configSaveStatus === 'saving'
                      ? 'border-orange-400/20 bg-orange-500/10 text-orange-200 cursor-wait'
                      : 'border-orange-400/20 bg-orange-500/10 text-white hover:bg-orange-500/20'
              }`}
              title="Save current configuration to token"
            >
              {state.configSaveStatus === 'saved' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              <span>
                {state.configSaveStatus === 'saving'
                  ? 'Saving…'
                  : state.configSaveStatus === 'saved'
                    ? 'Saved'
                    : state.configSaveStatus === 'error'
                      ? 'Error'
                      : 'Save Config'}
              </span>
            </button>
          )}
          {state.activeToken && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(state.activeToken!);
                setTokenCopied(true);
                setTimeout(() => setTokenCopied(false), 2000);
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] text-slate-400 transition-colors hover:bg-white/10 hover:text-white inline-flex items-center gap-1.5"
              title="Copia il Token negli appunti"
            >
              {tokenCopied ? (
                <Check className="h-3 w-3 text-green-400" />
              ) : (
                <Clipboard className="h-3 w-3" />
              )}
              <span className={tokenCopied ? "text-green-400" : ""}>
                {tokenCopied ? 'Copied' : 'Copy Token'}
              </span>
            </button>
          )}
          {state.activeToken && (
            <button
              onClick={onOpenRotateModal}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] text-slate-400 transition-colors hover:bg-white/10 hover:text-white inline-flex items-center gap-1.5"
              title="Genera un nuovo token migrando la configurazione"
            >
              <RefreshCcw className="h-3 w-3" />
              <span>Rotate Token</span>
            </button>
          )}
          {state.activeToken && (
            <button
              onClick={handleTokenDisconnect}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] text-slate-100 transition-colors hover:bg-white/10 inline-flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          )}
          {!state.activeToken && (
            <Link
              href="/configurator"
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] text-slate-100 transition-colors hover:bg-white/10 inline-flex items-center gap-2"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
