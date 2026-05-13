import { actions } from '#/actions'
import type { BridgeStartRoute } from './shared'

/**
 * Request-time lifecycle routes.
 *
 * Keep this table limited to callbacks that must fire before the request is
 * sent, such as legacy `started` actions.
 */
export const BRIDGE_START_ROUTES: ReadonlyArray<BridgeStartRoute> = [
  {
    endpoint: 'PATCH /api/v2/assets/:uid/',
    refluxAction: 'actions.map.setMapStyles.started',
    method: 'PATCH',
    matches: ({ assetUid, requestBody }) => Boolean(assetUid && requestBody && 'map_styles' in requestBody),
    run: ({ assetUid, requestBody }) => {
      // Legacy map style flow still relies on `started` for immediate UI state.
      actions.map.setMapStyles.started(assetUid as string, requestBody?.map_styles)
    },
  },
]
