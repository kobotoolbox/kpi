import type { Asset } from '#/api/models/asset'
import type { AssetResponse, FailResponse } from '#/dataInterface'

/**
 * Shared bridge types and helpers.
 *
 * Keep this file free of route tables and action dispatches; it should only contain reusable parsing, normalization,
 * and context-building logic.
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

export type LegacyFailurePayload = FailResponse & {
  detail?: unknown
}

export interface BridgeFailureRouteContext extends BridgeSuccessRouteContext {
  failureData?: unknown
  failureError: unknown
  legacyFailurePayload: LegacyFailurePayload
}

export interface BridgeRoute<Context> {
  /**
   * Endpoint pattern used for route pre-matching, e.g. `PATCH /api/v2/assets/:uid/`. `:param` segments match a single
   * non-empty path segment.
   */
  endpoint: string
  /** Human-readable legacy action label used for diagnostics and code navigation. */
  refluxAction: string
  /** Predicate that decides whether this route should run for a given context */
  matches: (context: Context) => boolean
  /** Side-effect callback that emits the corresponding legacy Reflux action */
  run: (context: Context) => void
}

export type BridgeStartRoute = BridgeRoute<BridgeRequestRouteContext>

export type BridgeSuccessRoute = BridgeRoute<BridgeSuccessRouteContext>

export type BridgeFailureRoute = BridgeRoute<BridgeFailureRouteContext>

export enum SpecializedAssetPatchField {
  ReportStyles = 'report_styles',
  ReportCustom = 'report_custom',
  MapStyles = 'map_styles',
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
  return asset as AssetResponse
}

/**
 * Convert an unknown API payload into the legacy asset shape used by Reflux stores.
 */
export function toLegacyAssetFromUnknown(value: unknown): AssetResponse {
  return toLegacyAsset(value as Asset | AssetResponse)
}

/**
 * Read deployment response payloads that embed an `asset` object.
 */
export function getLegacyDeploymentAsset(value: unknown): AssetResponse | undefined {
  if (!isRecord(value) || !isRecord(value.asset)) {
    return undefined
  }

  return toLegacyAssetFromUnknown(value.asset)
}

export function toLegacyFailurePayload(response: BridgeableFailureResponse): LegacyFailurePayload {
  // Legacy failed listeners often expect a jQuery-style failure payload.
  const payload: LegacyFailurePayload = {
    status: typeof response.status === 'number' ? response.status : 0,
    statusText: 'error',
    detail: response.error,
  }

  if (response.headers) {
    payload.headers = response.headers
  }

  if (isRecord(response.data)) {
    payload.responseJSON = response.data as FailResponse['responseJSON']
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

/**
 * Checks whether an incoming request matches a route endpoint pattern.
 *
 * `endpoint` is the route declaration (for example, `PATCH /api/v2/assets/:uid/`) and carries both
 * method and path pattern. We still pass `method` separately because that value comes from normalized
 * request context (`buildBridgeRequestContext`) and represents what Orval actually sent.
 *
 * Keeping both inputs lets us fail fast when a route declaration is malformed or inconsistent with
 * request context, and avoids relying on route-local duplicate method fields.
 */
export function doesEndpointMatchRequest(endpoint: string, method: string, pathname: string): boolean {
  const separatorIndex = endpoint.indexOf(' ')
  if (separatorIndex <= 0) {
    return false
  }

  const endpointMethod = endpoint.slice(0, separatorIndex)
  const endpointPathPattern = endpoint.slice(separatorIndex + 1).trim()
  if (!endpointPathPattern.startsWith('/')) {
    return false
  }

  if (endpointMethod !== method) {
    return false
  }

  const patternParts = getPathParts(endpointPathPattern)
  const pathParts = getPathParts(pathname)

  if (patternParts.length !== pathParts.length) {
    return false
  }

  return patternParts.every((patternPart, index) => {
    if (patternPart.startsWith(':')) {
      return pathParts[index].length > 0
    }

    return patternPart === pathParts[index]
  })
}
