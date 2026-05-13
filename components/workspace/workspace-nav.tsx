'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Save, Check, Clipboard, RefreshCcw, LogOut, Lock, Globe2,
  ChevronRight, Image as ImageIcon, MonitorPlay, Layers, Search, Tv, Film, X, Loader2,
} from 'lucide-react';
import type { HomePageViewProps } from '@/components/workspace/types';

const SEGMENT_CLASS =
  'flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
const INPUT_COMPACT_CLASS =
  'rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition duration-200 focus:border-orange-400/50 focus:bg-white/[0.07]';

type SearchResult = {
  tmdbId: number;
  imdbId: string | null;
  title: string;
  year: string;
  type: 'movie' | 'tv';
  poster: string | null;
};

type WorkspaceNavProps = Pick<HomePageViewProps, 'refs' | 'state' | 'actions' | 'derived'> & {
  onOpenRotateModal: () => void;
};

function MediaIdSearch({
  mediaId,
  setMediaId,
  tmdbKey,
  placeholder,
  previewType,
}: {
  mediaId: string;
  setMediaId: (value: string) => void;
  tmdbKey: string;
  placeholder: string;
  previewType: string;
}) {
  const [inputValue, setInputValue] = useState(mediaId);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external changes to inputValue
  useEffect(() => {
    if (!isSearchMode) {
      setInputValue(mediaId);
    }
  }, [mediaId, isSearchMode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsSearchMode(false);
        setInputValue(mediaId);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mediaId]);

  const runSearch = useCallback(async (query: string, key: string) => {
    if (!query || !key) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/search-title?q=${encodeURIComponent(query)}&tmdbKey=${encodeURIComponent(key)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('Search failed');
      const data: { results: SearchResult[] } = await res.json();
      setResults(data.results ?? []);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect search mode: if it doesn't look like an IMDB/tt ID pattern, trigger search
    const looksLikeId = /^tt\d*$|^\d*$/.test(val.trim()) || /^\S+:\d*:?\d*$/.test(val.trim());

    if (!looksLikeId && val.trim().length >= 2 && tmdbKey) {
      setIsSearchMode(true);
      setSearchQuery(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(val.trim(), tmdbKey), 400);
    } else {
      setIsSearchMode(false);
      setIsOpen(false);
      setMediaId(val);
    }
  };

  const handleSearchIconClick = () => {
    if (!tmdbKey) return;
    const val = inputValue.trim();
    if (val && !(/^tt\d+$/.test(val))) {
      setIsSearchMode(true);
      setIsOpen(false);
      setResults([]);
      runSearch(val || searchQuery, tmdbKey);
    }
  };

  const handleSelect = (result: SearchResult) => {
    const baseId = result.imdbId || `tmdb:${result.type}:${result.tmdbId}`;
    const isThumbnailTv = previewType === 'thumbnail' && result.type === 'tv';
    const finalId = isThumbnailTv ? `${baseId}:1:1` : baseId;
    setMediaId(finalId);
    setInputValue(finalId);
    setIsSearchMode(false);
    setIsOpen(false);
    setResults([]);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setInputValue('');
    setIsSearchMode(false);
    setIsOpen(false);
    setResults([]);
    setMediaId('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsSearchMode(false);
      setInputValue(mediaId);
    }
    if (e.key === 'Enter' && isSearchMode && tmdbKey) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      runSearch(inputValue.trim(), tmdbKey);
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        Media ID
      </span>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={tmdbKey ? `${placeholder} or title…` : placeholder}
          className={`h-8 w-44 pr-14 ${INPUT_COMPACT_CLASS}`}
        />
        {/* Clear button */}
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-7 flex h-5 w-5 items-center justify-center rounded-md text-slate-500 transition hover:text-slate-300"
            tabIndex={-1}
            title="Clear"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {/* Search / Loading button */}
        <button
          onClick={handleSearchIconClick}
          disabled={!tmdbKey}
          className={`absolute right-1.5 flex h-5 w-5 items-center justify-center rounded-md transition ${tmdbKey ? 'text-slate-400 hover:text-orange-300' : 'cursor-not-allowed text-slate-600'}`}
          tabIndex={-1}
          title={tmdbKey ? 'Search by title' : 'Add TMDB key to enable search'}
        >
          {isSearching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
        </button>

        {/* Dropdown */}
        {isOpen && results.length > 0 && (
          <div className="absolute left-0 top-full z-[200] mt-1.5 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f14] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Select a result
            </div>
            <div className="max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.tmdbId}
                  onClick={() => handleSelect(r)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] cursor-pointer"
                >
                  {/* Poster */}
                  <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                    {r.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.poster} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-600">
                        {r.type === 'movie' ? (
                          <Film className="h-3 w-3" />
                        ) : (
                          <Tv className="h-3 w-3" />
                        )}
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-white">{r.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {r.year && (
                        <span className="text-[10px] text-slate-500">{r.year}</span>
                      )}
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          r.type === 'movie'
                            ? 'bg-orange-500/15 text-orange-300'
                            : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {r.type === 'movie' ? 'Movie' : 'TV'}
                      </span>
                    </div>
                  </div>
                  {/* ID badge */}
                  <div className="shrink-0">
                    {r.imdbId ? (
                      <span className="rounded-lg border border-teal-400/20 bg-teal-500/10 px-2 py-0.5 text-[9px] font-mono text-teal-300">
                        {r.imdbId}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[9px] font-mono text-orange-300">
                        tmdb:{r.tmdbId}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {results.length === 0 && !isSearching && (
              <div className="px-3 py-4 text-center text-xs text-slate-500">No results found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

          <MediaIdSearch
            mediaId={mediaId}
            setMediaId={setMediaId}
            tmdbKey={tmdbKey}
            placeholder={previewType === 'thumbnail' ? 'tt0944947:1:1' : 'tt0133093'}
            previewType={previewType}
          />

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
              <span className={tokenCopied ? 'text-green-400' : ''}>
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
