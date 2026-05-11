/**
 * Public bridge entrypoint used by the shared Orval mutator.
 *
 * File layout:
 * - `shared.ts` holds common helpers and shared types.
 * - `start-routes.ts` handles request-time lifecycle callbacks.
 * - `success-routes.ts` handles response-time success bridging.
 * - `failure-routes.ts` handles response-time failure bridging.
 *
 * How to extend this bridge:
 * 1. Find the lifecycle you need.
 *    - Use `start-routes.ts` when a legacy callback must fire before the request starts.
 *    - Use `success-routes.ts` when a legacy callback should fire after a successful response.
 *    - Use `failure-routes.ts` when a legacy callback should fire after a failed response.
 * 2. Search for the closest existing route and copy its shape.
 *    - Keep the new route focused on one endpoint or one request pattern.
 *    - If the same endpoint needs different behavior, add a separate route entry instead of making one route too smart.
 * 3. Use the shared helpers from `shared.ts` when you need to inspect the request.
 *    - `buildBridgeRequestContext()` gives you the method, pathname, request body, and parsed asset UIDs.
 *    - `isRecord()` helps when checking response payloads.
 * 4. Keep the route body small.
 *    - The route should usually only decide whether it matches and then call the legacy action.
 *    - If you need reusable logic, put the helper in `shared.ts` or keep it local to the route file.
 * 5. Keep this file limited to dispatch orchestration.
 *    - Do not add endpoint-specific branching here.
 *    - Do not add feature-specific business logic here.
 *    - This file should only route a request to the correct lifecycle table.
 *
 * Practical rule of thumb:
 * - If you are asking "which file should I edit?", start with the route file that matches the lifecycle.
 * - If you are asking "how do I inspect the request?", use `shared.ts`.
 * - If you are asking "where does the request get dispatched?", this file is the answer.
 */

import { BRIDGE_FAILURE_ROUTES } from './failure-routes'
import type {
  BridgeFailureRouteContext,
  BridgeSuccessRouteContext,
  BridgeableFailureResponse,
  BridgeableRequestConfig,
  BridgeableSuccessResponse,
} from './shared'
import { buildBridgeRequestContext, toLegacyFailurePayload } from './shared'
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
  RouteContext extends { method: string },
  Route extends { method: string; matches: (context: RouteContext) => boolean; run: (context: RouteContext) => void },
>(routes: ReadonlyArray<Route>, context: RouteContext) {
  routes.forEach((route) => {
    if (route.method === context.method && route.matches(context)) {
      try {
        route.run(context)
      } catch (error) {
        console.error('[Orval→Reflux Bridge] Error running legacy action route:', error)
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
