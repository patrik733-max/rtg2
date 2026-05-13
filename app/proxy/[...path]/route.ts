import { NextRequest, NextResponse } from 'next/server';
import {
  ERDB_RESERVED_PARAMS,
  buildProxyId,
  decodeProxyConfig,
  getProxyConfigFromQuery,
  parseAddonBaseUrl,
  type ProxyConfig,
} from '@/lib/addonProxy';
import { applyProxyCatalogOverrides, unwrapProxyCatalogVariantId } from '@/lib/proxyCatalog';
import { fetchWithRetry } from '@/lib/request';
import { getTokenConfig } from '@/lib/tokens';
import { buildProxyConfigFromToken } from '@/lib/proxyTokenConfig';
import { isAnimeMeta, mapWithConcurrency, rewriteMetaImages, translateMetaPayload } from '@/lib/proxyMetaTransform';
const decodeBase64UrlValue = (value: string) => {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const padded = padding ? normalized + '='.repeat(4 - padding) : normalized;
    return Buffer.from(padded, 'base64').toString('utf8');
  }
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const getPublicRequestUrl = (request: NextRequest) => {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!forwardedHost) return request.nextUrl;
  const protoHeader = request.headers.get('x-forwarded-proto');
  const proto = (protoHeader?.split(',')[0].trim() || request.nextUrl.protocol.replace(':', '')).toLowerCase();
  const host = forwardedHost.split(',')[0].trim();
  const url = new URL(request.nextUrl.toString());
  url.protocol = `${proto}:`;
  url.host = host;
  return url;
};

