'use client';

import { HomePageView } from '@/components/home-page-view';
import { WorkspacePageView } from '@/components/workspace-page-view';
import { useHomePageController } from '@/components/home-page/use-home-page-controller';
import type { HomePageMode } from '@/components/home-page/home-page-utils';

export default function HomePage({
  mode = 'landing',
  initialToken = null,
  initialConfig = null,
  initialVersion = '',
}: {
  mode?: HomePageMode;
  initialToken?: string | null;
  initialConfig?: Record<string, unknown> | null;
  initialVersion?: string;
}) {
  const controller = useHomePageController({ mode, initialToken, initialConfig, initialVersion });

  return controller.mode === 'workspace' ? (
    <WorkspacePageView {...controller.viewProps} />
  ) : (
    <HomePageView {...controller.viewProps} />
  );
}
