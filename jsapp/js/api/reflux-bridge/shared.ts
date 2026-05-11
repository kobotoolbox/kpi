import type { Asset } from '#/api/models/asset'
import type { AssetResponse } from '#/dataInterface'

/**
 * Shared bridge types and helpers.
 *
 * Keep this file free of route tables and action dispatches; it should only
 * contain reusable parsing, normalization, and context-building logic.
 */

export interface BridgeableSuccessResponse {
  data: unknown
  status: number
  headers: Headers
}

export interface BridgeableFailureResponse {
  error: unknown
  data?: unknown
  status?: number
  headers?: Headers
}

export interface BridgeableRequestConfig {
  method?: string
  body?: BodyInit | null
}

export interface BridgeRequestRouteContext {
  method: string
  pathname: string
  requestBody?: Record<string, unknown>
  assetUid?: string
  deploymentAssetUid?: string
}

export interface BridgeSuccessRouteContext extends BridgeRequestRouteContext {
  responseData: unknown
}

export interface LegacyFailurePayload {
  status?: number
  responseJSON?: Record<string, unknown>
  responseText?: string
  detail?: unknown
}

export interface BridgeFailureRouteContext extends BridgeSuccessRouteContext {
  failureData?: unknown
  failureError: unknown
  legacyFailurePayload: LegacyFailurePayload
}

export interface BridgeStartRoute {
  endpoint: string
  refluxAction: string
  method: string
  matches: (context: BridgeRequestRouteContext) => boolean
  run: (context: BridgeRequestRouteContext) => void
}

export interface BridgeSuccessRoute {
  endpoint: string
  refluxAction: string
  method: string
  matches: (context: BridgeSuccessRouteContext) => boolean
  run: (context: BridgeSuccessRouteContext) => void
}

export interface BridgeFailureRoute {
  endpoint: string
  refluxAction: string
  method: string
  matches: (context: BridgeFailureRouteContext) => boolean
  run: (context: BridgeFailureRouteContext) => void
}

/**
 * Small type guard used by the route modules to avoid repeating object checks.
 * Excludes arrays and other non-plain-object values.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getPathParts(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

/** Matches `/api/v2/assets/:uid/` */
export function getAssetUidFromAssetPath(pathname: string): string | undefined {
  const parts = getPathParts(pathname)
  if (parts.length === 4 && parts[0] === 'api' && parts[1] === 'v2' && parts[2] === 'assets') {
    return parts[3]
  }
  return undefined
}

/** Matches `/api/v2/assets/:uid/deployment/` */
export function getAssetUidFromDeploymentPath(pathname: string): string | undefined {
  const parts = getPathParts(pathname)
  if (
    parts.length === 5 &&
    parts[0] === 'api' &&
    parts[1] === 'v2' &&
    parts[2] === 'assets' &&
    parts[4] === 'deployment'
  ) {
    return parts[3]
  }
  return undefined
}

export function toPathname(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return new URL(url).pathname
  }
  return new URL(url, window.location.origin).pathname
}

export function parseJsonBody(body: BodyInit | null | undefined): Record<string, unknown> | undefined {
  // Orval sends JSON payloads as strings for mutation requests.
  // Parsing lets route matching distinguish create vs clone, or similar forks.
  if (typeof body !== 'string') {
    return undefined
  }

  try {
    const parsed = JSON.parse(body)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function toLegacyAsset(asset: Asset | AssetResponse): AssetResponse {
  return asset as unknown as AssetResponse
}

export function toLegacyFailurePayload(response: BridgeableFailureResponse): LegacyFailurePayload {
  // Legacy failed listeners often expect a jQuery-style failure payload.
  const payload: LegacyFailurePayload = {
    detail: response.error,
  }

  if (typeof response.status === 'number') {
    payload.status = response.status
  }

  if (isRecord(response.data)) {
    payload.responseJSON = response.data
  }

  if (typeof response.data === 'string') {
    payload.responseText = response.data
  }

  if (!payload.responseText && response.error instanceof Error) {
    payload.responseText = response.error.message
  }

  return payload
}

export function buildBridgeRequestContext(
  url: string,
  config: BridgeableRequestConfig,
): BridgeRequestRouteContext | undefined {
  const method = config.method?.toUpperCase()
  if (!method || method === 'GET') {
    return undefined
  }
  const pathname = toPathname(url)
  return {
    method,
    pathname,
    requestBody: parseJsonBody(config.body),
    assetUid: getAssetUidFromAssetPath(pathname),
    deploymentAssetUid: getAssetUidFromDeploymentPath(pathname),
  }
}
