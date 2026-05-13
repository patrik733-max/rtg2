import { NextResponse } from 'next/server';
import { CURRENT_VERSION } from '@/lib/appVersion';

export const runtime = 'nodejs';

const GITHUB_OWNER = 'realbestia1';
const GITHUB_REPO = 'erdb';
const GITHUB_PACKAGE_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/package.json`;

const fetchJson = async (url: string) => {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
};

export async function GET() {
  const currentVersion = CURRENT_VERSION;
  let githubPackageVersion: string | null = null;

  const githubPackage = await fetchJson(GITHUB_PACKAGE_URL);
  if (githubPackage && typeof githubPackage === 'object') {
    const version = (githubPackage as { version?: string }).version;
    if (typeof version === 'string' && version.trim()) {
      githubPackageVersion = version.trim();
    }
  }

  return NextResponse.json({
    currentVersion,
    githubPackageVersion,
    repoUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
  });
}
