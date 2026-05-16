'use client';

import { Settings2, ChevronDown, KeyRound, Palette, Globe2, Layers } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { Dropdown } from './dropdown';
import type { HomePageViewProps } from '@/components/workspace/types';
import { RatingProviderSortableList } from '@/components/rating-provider-sortable-list';
import { isVerticalPosterRatingLayout, type PosterRatingLayout } from '@/lib/posterRatingLayout';
import { RATING_STYLE_OPTIONS, QUALITY_BADGE_STYLE_OPTIONS, type RatingStyle } from '@/lib/ratingStyle';
import { BACKDROP_RATING_LAYOUT_OPTIONS, type BackdropRatingLayout } from '@/lib/backdropRatingLayout';
import { BACKDROP_RATINGS_SIZE_OPTIONS, type BackdropRatingsSize } from '@/lib/backdropRatingsSize';
import { THUMBNAIL_RATING_LAYOUT_OPTIONS, type ThumbnailRatingLayout } from '@/lib/thumbnailRatingLayout';
import { THUMBNAIL_SIZE_OPTIONS, type ThumbnailSize } from '@/lib/thumbnailSize';
import { LOGO_MODE_OPTIONS } from '@/lib/logoMode';
import { LOGO_FONT_VARIANT_OPTIONS } from '@/lib/logoFontVariant';
import { DEFAULT_LOGO_CUSTOM_PRIMARY, DEFAULT_LOGO_CUSTOM_SECONDARY, DEFAULT_LOGO_CUSTOM_OUTLINE } from '@/lib/logoCustomColors';
import { LOGO_COLOR_PRESETS } from '@/lib/logoColorPresets';
import { POSTER_RATING_LAYOUT_OPTIONS } from '@/lib/posterRatingLayout';
import { RATING_PROVIDER_OPTIONS } from '@/lib/ratingPreferences';
import {
  STREAM_BADGE_OPTIONS,
  POSTER_GENRE_POSITION_OPTIONS,
  POSTER_QUALITY_BADGE_POSITION_OPTIONS,
  QUALITY_BADGE_SIDE_OPTIONS,
  VERTICAL_BADGE_CONTENT_OPTIONS,
  INPUT_CLASS,
  INPUT_COMPACT_CLASS,
  SEGMENT_CLASS,
  BUTTON_BASE_CLASS,
  BUTTON_ACTIVE_CLASS,
  BUTTON_INACTIVE_CLASS,
  INNER_PANEL_CLASS,
  CONFIG_PANEL_CLASS,
  RANKING_OPTIONS,
  RANKING_POSITION_OPTIONS,
  JUSTWATCH_COUNTRY_OPTIONS,
} from './constants';

type WorkspaceControlsPanelProps = Pick<HomePageViewProps, 'state' | 'derived' | 'actions'>;

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className={`${INNER_PANEL_CLASS}`}>
      <div className="flex items-center justify-between p-5 pb-3 text-xs font-medium text-slate-300">
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {badge && <span className="rounded-full bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-orange-400 font-bold">{badge}</span>}
        </div>
      </div>
      <div className="px-5 pb-5 space-y-4">{children}</div>
    </div>
  );
}

