'use client';

import { useState, useEffect } from 'react';
import { MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { HomePageViewProps } from '@/components/workspace-page-view';
import { PREVIEW_PANEL_CLASS } from './constants';

type WorkspacePreviewPanelProps = Pick<HomePageViewProps, 'state' | 'derived'>;

export function WorkspacePreviewPanel({ state, derived }: WorkspacePreviewPanelProps) {
  const { previewType } = state;
  const { previewUrl, previewNotice } = derived;
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset loading state when preview url changes
  useEffect(() => {
    setImageLoaded(false);
  }, [previewUrl]);

  return (
    <div className={`${PREVIEW_PANEL_CLASS} flex min-h-0 flex-col p-4 w-full xl:flex-1`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-100">
          <MonitorPlay className="h-3.5 w-3.5" />
          <span>Preview Output</span>
        </div>
        <p className="text-[11px] text-slate-400 sm:text-xs">
          All ratings are normalized to a 0-10 scale.
        </p>
      </div>

      <div className={`relative mt-4 flex min-h-[340px] flex-1 items-center justify-center xl:min-h-0 ${previewType === 'poster' ? 'xl:mx-auto xl:max-w-[28rem]' : previewType === 'logo' ? 'xl:mx-auto xl:max-w-[56rem]' : ''}`}>
        <AnimatePresence mode="wait">
          {previewNotice ? (
            <motion.div
              key="notice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 max-w-md text-center"
            >
              <div className="text-sm font-semibold text-orange-300">{previewNotice}</div>
              <div className="mt-2 text-xs text-slate-500">
                Use an episode ID in the format `imdb_id:season:episode`.
              </div>
            </motion.div>
          ) : previewUrl ? (
            <motion.div
              key="previewedImageContainer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 flex h-full min-h-0 w-full items-center justify-center p-1"
            >
              {!imageLoaded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 m-4 rounded-[24px] bg-white/[0.02] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden"
                >
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite]" />
                </motion.div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <motion.img
                key={previewUrl}
                src={previewUrl}
                alt="Preview"
                onLoad={() => setImageLoaded(true)}
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: imageLoaded ? 1 : 0, filter: imageLoaded ? 'blur(0px)' : 'blur(10px)' }}
                transition={{ duration: 0.4 }}
                className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-[#030303] shadow-[0_24px_70px_-35px_rgba(0,0,0,1)] ring-1 ring-white/8 ${
                  previewType === 'logo'
                    ? 'block w-full max-w-2xl h-auto'
                    : 'block max-w-full max-h-full w-auto h-auto'
                }`}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 text-sm text-slate-500"
            >
              No preview available.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
