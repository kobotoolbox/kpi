/**
 * Public bridge entrypoint used by the shared Orval mutator.
 *
 * In simple terms, this bridge keeps legacy Reflux listeners working while request code is moved to Orval/react-query.
 * Every non-GET request is converted into a small context object (method, path, parsed body, and useful IDs).
 * The bridge then checks handler tables for the current lifecycle phase: before request, success response, or failure.
 *
 * A handler runs only when the endpoint pattern matches the request and its `matches(...)` predicate returns true.
 * If a handler runs, it triggers the legacy callback so older UI code still reacts correctly during the migration.
 *
 * File layout:
 * - `shared.ts` holds common helpers and shared types.
 * - `start-handlers.ts` handles request-time lifecycle callbacks.
 * - `success-handlers.ts` handles response-time success bridging.
 * - `failure-handlers.ts` handles response-time failure bridging.
 */

import { BRIDGE_FAILURE_HANDLERS } from './failure-handlers'
import type {
  BridgeFailureHandlerContext,
  BridgeSuccessHandlerContext,
  BridgeableFailureResponse,
  BridgeableRequestConfig,
  BridgeableSuccessResponse,
} from './shared'
import { buildBridgeRequestContext, doesEndpointMatchHandler, toLegacyFailurePayload } from './shared'
import { BRIDGE_START_HANDLERS } from './start-handlers'
import { BRIDGE_SUCCESS_HANDLERS } from './success-handlers'

export * from './shared'
export * from './start-handlers'
export * from './success-handlers'
export * from './failure-handlers'

/**
 * Run every matching handler for the given lifecycle context.
 *
 * This keeps dispatching generic so the handler tables stay declarative and the
 * file does not accumulate endpoint-specific branching.
 *
 * Each handler is error-isolated: if a legacy action throws, we log the error
 * but do not propagate it. This ensures bridge failures never break the API call.
 */
function runMatchingRequestHandlers<
  HandlerContext extends { method: string; pathname: string },
  Handler extends {
    endpoint: string
    refluxAction: string
    matches: (context: HandlerContext) => boolean
    run: (context: HandlerContext) => void
  },
>(handlers: ReadonlyArray<Handler>, context: HandlerContext) {
  handlers.forEach((handler) => {
    if (doesEndpointMatchHandler(handler.endpoint, context.method, context.pathname) && handler.matches(context)) {
      try {
        handler.run(context)
      } catch (error) {
        console.error('[Orval→Reflux Bridge] Error running legacy action handler:', {
          endpoint: handler.endpoint,
          refluxAction: handler.refluxAction,
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

  runMatchingRequestHandlers(BRIDGE_START_HANDLERS, context)
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

  const successContext: BridgeSuccessHandlerContext = {
    ...requestContext,
    responseData: response.data,
  }

  runMatchingRequestHandlers(BRIDGE_SUCCESS_HANDLERS, successContext)
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

  const failureContext: BridgeFailureHandlerContext = {
    ...requestContext,
    responseData: response.data,
    failureData: response.data,
    failureError: response.error,
    legacyFailurePayload: toLegacyFailurePayload(response),
  }

  runMatchingRequestHandlers(BRIDGE_FAILURE_HANDLERS, failureContext)
}