export function WorkspaceControlsPanel({ state, derived, actions }: WorkspaceControlsPanelProps) {
  const {
    previewType,
    lang,
    supportedLanguages,
    tmdbKey,
    mdblistKey,
    simklClientId,
    fanartKey,
    posterLang,
    posterAnimeLang,
    backdropLang,
    backdropAnimeLang,
    logoLang,
    logoAnimeLang,
    posterAnimeImageText,
    backdropAnimeImageText,
    posterRatingsLayout,
    posterRatingsMaxPerSide,
    backdropRatingsLayout,
    backdropRatingsMax,
    backdropRatingsSize,
    thumbnailRatingsLayout,
    thumbnailSize,
    logoMode,
    logoFontVariant,
    logoCustomPrimary,
    logoCustomSecondary,
    logoCustomOutline,
    logoRatingsMax,
    posterVerticalBadgeContent,
    thumbnailVerticalBadgeContent,
    backdropVerticalBadgeContent,
    posterConfiguratorPreset,
    posterAverageRatingsEnabled,
    posterVignetteEnabled,
    posterGenrePosition,
    posterSimpleRatingSource,
    qualityBadgesSide,
    posterQualityBadgesPosition,
    ranking,
    rankingCountry,
    rankingNoBox,
    rankingCompact,
    rankingPosition,
  } = state;

  const {
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
  } = derived;

  const {
    setTmdbKey,
    setMdblistKey,
    setSimklClientId,
    setFanartKey,
    setPosterLang,
    setPosterAnimeLang,
    setBackdropLang,
    setBackdropAnimeLang,
    setLogoLang,
    setLogoAnimeLang,
    setRatingStyleForType,
    setImageTextForType,
    setPosterAnimeImageText,
    setBackdropAnimeImageText,
    setPosterRatingsLayout,
    setPosterRatingsMaxPerSide,
    setPosterVerticalBadgeContent,
    setBackdropRatingsLayout,
    setBackdropRatingsMax,
    setBackdropRatingsSize,
    setBackdropVerticalBadgeContent,
    setThumbnailRatingsLayout,
    setThumbnailSize,
    setThumbnailVerticalBadgeContent,
    setPosterConfiguratorPreset,
    setPosterAverageRatingsEnabled,
    setPosterVignetteEnabled,
    setPosterGenrePosition,
    setPosterSimpleRatingSource,
    setLogoMode,
    setLogoFontVariant,
    setLogoCustomPrimary,
    setLogoCustomSecondary,
    setLogoCustomOutline,
    setLogoRatingsMax,
    setActiveStreamBadges,
    setActiveQualityBadgesStyle,
    setPosterQualityBadgesPosition,
    setQualityBadgesSide,
    toggleRatingPreference,
    enableAllRatingPreferences,
    disableAllRatingPreferences,
    reorderRatingPreference,
    setRanking,
    setRankingCountry,
    setRankingNoBox,
    setRankingCompact,
    setRankingPosition,
  } = actions;

  const shouldShowVerticalBadgeContent =
    (previewType === 'poster' && isVerticalPosterRatingLayout(posterRatingsLayout)) ||
    (previewType === 'backdrop' && backdropRatingsLayout === 'right-vertical') ||
    (previewType === 'thumbnail' && thumbnailRatingsLayout.endsWith('-vertical'));

  const activeVerticalBadgeContent =
    previewType === 'poster'
      ? posterVerticalBadgeContent
      : previewType === 'thumbnail'
        ? thumbnailVerticalBadgeContent
        : backdropVerticalBadgeContent;
  const normalizedRankingCountry = rankingCountry === 'global' ? 'global' : rankingCountry.toUpperCase();
  const hasKnownRankingCountry = JUSTWATCH_COUNTRY_OPTIONS.some((option) => option.id === normalizedRankingCountry);

  const renderSelect = (value: string, onChange: (val: string) => void, options: any[], defaultLabel: string) => {
    const dropdownOptions = [
      { id: '', label: defaultLabel },
      { id: 'original', label: 'Native Language' },
      ...options.map((o: any) => ({ id: o.code, label: `${o.flag} ${o.label}` }))
    ];
    return <Dropdown value={value} onChange={onChange} options={dropdownOptions} />;
  };

  const renderDropdown = <T extends string>(value: T, onChange: (val: T) => void, options: readonly { readonly id: T; readonly label: string }[]) => (
    <Dropdown value={value} onChange={onChange} options={options} />
  );

  return (
    <div className={`xl:order-1 ${CONFIG_PANEL_CLASS} flex flex-col xl:self-stretch xl:h-full`}>
      <div className="shrink-0 p-5 pb-3 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20">
            <Settings2 className="w-4 h-4 text-orange-400" />
          </div>
          <h2 className="text-sm font-medium text-white tracking-wide">Configurator</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto premium-scrollbar p-5 space-y-5">

        <Section title="Access Keys">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">TMDB (v3 Key)</span>
              <input type="password" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Enter key to enable specific previews" className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">MDBList Key</span>
              <input type="password" value={mdblistKey} onChange={(e) => setMdblistKey(e.target.value)} placeholder="Optional Integration" className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">SIMKL Client ID</span>
              <input type="password" value={simklClientId} onChange={(e) => setSimklClientId(e.target.value)} placeholder="Optional Integration" className={INPUT_CLASS} />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-3">
              <span className="text-xs font-medium text-slate-400">Fanart.tv API Key <span className="text-slate-500 font-normal">(optional)</span></span>
              <span className="text-xs text-slate-500">Used as fallback for Clean posters/backdrops when TMDB has none. Not required.</span>
              <input type="password" value={fanartKey} onChange={(e) => setFanartKey(e.target.value)} placeholder="Fanart.tv API key" className={INPUT_CLASS} />
            </label>
          </div>
        </Section>

        {previewType === 'poster' && (
          <Section title="Poster Preset">
            <div>
              <h3 className="text-xs font-medium text-slate-400 mb-2">Mode</h3>
              {renderDropdown(posterConfiguratorPreset, setPosterConfiguratorPreset, [{ id: 'simple', label: 'Simple' }, { id: 'advanced', label: 'Advanced' }])}
            </div>
            {posterConfiguratorPreset === 'simple' && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 mb-2">Rating Source</h3>
                <div className="relative">
                  <select value={posterSimpleRatingSource} onChange={(e) => setPosterSimpleRatingSource(e.target.value as typeof posterSimpleRatingSource)} className={`h-10 w-full appearance-none pr-8 text-sm font-medium ${INPUT_COMPACT_CLASS}`}>
                    <option value="average" className="bg-[#0a0a0a]">Average</option>
                    {RATING_PROVIDER_OPTIONS.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#0a0a0a]">{p.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>
            )}
          </Section>
        )}

        {(previewType === 'poster' && tmdbKey && posterConfiguratorPreset !== 'simple') || previewType === 'backdrop' && tmdbKey || previewType === 'logo' && tmdbKey ? (
          <Section title="Languages">
            {previewType === 'poster' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-slate-300 mb-3">Poster Language</h3>
                  {renderSelect(posterLang, setPosterLang, supportedLanguages, `Global (${lang})`)}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-300 mb-3">Poster Language (Anime)</h3>
                  {renderSelect(posterAnimeLang, setPosterAnimeLang, supportedLanguages, `Global (${lang})`)}
                </div>
              </div>
            )}
            {previewType === 'backdrop' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-slate-300 mb-3">Backdrop Language</h3>
                  {renderSelect(backdropLang, setBackdropLang, supportedLanguages, `Global (${lang})`)}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-300 mb-3">Backdrop Language (Anime)</h3>
                  {renderSelect(backdropAnimeLang, setBackdropAnimeLang, supportedLanguages, `Global (${lang})`)}
                </div>
              </div>
            )}
            {previewType === 'logo' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-slate-300 mb-3">Logo Language</h3>
                  {renderSelect(logoLang, setLogoLang, supportedLanguages, `Global (${lang})`)}
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-300 mb-3">Logo Language (Anime)</h3>
                  {renderSelect(logoAnimeLang, setLogoAnimeLang, supportedLanguages, `Global (${lang})`)}
                </div>
              </div>
            )}
          </Section>
        ) : null}

        {!(previewType === 'poster' && posterConfiguratorPreset === 'simple') && (
          <Section title={styleLabel}>
            {renderDropdown(activeRatingStyle, (v) => setRatingStyleForType(v as RatingStyle), RATING_STYLE_OPTIONS)}
          </Section>
        )}

        {!(previewType === 'poster' && posterConfiguratorPreset === 'simple') && previewType !== 'logo' && previewType !== 'thumbnail' && (
          <Section title={textLabel}>
            {renderDropdown(activeImageText, setImageTextForType, [
              { id: 'default', label: 'Default' },
              { id: 'clean', label: 'Clean' },
              { id: 'alternative', label: 'Alternative' },
            ])}
            {previewType === 'poster' && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 mb-1">Anime Override (Kitsu/MAL)</h3>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  Works for Kitsu/MAL IDs (separate seasons). Does not work with IMDB, TMDB or TVDB.
                </p>
                {renderDropdown(posterAnimeImageText, setPosterAnimeImageText, [
                  { id: 'default', label: 'Default' },
                  { id: 'clean', label: 'Clean' },
                  { id: 'alternative', label: 'Alternative' },
                ])}
              </div>
            )}
            {previewType === 'backdrop' && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 mb-2">Anime Override (Kitsu/MAL)</h3>
                {renderDropdown(backdropAnimeImageText, setBackdropAnimeImageText, [
                  { id: 'default', label: 'Default' },
                  { id: 'clean', label: 'Clean' },
                  { id: 'alternative', label: 'Alternative' },
                ])}
              </div>
            )}
          </Section>
        )}

        {!(previewType === 'poster' && posterConfiguratorPreset === 'simple') && (
          <Section title="Layout">
            {previewType === 'poster' && (
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-slate-400 mb-2">Ratings Position</h3>
                {renderDropdown(posterRatingsLayout, (v) => setPosterRatingsLayout(v as PosterRatingLayout), POSTER_RATING_LAYOUT_OPTIONS)}
                {isVerticalPosterRatingLayout(posterRatingsLayout) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <span className="text-xs font-medium text-slate-400">Max / Side</span>
                    <input type="number" value={posterRatingsMaxPerSide ?? ''} onChange={(e) => setPosterRatingsMaxPerSide(e.target.value === '' ? null : parseInt(e.target.value))} placeholder="Auto" className={`w-20 ${INPUT_CLASS}`} />
                    <button onClick={() => setPosterRatingsMaxPerSide(null)} className={BUTTON_BASE_CLASS + " " + BUTTON_INACTIVE_CLASS}>Auto</button>
                  </div>
                )}
                {shouldShowVerticalBadgeContent && (
                  <div>
                    <h3 className="text-xs font-medium text-slate-400 mb-2">Vertical Badge Style</h3>
                    {renderDropdown(posterVerticalBadgeContent, setPosterVerticalBadgeContent, VERTICAL_BADGE_CONTENT_OPTIONS)}
                  </div>
                )}
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-[#0a0a0a] px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-slate-300">Vignette</span>
                    <span className="text-[10px] text-slate-500">Darken poster edges</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPosterVignetteEnabled((value) => !value)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${posterVignetteEnabled ? 'bg-orange-500/80' : 'bg-white/10'}`}
                    aria-pressed={posterVignetteEnabled}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${posterVignetteEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </label>
              </div>
            )}
            {previewType === 'backdrop' && (
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-slate-400 mb-2">Ratings Position</h3>
                {renderDropdown(backdropRatingsLayout, (v) => setBackdropRatingsLayout(v as BackdropRatingLayout), BACKDROP_RATING_LAYOUT_OPTIONS)}
                <div>
                  <h3 className="text-xs font-medium text-slate-400 mb-2">Ratings Size</h3>
                  {renderDropdown(backdropRatingsSize, (v) => setBackdropRatingsSize(v as BackdropRatingsSize), BACKDROP_RATINGS_SIZE_OPTIONS)}
                </div>
                {shouldShowVerticalBadgeContent && (
                  <div>
                    <h3 className="text-xs font-medium text-slate-400 mb-2">Vertical Badge Style</h3>
                    {renderDropdown(backdropVerticalBadgeContent, setBackdropVerticalBadgeContent, VERTICAL_BADGE_CONTENT_OPTIONS)}
                  </div>
                )}
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">Max Badges</span>
                  <input type="number" min={1} max={20} value={backdropRatingsMax ?? ''} onChange={(e) => setBackdropRatingsMax(e.target.value === '' ? null : parseInt(e.target.value, 10))} placeholder="Auto" className={`w-20 ${INPUT_CLASS}`} />
                  <button onClick={() => setBackdropRatingsMax(null)} className={BUTTON_BASE_CLASS + " " + BUTTON_INACTIVE_CLASS}>Auto</button>
                </div>
              </div>
            )}
            {previewType === 'thumbnail' && (
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-slate-400 mb-2">Ratings Position</h3>
                {renderDropdown(thumbnailRatingsLayout, (v) => setThumbnailRatingsLayout(v as ThumbnailRatingLayout), THUMBNAIL_RATING_LAYOUT_OPTIONS)}
                <div>
                  <h3 className="text-xs font-medium text-slate-400 mb-2">Thumbnail Size</h3>
                  {renderDropdown(thumbnailSize, (v) => setThumbnailSize(v as ThumbnailSize), THUMBNAIL_SIZE_OPTIONS)}
                </div>
                {shouldShowVerticalBadgeContent && (
                  <div>
                    <h3 className="text-xs font-medium text-slate-400 mb-2">Vertical Badge Style</h3>
                    {renderDropdown(thumbnailVerticalBadgeContent, setThumbnailVerticalBadgeContent, VERTICAL_BADGE_CONTENT_OPTIONS)}
                  </div>
                )}
              </div>
            )}
            {previewType === 'logo' && (
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-slate-400 mb-2">Logo Mode</h3>
                {renderDropdown(logoMode, setLogoMode, LOGO_MODE_OPTIONS)}

                <AnimatePresence mode="popLayout">
                  {logoMode === 'custom-logo' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-2 overflow-hidden">
                      <h3 className="text-xs font-medium text-slate-400 mb-2">Logo Font</h3>
                      {renderDropdown(logoFontVariant, setLogoFontVariant, LOGO_FONT_VARIANT_OPTIONS)}

                      <div className="grid gap-3 lg:grid-cols-3 pt-2">
                        <label className="space-y-2">
                          <span className="text-xs font-medium text-slate-400">Primary</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <input type="color" value={logoCustomPrimary} onChange={(e) => setLogoCustomPrimary(e.target.value)} className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" />
                            <input type="text" value={logoCustomPrimary} onChange={(e) => setLogoCustomPrimary(e.target.value)} className={`min-w-0 flex-1 ${INPUT_CLASS}`} />
                          </div>
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-medium text-slate-400">Secondary</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <input type="color" value={logoCustomSecondary} onChange={(e) => setLogoCustomSecondary(e.target.value)} className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" />
                            <input type="text" value={logoCustomSecondary} onChange={(e) => setLogoCustomSecondary(e.target.value)} className={`min-w-0 flex-1 ${INPUT_CLASS}`} />
                          </div>
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs font-medium text-slate-400">Outline</span>
                          <div className="flex min-w-0 items-center gap-2">
                            <input type="color" value={logoCustomOutline} onChange={(e) => setLogoCustomOutline(e.target.value)} className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1" />
                            <input type="text" value={logoCustomOutline} onChange={(e) => setLogoCustomOutline(e.target.value)} className={`min-w-0 flex-1 ${INPUT_CLASS}`} />
                          </div>
                        </label>
                      </div>

                      <div className="space-y-3 pt-2">
                        <h3 className="text-xs font-medium text-slate-400 mb-2">Color Presets</h3>
                        <div className="flex flex-wrap gap-2">
                          {LOGO_COLOR_PRESETS.map((preset) => (
                            <button key={preset.id} onClick={() => { setLogoCustomPrimary(preset.primary); setLogoCustomSecondary(preset.secondary); setLogoCustomOutline(preset.outline); }} className={`${BUTTON_BASE_CLASS} ${BUTTON_INACTIVE_CLASS} px-3 py-2`}>
                              <span className="inline-flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: preset.primary }} />
                                <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: preset.secondary }} />
                                <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: preset.outline }} />
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">Max Badges</span>
                  <input type="number" min={1} max={20} value={logoRatingsMax ?? ''} onChange={(e) => setLogoRatingsMax(e.target.value === '' ? null : parseInt(e.target.value, 10))} placeholder="Auto" className={`w-20 ${INPUT_CLASS}`} />
                  <button onClick={() => setLogoRatingsMax(null)} className={BUTTON_BASE_CLASS + " " + BUTTON_INACTIVE_CLASS}>Auto</button>
                </div>
              </div>
            )}
          </Section>
        )}


        {previewType !== 'logo' && previewType !== 'thumbnail' && (
          <Section title={`Quality Badges (${qualityBadgeTypeLabel})`}>
            <div>
              <h3 className="text-xs font-medium text-slate-400 mb-2">Mode</h3>
              {renderDropdown(activeStreamBadges, setActiveStreamBadges, STREAM_BADGE_OPTIONS)}
            </div>
            {!(previewType === 'poster' && posterConfiguratorPreset === 'simple') && (
              <div>
                <h3 className="text-xs font-medium text-slate-400 mb-2">Badge Style</h3>
                {renderDropdown(activeQualityBadgesStyle, (v) => setActiveQualityBadgesStyle(v), QUALITY_BADGE_STYLE_OPTIONS)}
              </div>
            )}
            <div className="flex flex-wrap gap-4 pt-2">
              {shouldShowQualityBadgesPosition && (
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium text-slate-400 mb-2">Badge Position</h3>
                  {renderDropdown(posterQualityBadgesPosition, setPosterQualityBadgesPosition, POSTER_QUALITY_BADGE_POSITION_OPTIONS)}
                </div>
              )}
              {shouldShowQualityBadgesSide && (
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium text-slate-400 mb-2">Badge Side</h3>
                  {renderDropdown(qualityBadgesSide, setQualityBadgesSide, QUALITY_BADGE_SIDE_OPTIONS)}
                </div>
              )}
            </div>
          </Section>
        )}

        {previewType === 'poster' && (
          <Section title="Ranking" badge="New">
            <p className="text-xs text-slate-500">Show the popularity rank from JustWatch charts on your posters.</p>

            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Ranking Interval</h4>
                {renderDropdown(ranking, setRanking, RANKING_OPTIONS)}
              </div>

              <AnimatePresence>
                {ranking !== 'off' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Position</h4>
                      {renderDropdown(rankingPosition, setRankingPosition, RANKING_POSITION_OPTIONS)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Chart Country</h4>
                        <div className="flex items-center gap-2">
                          <Globe2 className="w-4 h-4 text-slate-500" />
                          <select
                            value={hasKnownRankingCountry ? normalizedRankingCountry : rankingCountry}
                            onChange={(e) => setRankingCountry(e.target.value)}
                            className={INPUT_CLASS}
                          >
                            {!hasKnownRankingCountry && (
                              <option value={rankingCountry}>{rankingCountry}</option>
                            )}
                            {JUSTWATCH_COUNTRY_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id} className="bg-[#0a0a0a]">
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Display Style</h4>
                        <div className="flex items-center gap-2 h-10">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                              <input type="checkbox" checked={rankingNoBox} onChange={(e) => setRankingNoBox(e.target.checked)} className="sr-only peer" />
                              <div className="w-9 h-5 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-orange-400 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500/20"></div>
                            </div>
                            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Hide Background Box</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                              <input type="checkbox" checked={rankingCompact} onChange={(e) => setRankingCompact(e.target.checked)} className="sr-only peer" />
                              <div className="w-9 h-5 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 peer-checked:after:bg-orange-400 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500/20"></div>
                            </div>
                            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Compact Mode (number only)</span>
                          </label>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Section>
        )}

        {previewType === 'poster' && posterConfiguratorPreset === 'advanced' && !posterAverageRatingsEnabled && (
          <Section title="Genre">
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Position</h4>
              {renderDropdown(posterGenrePosition, setPosterGenrePosition, POSTER_GENRE_POSITION_OPTIONS)}
            </div>
          </Section>
        )}

        {!(previewType === 'poster' && posterConfiguratorPreset === 'simple') && (
          <Section title={providersLabel}>
            <p className="text-xs text-slate-500">Drag the grips to reorder providers. Order flows top to bottom.</p>
            {previewType === 'poster' && (
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-[#0a0a0a] px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-slate-300">Average rating</span>
                    <span className="text-[10px] text-slate-500 text-balance leading-relaxed">Displays a unified rating across providers</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPosterAverageRatingsEnabled((value) => !value)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors ${posterAverageRatingsEnabled ? 'bg-orange-500/80' : 'bg-white/10'}`}
                    aria-pressed={posterAverageRatingsEnabled}
                  >
                    <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${posterAverageRatingsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </label>
                {posterAverageRatingsEnabled && (
                  <motion.label
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="ml-4 flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-[#0a0a0a]/50 px-4 py-2.5"
                  >
                    <span className="text-[11px] font-medium text-slate-400">Include genre name</span>
                    <button
                      type="button"
                      onClick={() => setPosterGenrePosition(posterGenrePosition === 'off' ? 'top' : 'off')}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${posterGenrePosition !== 'off' ? 'bg-orange-500/60' : 'bg-white/5'}`}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${posterGenrePosition !== 'off' ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </motion.label>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={enableAllRatingPreferences} className={BUTTON_BASE_CLASS + " " + BUTTON_INACTIVE_CLASS + " px-4 py-2"}>
                Enable All
              </button>
              <button onClick={disableAllRatingPreferences} className={BUTTON_BASE_CLASS + " " + BUTTON_INACTIVE_CLASS + " px-4 py-2"}>
                Disable All
              </button>
            </div>
            <RatingProviderSortableList
              rows={ratingProviderRows}
              onReorder={reorderRatingPreference}
              onToggle={toggleRatingPreference}
              fillDirection="column"
              singleColumnOnMobile
            />
          </Section>
        )}

      </div>
    </div>
  );
}
