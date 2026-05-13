import type { Metadata } from 'next';
import HomePage from '@/components/home-page';
import { WorkspaceAuthPage } from '@/components/workspace-auth-page';
import { CURRENT_VERSION } from '@/lib/appVersion';
import { getTokenConfig } from '@/lib/tokens';
import { isWorkspacePasswordEnabled, readWorkspaceAccess } from '@/lib/workspaceAccess';
import { readWorkspaceSession } from '@/lib/workspaceSession';

export const metadata: Metadata = {
  title: 'ERDB Configurator',
  description: 'Dedicated fullscreen configurator and addon proxy workspace for ERDB.',
};

export default async function ConfiguratorPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const guestMode = resolvedSearchParams?.guest === '1';
  const requiresWorkspacePassword = isWorkspacePasswordEnabled();
  const hasWorkspaceAccess = await readWorkspaceAccess();

  if (requiresWorkspacePassword && !hasWorkspaceAccess) {
    return <WorkspaceAuthPage requiresWorkspacePassword />;
  }

  if (guestMode) {
    return <HomePage mode="workspace" initialVersion={CURRENT_VERSION} />;
  }

  const session = await readWorkspaceSession();

  if (!session) {
    return <WorkspaceAuthPage requiresWorkspacePassword={requiresWorkspacePassword} />;
  }

  const tokenConfig = getTokenConfig(session.token);
  if (!tokenConfig) {
    return <WorkspaceAuthPage requiresWorkspacePassword={requiresWorkspacePassword} />;
  }

  return (
    <HomePage
      mode="workspace"
      initialToken={session.token}
      initialConfig={tokenConfig.config}
      initialVersion={CURRENT_VERSION}
    />
  );
}