const buildError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers: corsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { searchParams } = request.nextUrl;
  const params = await context.params;
  const pathSegments = params?.path || [];
  const hasQueryConfig = searchParams.has('url') || searchParams.has('tmdbKey') || searchParams.has('mdblistKey');
  const queryConfig = hasQueryConfig ? getProxyConfigFromQuery(searchParams) : null;

  if (hasQueryConfig && !queryConfig) {
    if (!searchParams.get('url')) {
      return buildError('Missing "url" query parameter.');
    }
    return buildError('Missing "tmdbKey" or "mdblistKey" query parameter.');
  }

  let config: ProxyConfig | null = queryConfig;
  let resourceSegments = pathSegments;
  let configSeed: string | undefined;

  if (!config) {
    if (pathSegments.length < 2) {
      return buildError('Missing proxy config in path.');
    }
    configSeed = pathSegments[0];

    if (configSeed.startsWith('Tk-')) {
      const tokenData = getTokenConfig(configSeed);
      if (tokenData && tokenData.config) {
        const encodedManifestUrl = pathSegments[1];
        let decodedManifestUrl: string | null = null;
        let decodedProxyOverrides: Record<string, any> | null = null;
        if (encodedManifestUrl && encodedManifestUrl !== 'manifest.json') {
          try {
            const candidate = decodeBase64UrlValue(encodedManifestUrl);
            if (/^https?:\/\//i.test(candidate)) {
              decodedManifestUrl = candidate;
            } else {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === 'object') {
                decodedProxyOverrides = parsed as Record<string, any>;
                if (typeof decodedProxyOverrides.url === 'string' && /^https?:\/\//i.test(decodedProxyOverrides.url)) {
                  decodedManifestUrl = decodedProxyOverrides.url;
                }
              }
            }
          } catch {
            // ignore invalid manifest override and fall back to token-only path parsing
          }
        }

        config = buildProxyConfigFromToken(tokenData.config, decodedManifestUrl, decodedProxyOverrides);

        if (config && decodedManifestUrl && encodedManifestUrl && encodedManifestUrl !== 'manifest.json') {
          config = {
            ...config,
            token: configSeed,
            url: decodedManifestUrl,
          };
          configSeed = `${configSeed}:${encodedManifestUrl}`;
          resourceSegments = pathSegments.slice(2);
        } else if (config) {
          config = {
            ...config,
            token: configSeed,
          };
        }
      }
    } else {
      config = decodeProxyConfig(configSeed);
    }

    if (!config) {
      return buildError('Invalid proxy config in path.');
    }
    if (resourceSegments === pathSegments) {
      resourceSegments = pathSegments.slice(1);
    }
  }

  if (resourceSegments.length === 0) {
    return buildError('Missing addon resource path.');
  }

  const publicRequestUrl = getPublicRequestUrl(request);

  if (!hasQueryConfig && resourceSegments.length === 1 && resourceSegments[0] === 'manifest.json') {
    let manifestResponse: Response;
    try {
      manifestResponse = await fetch(config.url, { cache: 'no-store' });
    } catch (error) {
      return buildError('Unable to reach the source manifest.', 502);
    }

    const manifestBody = await manifestResponse.arrayBuffer();

    if (!manifestResponse.ok) {
      return buildError(`Source manifest returned ${manifestResponse.status}.`, 502);
    }

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(new TextDecoder().decode(manifestBody)) as Record<string, unknown>;
    } catch (error) {
      return buildError('Source manifest is not valid JSON.', 502);
    }

    const proxyId = buildProxyId(config.url, configSeed);
    const originalName = typeof manifest.name === 'string' ? manifest.name : 'Addon';
    const originalDescription =
      typeof manifest.description === 'string' ? manifest.description : 'Proxied via ERDB';

    const proxyManifest = {
      ...manifest,
      id: proxyId,
      name: `ERDB Proxy - ${originalName}`,
      description: `${originalDescription} (proxied via ERDB)`,
      catalogs: applyProxyCatalogOverrides(manifest.catalogs, {
        names: config.catalogNames,
        hidden: config.hiddenCatalogs,
        searchDisabled: config.searchDisabledCatalogs,
        discoverOnly: config.discoverOnlyCatalogs,
      }),
    };

    return NextResponse.json(proxyManifest, { status: 200, headers: corsHeaders });
  }

  let originBase: string;
  try {
    originBase = parseAddonBaseUrl(config.url);
  } catch (error) {
    return buildError('Invalid source manifest URL.', 400);
  }

  const resource = resourceSegments[0] || '';
  const requestedType =
    resource === 'catalog' || resource === 'meta'
      ? (resourceSegments[1] || null)
      : null;
  const forwardUrl = new URL(originBase);
  const normalizedResourceSegments =
    resource === 'catalog' && resourceSegments[2]
      ? [
          resourceSegments[0],
          resourceSegments[1],
          unwrapProxyCatalogVariantId(resourceSegments[2]),
          ...resourceSegments.slice(3),
        ]
      : resourceSegments;
  // Preserve Stremio "extra" path segments like `search=...` and `skip=...`.
  // Encoding each segment would turn `=` into `%3D`, breaking upstream parsing.
  forwardUrl.pathname = `${forwardUrl.pathname.replace(/\/$/, '')}/${normalizedResourceSegments.join('/')}`;

  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (!ERDB_RESERVED_PARAMS.has(key)) {
      forwardParams.append(key, value);
    }
  }
  forwardUrl.search = forwardParams.toString();

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(forwardUrl.toString(), { cache: 'no-store' });
  } catch (error) {
    return buildError('Unable to reach the source addon.', 502);
  }

  const upstreamBody = await upstreamResponse.arrayBuffer();

  if (!upstreamResponse.ok) {
    return new NextResponse(upstreamBody, {
      status: upstreamResponse.status,
      headers: {
        'content-type': upstreamResponse.headers.get('content-type') || 'text/plain',
      },
    });
  }

  if (resource !== 'catalog' && resource !== 'meta') {
    const headers = new Headers(upstreamResponse.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    return new NextResponse(upstreamBody, {
      status: upstreamResponse.status,
      headers,
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(upstreamBody)) as Record<string, unknown>;
  } catch (error) {
    const headers = new Headers(upstreamResponse.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    return new NextResponse(upstreamBody, {
      status: upstreamResponse.status,
      headers,
    });
  }

  if (resource === 'catalog' && Array.isArray(payload.metas)) {
    const metasWithImages = payload.metas.map((meta) =>
      rewriteMetaImages(meta as Record<string, unknown>, publicRequestUrl, config, requestedType),
    );
    payload.metas = await mapWithConcurrency(
      metasWithImages as Array<Record<string, unknown>>,
      6,
      async (meta) => translateMetaPayload(meta, publicRequestUrl, config, requestedType),
    );
  }

  if (resource === 'meta' && payload.meta && typeof payload.meta === 'object') {
    const metaWithImages = rewriteMetaImages(
      payload.meta as Record<string, unknown>,
      publicRequestUrl,
      config,
      requestedType
    );
    payload.meta = await translateMetaPayload(metaWithImages, publicRequestUrl, config, requestedType);
  }

  return NextResponse.json(payload, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('Proxy GET error:', error.message || error);
    return buildError('An unexpected error occurred in the proxy route.', 500);
  }
}


