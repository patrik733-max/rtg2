import packageJson from '@/package.json';

export const CURRENT_VERSION = String(packageJson.version || '').trim();
