/**
 * Public bridge entrypoint used by the shared Orval mutator.
 *
 * In simple terms, this bridge keeps legacy Reflux listeners working while request code is moved to Orval/react-query.
 * Every non-GET request is converted into a small context object (method, path, parsed body, and useful IDs).
 * The bridge then checks route tables for the current lifecycle phase: before request, success response, or failure.
 *
 * A route runs only when the endpoint pattern matches the request and its `matches(...)` predicate returns true.
 * If a route runs, it triggers the legacy callback so older UI code still reacts correctly during the migration.
 *
 * File layout:
 * - `shared.ts` holds common helpers and shared types.
 * - `start-routes.ts` handles request-time lifecycle callbacks.
 * - `success-routes.ts` handles response-time success bridging.
 * - `failure-routes.ts` handles response-time failure bridging.
 */

import { BRIDGE_FAILURE_ROUTES } from './failure-routes'
import type {
  BridgeFailureRouteContext,
  BridgeSuccessRouteContext,
  BridgeableFailureResponse,
  BridgeableRequestConfig,
  BridgeableSuccessResponse,
} from './shared'
import { buildBridgeRequestContext, doesEndpointMatchRequest, toLegacyFailurePayload } from './shared'
import { BRIDGE_START_ROUTES } from './start-routes'
import { BRIDGE_SUCCESS_ROUTES } from './success-routes'

export * from './shared'
export * from './start-routes'
export * from './success-routes'
export * from './failure-routes'

/**
 * Run every matching route for the given lifecycle context.
 *
 * This keeps dispatching generic so the route tables stay declarative and the
 * file does not accumulate endpoint-specific branching.
 *
 * Each route is error-isolated: if a legacy action throws, we log the error
 * but do not propagate it. This ensures bridge failures never break the API call.
 */
function runMatchingRequestRoutes<
  RouteContext extends { method: string; pathname: string },
  Route extends {
    endpoint: string
    refluxAction: string
    matches: (context: RouteContext) => boolean
    run: (context: RouteContext) => void
  },
>(routes: ReadonlyArray<Route>, context: RouteContext) {
  routes.forEach((route) => {
    if (doesEndpointMatchRequest(route.endpoint, context.method, context.pathname) && route.matches(context)) {
      try {
        route.run(context)
      } catch (error) {
        console.error('[Orval→Reflux Bridge] Error running legacy action route:', {
          endpoint: route.endpoint,
          refluxAction: route.refluxAction,
          error,
        })
      }
    }
  })
}

export function bridgeOrvalStartToLegacyActions(url: string, config: BridgeableRequestConfig) {
  // Request-time lifecycle callbacks should run before the network call.
  const context = buildBridgeRequestContext(url, config)

  if (!context) {
    return
  }

  runMatchingRequestRoutes(BRIDGE_START_ROUTES, context)
}

export function bridgeOrvalSuccessToLegacyActions(
  url: string,
  config: BridgeableRequestConfig,
  response: BridgeableSuccessResponse,
) {
  // Response-time success callbacks should run only after a successful fetch.
  const requestContext = buildBridgeRequestContext(url, config)

  if (!requestContext) {
    return
  }

  const successContext: BridgeSuccessRouteContext = {
    ...requestContext,
    responseData: response.data,
  }

  runMatchingRequestRoutes(BRIDGE_SUCCESS_ROUTES, successContext)
}

export function bridgeOrvalFailureToLegacyActions(
  url: string,
  config: BridgeableRequestConfig,
  response: BridgeableFailureResponse,
) {
  // Response-time failure callbacks should run right before the error is thrown.
  const requestContext = buildBridgeRequestContext(url, config)

  if (!requestContext) {
    return
  }

  const failureContext: BridgeFailureRouteContext = {
    ...requestContext,
    responseData: response.data,
    failureData: response.data,
    failureError: response.error,
    legacyFailurePayload: toLegacyFailurePayload(response),
  }

  runMatchingRequestRoutes(BRIDGE_FAILURE_ROUTES, failureContext)
}
